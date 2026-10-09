import { test } from "node:test";
import assert from "node:assert/strict";
import { ruleSetV01 } from "../rules/v0.1";
import { JEV_MODEL, jevModel } from "./jev";
import { runChecks } from "./run";

type Body = { model: string; state: string; questions: Record<string, { type: string; instructions?: string }> };

// Fake TypeSafe API: answers "yes" to the incentive question, but only for the sentence that offers it.
const calls: Body[] = [];
process.env.TYPESAFE_API_KEY = "test-key";
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  assert.equal(url, "https://api.typesafe.ai/v1/systemone");
  const body = JSON.parse(String(init?.body)) as Body;
  calls.push(body);
  const answers: Record<string, unknown> = {};
  for (const [key, q] of Object.entries(body.questions)) {
    if (q.type === "choice") {
      const choice = key === "product" ? "crypto" : "social";
      answers[key] = { type: "choice", choice, confidence: 0.9, probabilities: { [choice]: 0.9 } };
    } else {
      const yes =
        key === "isPromotion" ||
        (/bonus, cashback/.test(q.instructions ?? "") && /free Bitcoin/.test(body.state));
      answers[key] = { type: "noul", noul: yes ? 0.93 : 0.04 };
    }
  }
  return Response.json({ model: body.model, answers, usage: { input_tokens: 10, output_tokens: 0 } });
}) as typeof fetch;

test("Jev adapter: pinned model, typed answers mapped to findings and evidence", async () => {
  const text = "Get £50 of free Bitcoin when you sign up. Trade 24/7 on our app.";
  const r = await runChecks(text, ruleSetV01, {}, jevModel);

  assert.ok(calls.every((c) => c.model === JEV_MODEL));
  assert.equal(r.modelVersion, JEV_MODEL);
  assert.equal(r.product, "crypto");
  assert.equal(r.channel, "social");

  const incentive = r.findings.find((f) => f.ruleId === "COBS-4.12A.7R-incentives");
  assert.equal(incentive?.band, "issue");
  assert.equal(incentive?.evidence, "Get £50 of free Bitcoin when you sign up.");
  // Jev said no to the others, so they are Clear and skipped the evidence search.
  assert.equal(r.findings.find((f) => f.ruleId === "FG21-1-false-urgency")?.band, "clear");
  // Code checks still decide exact wording.
  assert.equal(r.findings.find((f) => f.ruleId === "COBS-4.12A-risk-warning")?.decidedBy, "code");
});
