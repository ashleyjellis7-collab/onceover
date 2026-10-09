import type { Product, Channel, Signals } from "@/rules";
import { CHANNELS, PRODUCTS } from "@/rules";
import { sentences } from "./text";

/**
 * The decision model answers typed questions about a block of text. The brief
 * uses Jev for this (pinned version, typed Choice / Noul answers). Rule records
 * hold questions, not model calls, so any model that implements this interface
 * can be swapped in.
 */
export interface DecisionModel {
  version: string;
  /** Probability (0 to 1) that the answer to each question is yes. */
  noul(
    state: string,
    questions: { question: string; signals: Signals }[],
  ): Promise<number[]>;
  /** For each question, the sentence most likely to be the evidence. */
  evidence(
    state: string,
    questions: { question: string; signals: Signals }[],
  ): Promise<(string | null)[]>;
  classify(state: string): Promise<Classification>;
}

export type Classification = {
  isPromotion: number; // probability
  product: Product | null;
  channel: Channel | null;
};

/**
 * Keyword heuristic used until a real decision model is wired in. It reads the
 * `signals` on each rule; a real model ignores them and reads the question.
 */
export const heuristicModel: DecisionModel = {
  version: "heuristic-0.1",

  async noul(state, questions) {
    return questions.map(({ signals }) => {
      const hit = signals.hit.some((re) => re.test(state));
      if (!hit) return 0.05;
      const mitigated = signals.mitigate?.some((re) => re.test(state));
      return mitigated ? 0.15 : 0.9;
    });
  },

  async evidence(state, questions) {
    const sents = sentences(state);
    return questions.map(({ signals }) => {
      // Catch-all patterns (e.g. /[\s\S]/) flag absence, so there is no sentence to cite.
      const specific = signals.hit.filter((re) => re.source !== "[\\s\\S]");
      for (const s of sents) {
        if (specific.some((re) => re.test(s))) return s;
      }
      return null;
    });
  },

  async classify(state) {
    return {
      isPromotion: PROMOTION.some((re) => re.test(state)) ? 0.85 : 0.2,
      product: firstMatch(PRODUCT_PATTERNS, state),
      channel: firstMatch(CHANNEL_PATTERNS, state),
    };
  },
};

const PROMOTION = [
  /\b(invest|investing|investment|trade|trading|buy)\b/i,
  /\b(loan|borrow|credit|finance|APR|pay later|instal?ments?)\b/i,
  /\b(savings?|interest rate|AER|ISA)\b/i,
  /\b(mortgage|pension|insurance)\b/i,
  /\b(bitcoin|crypto|ethereum|tokens?)\b/i,
];

const PRODUCT_PATTERNS: [Product, RegExp][] = [
  ["crypto", /\b(bitcoin|btc|crypto\w*|ethereum|eth|tokens?|coins?|altcoins?|staking)\b/i],
  ["p2p", /\b(peer[- ]to[- ]peer|p2p lending|P2P)\b/i],
  ["nrrs", /\b(mini[- ]bonds?|unlisted (shares|bonds)|crowdfund\w*|non[- ]readily realisable)\b/i],
  ["ltaf", /\b(LTAF|long[- ]term asset fund)\b/i],
  ["bnpl", /\b(buy now,? pay later|BNPL|pay in (3|4|three|four)|pay later)\b/i],
  ["consumer_credit", /\b(loan|borrow|credit card|APR|finance|overdraft)\b/i],
  ["mortgage", /\bmortgages?\b/i],
  ["pension", /\b(pension|SIPP|retirement)\b/i],
  ["insurance", /\b(insurance|cover|premium|policy)\b/i],
  ["savings", /\b(savings?|AER|easy access|fixed rate bond|cash ISA)\b/i],
  ["mainstream_investment", /\b(invest\w*|funds?|shares|stocks|ISA|portfolio|ETF)\b/i],
];

const CHANNEL_PATTERNS: [Channel, RegExp][] = [
  ["social", /(#\w+|@\w+|\blink in (my )?bio\b|\bswipe up\b|\bfollow\b)/i],
  ["email", /\b(unsubscribe|view (this|in) (email|browser))\b/i],
];

function firstMatch<T extends string>(pairs: [T, RegExp][], s: string): T | null {
  for (const [value, re] of pairs) if (re.test(s)) return value;
  return null;
}

export const isProduct = (v: unknown): v is Product =>
  PRODUCTS.includes(v as Product);
export const isChannel = (v: unknown): v is Channel =>
  CHANNELS.includes(v as Channel);
