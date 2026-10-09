export type Severity = "critical" | "major" | "minor";
export type Band = "issue" | "review" | "clear";
export type ScoreKind = "finprom" | "consumer_duty";

export const PRODUCTS = [
  "mainstream_investment",
  "crypto",
  "nrrs", // non-readily realisable security
  "p2p",
  "ltaf",
  "consumer_credit",
  "bnpl",
  "savings",
  "mortgage",
  "insurance",
  "pension",
] as const;
export type Product = (typeof PRODUCTS)[number];

export const CHANNELS = [
  "website",
  "social",
  "display_ad",
  "email",
  "print",
  "video",
] as const;
export type Channel = (typeof CHANNELS)[number];

export const HIGH_RISK: Product[] = ["crypto", "nrrs", "p2p", "ltaf"];
export const CREDIT: Product[] = ["consumer_credit", "bnpl"];

/** Signals used by the heuristic decision model only. A real model ignores them. */
export type Signals = {
  /** Patterns that suggest the answer is "yes, there is a problem". */
  hit: RegExp[];
  /** Patterns that, if present, cancel a hit (e.g. a warning that balances a claim). */
  mitigate?: RegExp[];
};

export type Check =
  | {
      // Judgement call: probability that the problem in `question` is present.
      type: "noul";
      question: string;
      signals: Signals;
    }
  | {
      // Exact-wording rule, decided by code with fuzzy matching.
      type: "required_wording";
      variants: string[];
      /** Only required when one of these patterns is present (e.g. cost info). */
      triggeredBy?: RegExp[];
    }
  | {
      // Code-decided metric.
      type: "reading_age";
      reviewAbove: number;
      issueAbove: number;
    }
  | {
      type: "costs_in_pounds";
    }
  | {
      type: "layout";
      metric: "all_caps" | "dense_blocks";
    };

export type RuleRecord = {
  id: string;
  title: string;
  score: ScoreKind;
  /** Handbook or guidance reference shown to the user, e.g. "COBS 4.12A.7R". */
  citation: string;
  source: string; // URL
  sourceVersion: string; // date the source text was checked
  appliesWhen: {
    products?: Product[];
    channels?: Channel[];
    /** Only run when the asset is a financial promotion. Defaults to true for finprom. */
    promotionOnly?: boolean;
  };
  check: Check;
  severity: Severity;
  thresholds: { issue: number; review: number };
  fixHint: string;
  examples?: { fail: string[]; pass: string[] };
};

export type RuleSet = {
  version: string;
  releasedAt: string;
  changelog: string;
  rules: RuleRecord[];
};
