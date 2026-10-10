import "server-only";
import { choice, noul, TypeSafeClient } from "@typesafe-ai/sdk";
import { CHANNELS, PRODUCTS, type Channel, type Product } from "@/rules";
import { heuristicModel, type Classification, type DecisionModel } from "./model";
import { sentences } from "./text";

// Thresholds are tuned against one model version, so pin it (brief: "Engine rules").
// Re-run the test set before changing this.
export const JEV_MODEL = "jev-1.13.0";

// Evidence search asks every question of every sentence, so cap the work.
const MAX_EVIDENCE_SENTENCES = 60;
const EVIDENCE_CONCURRENCY = 8;

const PRODUCT_LABELS: Record<Product, string> = {
  mainstream_investment: "A mainstream investment: funds, shares, stocks and shares ISA, ETFs",
  crypto: "A cryptoasset such as Bitcoin or another token or coin",
  nrrs: "A non-readily realisable security: mini-bonds, unlisted shares or bonds, investment crowdfunding",
  p2p: "Peer-to-peer lending",
  ltaf: "A long-term asset fund (LTAF)",
  consumer_credit: "Consumer credit: loans, credit cards, overdrafts, car finance",
  bnpl: "Buy now, pay later or other deferred payment credit",
  savings: "A savings account or cash ISA",
  mortgage: "A mortgage",
  insurance: "Insurance",
  pension: "A pension or retirement product",
};

const CHANNEL_LABELS: Record<Channel, string> = {
  website: "A web page",
  social: "A social media post, caption or influencer content",
  display_ad: "A display or banner ad",
  email: "A marketing email",
  print: "A printed leaflet, letter or brochure",
  video: "A video or its script",
};

/** Jev when TYPESAFE_API_KEY is set, otherwise the keyword heuristic. */
export function decisionModel(): DecisionModel {
  return process.env.TYPESAFE_API_KEY ? jevModel : heuristicModel;
}

let client: TypeSafeClient | undefined;
function getClient() {
  client ??= new TypeSafeClient({
    timeout: 15_000,
    retry: { maxRetries: 1 },
  });
  return client;
}

export const jevModel: DecisionModel = {
  version: JEV_MODEL,

  async noul(state, questions) {
    const { answers } = await getClient().systemOne({
      model: JEV_MODEL,
      state,
      questions: Object.fromEntries(questions.map((q, i) => [`q${i}`, noul(q.question)])),
    });
    return questions.map((_, i) => answers[`q${i}`].noul);
  },

  // The sentence with the highest "yes" probability for each question is the evidence.
  // Evidence is supporting detail, so a failure here falls back to keyword matching
  // rather than discarding Jev's verdicts.
  async evidence(state, questions) {
    try {
      return await jevEvidence(state, questions);
    } catch (e) {
      console.error("Jev evidence search failed; using keyword evidence", e);
      return heuristicModel.evidence(state, questions);
    }
  },

  async classify(state): Promise<Classification> {
    const { answers } = await getClient().systemOne({
      model: JEV_MODEL,
      state,
      questions: {
        isPromotion: noul(
          "Is this a financial promotion: an invitation or inducement to engage in investment activity, take out credit, or buy another regulated financial product?",
        ),
        product: choice("Which financial product is being promoted?", {
          ...PRODUCT_LABELS,
          none: "No financial product, or it is unclear",
        }),
        channel: choice("Where is this content most likely published?", {
          ...CHANNEL_LABELS,
          unknown: "It is unclear",
        }),
      },
    });
    const product = answers.product.choice;
    const channel = answers.channel.choice;
    return {
      isPromotion: answers.isPromotion.noul,
      product: (PRODUCTS as readonly string[]).includes(product) ? (product as Product) : null,
      channel: (CHANNELS as readonly string[]).includes(channel) ? (channel as Channel) : null,
    };
  },
};

async function jevEvidence(state: string, questions: { question: string }[]) {
  const sents = sentences(state).slice(0, MAX_EVIDENCE_SENTENCES);
  const qs = Object.fromEntries(questions.map((q, i) => [`q${i}`, noul(q.question)]));
  const scores = await mapLimit(sents, EVIDENCE_CONCURRENCY, async (s) => {
    const { answers } = await getClient().systemOne({ model: JEV_MODEL, state: s, questions: qs });
    return questions.map((_, i) => answers[`q${i}`].noul);
  });
  return questions.map((_, i) => {
    let best: string | null = null;
    let bestP = 0.5; // a sentence must lean "yes" on its own to count as evidence
    sents.forEach((s, j) => {
      if (scores[j][i] > bestP) {
        bestP = scores[j][i];
        best = s;
      }
    });
    return best;
  });
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}
