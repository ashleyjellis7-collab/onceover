import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliseInput, runComprehension } from "./comprehension";
import { heuristicModel, type DecisionModel } from "./model";
import type { AssetReading } from "./read-asset";

const letter = [
  "Your fixed rate is ending.",
  "Your 1 year fixed rate bond earns 8% until 30 November. After that, your money moves to our Easy Access account, which pays 1.5%.",
  "To keep a fixed rate, choose a new bond in the app by 30 November.",
  "Withdrawals during the fixed year lose all interest.",
].join("\n\n");

// A stand-in decision model: answers from the question text, so we can test how
// answers become outcomes without calling Jev.
const fake: DecisionModel = {
  version: "fake-1",
  async classify() {
    return { isPromotion: 0.1, product: null, channel: null };
  },
  async noul(state, questions) {
    return questions.map(({ question: q }) => {
      if (q.includes("hard to understand overall")) return 0.2;
      if (q.includes("hard to understand")) return state.includes("Withdrawals") ? 0.7 : 0.1;
      if (q.includes("interest rate is 8%") && q.startsWith("After")) return 0.9;
      if (q.includes("lose all interest") && q.startsWith("After")) return 0.85;
      if (q.includes("keep the 8%") && q.includes("wrongly believe")) return 0.15;
      if (q.includes("keep the 8%") && q.includes("NOT the case")) return 0.9;
      if (q.includes("rate is variable") && q.includes("wrongly believe")) return 0.7;
      if (q.includes("Choose a new bond") && q.includes("know that they need")) return 0.55;
      return 0.1;
    });
  },
  async evidence(state, questions) {
    return questions.map(({ question }) =>
      question.includes("lose all interest") ? "Withdrawals during the fixed year lose all interest." : null,
    );
  },
};

const input = normaliseInput({
  depth: "messages",
  audience: "older",
  purpose: "maturity_renewal",
  callToAction: "Choose a new bond by 30 November",
  trueStatements: ["The interest rate is 8%", "Withdrawals during the fixed year lose all interest", ""],
  falseStatements: ["You can withdraw any time and keep the 8% rate", "The rate is variable"],
});

test("answers become comprehension outcomes and a score", async () => {
  const c = await runComprehension(letter, input, fake);
  const by = (s: string) => c.results.find((r) => r.statement.includes(s))!;
  assert.equal(c.modelVersion, "fake-1");
  assert.equal(c.clarity, 80);
  assert.equal(by("Choose a new bond").outcome, "at_risk");
  assert.equal(by("interest rate is 8%").outcome, "clear");
  assert.equal(by("keep the 8%").outcome, "ruled_out");
  assert.equal(by("rate is variable").outcome, "misleading");
  // 1 (8%) + 1 (lose interest) + 1 (ruled out) + 0 (misleading) + 0.5 (action at risk) over 5
  assert.equal(c.comprehensionScore, 70);
  // The heatmap flags the withdrawals passage.
  assert.equal(c.sections.find((s) => s.text.startsWith("Withdrawals"))?.difficulty, 0.7);
  assert.equal(c.sections.find((s) => s.text.startsWith("Your fixed"))?.difficulty, 0.1);
});

test("a fact stated only in small print is marked as such", async () => {
  const reading: AssetReading = {
    contains_text: true,
    visual_description: "",
    elements: [
      { role: "headline", text: "Your fixed rate is ending.", size: "large", position: "top", contrast: "high", in_border: false },
      {
        role: "small_print",
        text: "Withdrawals during the fixed year lose all interest.",
        size: "tiny",
        position: "bottom",
        contrast: "low",
        in_border: false,
      },
    ],
  };
  const c = await runComprehension(letter, input, fake, reading);
  assert.equal(c.results.find((r) => r.statement.includes("lose all interest"))?.outcome, "small_print");
});

test("statement lists are trimmed to the depth's limits", () => {
  const quick = normaliseInput({
    depth: "quick",
    audience: "general",
    purpose: "other",
    trueStatements: ["a", "b"],
    keyMessages: ["m"],
  });
  assert.deepEqual(quick.trueStatements, []);
  assert.deepEqual(quick.keyMessages, []);
  const many = normaliseInput({
    depth: "messages",
    audience: "general",
    purpose: "other",
    falseStatements: Array.from({ length: 9 }, (_, i) => `s${i}`),
  });
  assert.equal(many.falseStatements.length, 5);
});

test("heuristic fallback matches wording but leaves false statements ambiguous", async () => {
  const c = await runComprehension(letter, input, heuristicModel);
  const by = (s: string) => c.results.find((r) => r.statement.includes(s))!;
  assert.equal(by("lose all interest").outcome, "clear");
  assert.equal(by("rate is variable").outcome, "ambiguous");
  assert.ok(c.clarity >= 0 && c.clarity <= 100);
});
