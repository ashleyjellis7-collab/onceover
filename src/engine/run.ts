import type {
  Band,
  Channel,
  Product,
  RuleRecord,
  RuleSet,
  ScoreKind,
  Severity,
} from "@/rules";
import { heuristicModel, type DecisionModel } from "./model";
import { bandFor, score } from "./score";
import { fuzzyContains, paragraphs, readingGrade, sentences } from "./text";

export type Finding = {
  ruleId: string;
  title: string;
  citation: string;
  source: string;
  score: ScoreKind;
  band: Band;
  severity: Severity;
  probability: number;
  decidedBy: "code" | "model";
  evidence: string | null;
  explanation: string;
  suggestion: string;
};

export type CheckResult = {
  checker: ScoreKind;
  ruleSetVersion: string;
  modelVersion: string;
  isPromotion: boolean;
  product: Product | null;
  channel: Channel | null;
  finpromScore: number | null;
  consumerDutyScore: number | null;
  findings: Finding[];
};

export async function runChecks(
  text: string,
  ruleSet: RuleSet,
  opts: { checker: ScoreKind; product?: Product | null; channel?: Channel | null },
  model: DecisionModel = heuristicModel,
): Promise<CheckResult> {
  // 1. Applicability gates. User-supplied product/channel win over detection.
  const detected = await model.classify(text);
  const isPromotion = detected.isPromotion >= 0.5 || !!opts.product;
  const product = opts.product ?? detected.product;
  const channel = opts.channel ?? detected.channel;

  const applicable = ruleSet.rules.filter((r) => {
    if (r.score !== opts.checker) return false;
    const promotionOnly = r.appliesWhen.promotionOnly ?? r.score === "finprom";
    if (promotionOnly && !isPromotion) return false;
    if (r.appliesWhen.products && (!product || !r.appliesWhen.products.includes(product)))
      return false;
    if (r.appliesWhen.channels && (!channel || !r.appliesWhen.channels.includes(channel)))
      return false;
    return true;
  });

  // 2. Judgement calls go to the model in one batch; code checks run locally.
  const judged = applicable.filter((r) => r.check.type === "noul");
  const questions = judged.map((r) => {
    const c = r.check as Extract<RuleRecord["check"], { type: "noul" }>;
    return { question: c.question, signals: c.signals };
  });
  const probs = questions.length ? await model.noul(text, questions) : [];
  // 3. Evidence: find the sentence behind each finding that isn't Clear.
  const flagged = judged
    .map((r, i) => ({ i, q: questions[i] }))
    .filter(({ i }) => bandFor(probs[i], judged[i].thresholds) !== "clear");
  const evidence = flagged.length
    ? await model.evidence(text, flagged.map((f) => f.q))
    : [];
  const evidenceFor = new Map(flagged.map((f, j) => [f.i, evidence[j]]));
  const modelAnswers = new Map<string, Answer>(
    judged.map((r, i) => [r.id, { p: probs[i], evidence: evidenceFor.get(i) ?? null }]),
  );

  const findings: Finding[] = [];
  for (const rule of applicable) {
    const answer =
      modelAnswers.get(rule.id) ?? codeCheck(rule, text);
    if (!answer) continue; // rule not triggered (e.g. no cost information shown)
    const band = bandFor(answer.p, rule.thresholds);
    findings.push({
      ruleId: rule.id,
      title: rule.title,
      citation: rule.citation,
      source: rule.source,
      score: rule.score,
      band,
      severity: rule.severity,
      probability: round(answer.p),
      decidedBy: rule.check.type === "noul" ? "model" : "code",
      evidence: answer.evidence ?? null,
      explanation: explain(rule, band, answer.detail),
      suggestion: rule.fixHint,
    });
  }

  const of = (k: ScoreKind) => findings.filter((f) => f.score === k);
  return {
    checker: opts.checker,
    ruleSetVersion: ruleSet.version,
    modelVersion: model.version,
    isPromotion,
    product,
    channel,
    finpromScore: opts.checker === "finprom" && isPromotion ? score(of("finprom")) : null,
    consumerDutyScore: opts.checker === "consumer_duty" ? score(of("consumer_duty")) : null,
    findings,
  };
}

type Answer = { p: number; evidence?: string | null; detail?: string };

function codeCheck(rule: RuleRecord, text: string): Answer | null {
  const c = rule.check;
  switch (c.type) {
    case "required_wording": {
      if (c.triggeredBy && !c.triggeredBy.some((re) => re.test(text))) return null;
      const best = Math.max(...c.variants.map((v) => fuzzyContains(text, v)));
      // Probability the wording is missing. Partial matches go to Review.
      const p = best >= 0.9 ? 0.02 : best >= 0.6 ? 0.5 : 0.95;
      const trigger = c.triggeredBy
        ?.map((re) => sentences(text).find((s) => re.test(s)))
        .find(Boolean);
      return {
        p,
        evidence: trigger ?? null,
        detail:
          best >= 0.9
            ? undefined
            : best >= 0.6
              ? `Similar wording found (${Math.round(best * 100)}% match), but not the prescribed text.`
              : "The required wording was not found.",
      };
    }
    case "reading_age": {
      const grade = readingGrade(text);
      if (grade === null) return null;
      const p = grade > c.issueAbove ? 0.85 : grade > c.reviewAbove ? 0.5 : 0.05;
      return {
        p,
        detail: `Estimated reading grade ${grade.toFixed(1)} (Flesch-Kincaid), about age ${Math.round(grade + 5)}.`,
      };
    }
    case "costs_in_pounds": {
      const pct = sentences(text).find((s) => /\d+(\.\d+)?\s?%/.test(s));
      if (!pct) return null;
      const pounds = /£\s?\d/.test(text);
      return {
        p: pounds ? 0.05 : 0.6,
        evidence: pounds ? null : pct,
        detail: pounds ? undefined : "Percentages are shown with no pound amounts.",
      };
    }
    case "layout": {
      if (c.metric === "all_caps") {
        const run = text.match(/\b[A-Z]{2,}(?:[\s,]+[A-Z]{2,}){5,}\b/);
        return {
          p: run ? 0.6 : 0.05,
          evidence: run?.[0] ?? null,
          detail: run ? "Six or more words in a row are in capitals." : undefined,
        };
      }
      const dense = paragraphs(text).find((p) => p.split(/\s+/).length > 120);
      return {
        p: dense ? 0.6 : 0.05,
        evidence: dense ? dense.slice(0, 160) + "…" : null,
        detail: dense ? "A paragraph runs over 120 words." : undefined,
      };
    }
    case "noul":
      return null;
  }
}

// The brief has a small language model write explanations; until then they are
// templated from the rule record. The explanation never decides the verdict.
function explain(rule: RuleRecord, band: Band, detail?: string) {
  const question =
    rule.check.type === "noul" ? rule.check.question : rule.title + ".";
  const lead =
    band === "issue"
      ? "Likely problem."
      : band === "review"
        ? "Unclear: a person should look at this."
        : "No problem found.";
  return [lead, detail, band !== "clear" ? `Checked: ${question}` : null]
    .filter(Boolean)
    .join(" ");
}

const round = (n: number) => Math.round(n * 100) / 100;
