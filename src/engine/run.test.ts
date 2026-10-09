import { test } from "node:test";
import assert from "node:assert/strict";
import { ruleSetV01 } from "../rules/v0.1";
import { runChecks } from "./run";
import { score } from "./score";
import { htmlToText } from "./fetch-url";

test("worked example from the brief: crypto sign-up bonus, no warning", async () => {
  const r = await runChecks("Get £50 of free Bitcoin when you sign up! #ad link in bio", ruleSetV01);
  const band = (id: string) => r.findings.find((f) => f.ruleId === id)?.band;
  assert.equal(r.product, "crypto");
  assert.equal(r.channel, "social");
  assert.equal(band("COBS-4.12A.7R-incentives"), "issue");
  assert.equal(band("COBS-4.12A-risk-warning"), "issue");
  assert.equal(band("COBS-4.12A-take-2-mins"), "issue");
  assert.ok(r.finpromScore !== null && r.finpromScore <= 49);
});

test("prescribed warning is recognised", async () => {
  const r = await runChecks(
    "Buy Bitcoin with ExampleCoin Ltd. Don't invest unless you're prepared to lose all the money you invest. This is a high-risk investment and you are unlikely to be protected if something goes wrong. Take 2 mins to learn more.",
    ruleSetV01,
    { channel: "website" },
  );
  const band = (id: string) => r.findings.find((f) => f.ruleId === id)?.band;
  assert.equal(band("COBS-4.12A-risk-warning"), "clear");
  assert.equal(band("COBS-4.12A-take-2-mins"), "clear");
});

test("savings ad is not marked down for a crypto warning", async () => {
  const r = await runChecks("Our easy access savings account pays 4.1% AER.", ruleSetV01);
  assert.equal(r.product, "savings");
  assert.ok(!r.findings.some((f) => f.ruleId === "COBS-4.12A-risk-warning"));
});

test("non-promotion gets Consumer Duty only", async () => {
  const r = await runChecks("Our office is closed on bank holidays.", ruleSetV01);
  assert.equal(r.isPromotion, false);
  assert.equal(r.finpromScore, null);
  assert.ok(r.findings.every((f) => f.score === "consumer_duty"));
});

test("score formula and critical cap", () => {
  assert.equal(score([]), 100);
  assert.equal(score([{ band: "review", severity: "major" }]), 95);
  assert.equal(score([{ band: "issue", severity: "critical" }]), 49);
});

test("htmlToText strips scripts and decodes entities once", () => {
  assert.equal(htmlToText("<script>x</script><p>A &amp;lt; B &pound;5</p>"), "A &lt; B £5");
});
