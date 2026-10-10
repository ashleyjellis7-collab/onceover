import type { AssetReading } from "./read-asset";
import { heuristicModel, type DecisionModel } from "./model";
import { fuzzyContains, paragraphs, readingGrade, sentences } from "./text";
import { AUDIENCES, DEPTHS, type Audience, type Depth, type Purpose } from "./comprehension-options";

export { AUDIENCES, DEPTHS, PURPOSES } from "./comprehension-options";
export type { Audience, Depth, Purpose } from "./comprehension-options";

// Consumer Duty comprehension pre-test. It predicts how a reader would take the
// communication, in three layers modelled on how communications research is
// reported: overall clarity, a section-by-section diagnostic, and a comprehension
// check against statements the firm supplies. It is a prediction, not evidence of
// customer understanding, and the report says so.

export type ComprehensionInput = {
  depth: Depth;
  audience: Audience;
  purpose: Purpose;
  callToAction: string | null;
  keyMessages: string[];
  trueStatements: string[];
  falseStatements: string[];
};

export type StatementOutcome =
  // for key messages and true statements
  | "clear"
  | "small_print"
  | "at_risk"
  | "missing"
  | "contradicted"
  // for false statements
  | "ruled_out"
  | "ambiguous"
  | "misleading";

export type StatementResult = {
  kind: "message" | "true" | "false" | "action";
  statement: string;
  outcome: StatementOutcome;
  /** Probability the reader takes it the right way. */
  pCorrect: number;
  evidence: string | null;
};

export type ComprehensionResult = {
  input: ComprehensionInput;
  modelVersion: string;
  /** Predicted clarity, 0 to 100. */
  clarity: number;
  /** Section-by-section diagnostic: probability each passage is hard to understand. */
  sections: { text: string; difficulty: number }[];
  results: StatementResult[];
  /** Share of statements, messages and the call to action taken the right way, 0 to 100. */
  comprehensionScore: number | null;
};

const MAX_SECTIONS = 25;
const OUTCOME_CREDIT: Record<StatementOutcome, number> = {
  clear: 1,
  ruled_out: 1,
  small_print: 0.5,
  at_risk: 0.5,
  ambiguous: 0.5,
  missing: 0,
  contradicted: 0,
  misleading: 0,
};

/** Cleans the user's statement lists to the limits for the chosen depth. */
export function normaliseInput(raw: {
  depth: Depth;
  audience: Audience;
  purpose: Purpose;
  callToAction?: string | null;
  keyMessages?: string[];
  trueStatements?: string[];
  falseStatements?: string[];
}): ComprehensionInput {
  const d = DEPTHS[raw.depth];
  const clean = (xs: string[] | undefined, max: number) =>
    (xs ?? []).map((s) => s.trim().replace(/\s+/g, " ").slice(0, 300)).filter(Boolean).slice(0, max);
  return {
    depth: raw.depth,
    audience: raw.audience,
    purpose: raw.purpose,
    callToAction: raw.callToAction?.trim().slice(0, 300) || null,
    keyMessages: clean(raw.keyMessages, d.maxMessages),
    trueStatements: clean(raw.trueStatements, d.maxStatements),
    falseStatements: clean(raw.falseStatements, d.maxStatements),
  };
}

export async function runComprehension(
  text: string,
  input: ComprehensionInput,
  model: DecisionModel,
  reading: AssetReading | null = null,
): Promise<ComprehensionResult> {
  const reader = AUDIENCES[input.audience].reader;
  const passages = paragraphs(text)
    .flatMap((p) => (p.length > 900 ? sentences(p) : [p]))
    .slice(0, MAX_SECTIONS);

  const items: { kind: StatementResult["kind"]; statement: string }[] = [
    ...(input.callToAction ? [{ kind: "action" as const, statement: input.callToAction }] : []),
    ...input.keyMessages.map((s) => ({ kind: "message" as const, statement: s })),
    ...input.trueStatements.map((s) => ({ kind: "true" as const, statement: s })),
    ...input.falseStatements.map((s) => ({ kind: "false" as const, statement: s })),
  ];

  if (model === heuristicModel) return heuristicComprehension(text, input, passages, items, reading);

  // Two questions per item, plus overall clarity, in one batch.
  const questions: string[] = [
    `Would ${reader} find this communication hard to understand overall?`,
  ];
  for (const it of items) {
    if (it.kind === "false") {
      questions.push(
        `After reading this, might ${reader} wrongly believe that: "${it.statement}"?`,
        `Does the text make it clear that the following is NOT the case: "${it.statement}"?`,
      );
    } else if (it.kind === "action") {
      questions.push(
        `After reading this, would ${reader} know that they need to: "${it.statement}"?`,
        `Does the text say or imply something that conflicts with: "${it.statement}"?`,
      );
    } else {
      questions.push(
        `After reading this, would ${reader} correctly understand that: "${it.statement}"?`,
        `Does the text say or imply the opposite of: "${it.statement}"?`,
      );
    }
  }
  const asNoul = (q: string) => ({ question: q, signals: { hit: [] } });
  const [answers, sectionScores] = await Promise.all([
    model.noul(text, questions.map(asNoul)),
    Promise.all(
      passages.map((p) =>
        model
          .noul(p, [asNoul(`Would ${reader} find this passage hard to understand?`)])
          .then(([d]) => d),
      ),
    ),
  ]);

  // Evidence: the sentence that states each true item.
  const evidenceItems = items.filter((it) => it.kind !== "false");
  const evidence = evidenceItems.length
    ? await model.evidence(
        text,
        evidenceItems.map((it) => asNoul(`Does this sentence state that: "${it.statement}"?`)),
      )
    : [];
  const evidenceFor = new Map(evidenceItems.map((it, i) => [it, evidence[i] ?? null]));

  const results = items.map((it, i): StatementResult => {
    const a = answers[1 + i * 2];
    const b = answers[2 + i * 2];
    return classify(it, a, b, evidenceFor.get(it) ?? null, reading);
  });

  return finish(input, model.version, 1 - answers[0], passages, sectionScores, results);
}

function classify(
  it: { kind: StatementResult["kind"]; statement: string },
  a: number,
  b: number,
  evidence: string | null,
  reading: AssetReading | null,
): StatementResult {
  if (it.kind === "false") {
    // a = might wrongly believe, b = clearly ruled out
    const outcome: StatementOutcome =
      a >= 0.6 ? "misleading" : b >= 0.7 && a < 0.4 ? "ruled_out" : "ambiguous";
    return { ...it, outcome, pCorrect: round(1 - a), evidence: null };
  }
  // a = understood, b = contradicted
  let outcome: StatementOutcome =
    a >= 0.7 ? "clear" : b >= 0.6 ? "contradicted" : a >= 0.4 ? "at_risk" : "missing";
  if (outcome === "clear" && evidence && inSmallPrint(evidence, reading)) outcome = "small_print";
  return { ...it, outcome, pCorrect: round(a), evidence };
}

function inSmallPrint(evidence: string, reading: AssetReading | null) {
  if (!reading) return false;
  const el = reading.elements.find((e) => fuzzyContains(e.text, evidence) >= 0.8);
  return !!el && (el.size === "tiny" || el.role === "small_print" || el.role === "disclaimer");
}

function finish(
  input: ComprehensionInput,
  modelVersion: string,
  clarity: number,
  passages: string[],
  difficulty: number[],
  results: StatementResult[],
): ComprehensionResult {
  const credit = results.map((r) => OUTCOME_CREDIT[r.outcome]);
  return {
    input,
    modelVersion,
    clarity: Math.round(Math.max(0, Math.min(1, clarity)) * 100),
    sections: passages.map((text, i) => ({ text, difficulty: round(difficulty[i] ?? 0) })),
    results,
    comprehensionScore: credit.length
      ? Math.round((credit.reduce((a, b) => a + b, 0) / credit.length) * 100)
      : null,
  };
}

// Keyword fallback when Jev is unavailable: reading grade for clarity, word
// overlap for statements. It cannot judge false statements, so they stay Ambiguous.
function heuristicComprehension(
  text: string,
  input: ComprehensionInput,
  passages: string[],
  items: { kind: StatementResult["kind"]; statement: string }[],
  reading: AssetReading | null,
): ComprehensionResult {
  const gradeToDifficulty = (g: number | null) =>
    g === null ? 0.3 : Math.max(0.05, Math.min(0.95, (g - 6) / 10));
  const sents = sentences(text);
  const results = items.map((it) => {
    const overlap = fuzzyContains(text, it.statement);
    if (it.kind === "false") return classify(it, 0.5, 0.3, null, reading);
    const best = sents.reduce<[string | null, number]>(
      (acc, s) => {
        const o = fuzzyContains(s, it.statement);
        return o > acc[1] ? [s, o] : acc;
      },
      [null, 0],
    );
    const a = overlap >= 0.75 ? 0.8 : overlap >= 0.5 ? 0.5 : 0.15;
    return classify(it, a, 0.1, best[1] >= 0.5 ? best[0] : null, reading);
  });
  return finish(
    input,
    heuristicModel.version,
    1 - gradeToDifficulty(readingGrade(text)),
    passages,
    passages.map((p) => gradeToDifficulty(readingGrade(p))),
    results,
  );
}

const round = (n: number) => Math.round(n * 100) / 100;
