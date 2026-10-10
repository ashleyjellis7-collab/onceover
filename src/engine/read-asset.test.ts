import { test } from "node:test";
import assert from "node:assert/strict";
import { readAsset, readingToText, ReadAssetError } from "./read-asset";
import { runChecks } from "./run";
import { ruleSetV01 } from "../rules/v0.1";

const reading = {
  contains_text: true,
  visual_description: "A phone showing a Bitcoin price chart.",
  elements: [
    { role: "headline" as const, text: "Get £50 free Bitcoin", size: "large" as const, position: "top" as const, contrast: "high" as const, in_border: false },
    { role: "small_print" as const, text: "Don't invest unless you're prepared to lose all the money you invest. This is a high-risk investment.", size: "tiny" as const, position: "bottom" as const, contrast: "low" as const, in_border: false },
  ],
};

test("an image reading becomes a text record the engine can check", async () => {
  const text = readingToText(reading);
  assert.equal(text.split("\n\n").length, 2);
  const r = await runChecks(text, ruleSetV01, { checker: "finprom", channel: "display_ad" });
  const band = (id: string) => r.findings.find((f) => f.ruleId === id)?.band;
  assert.equal(band("COBS-4.12A.7R-incentives"), "issue");
  assert.equal(band("COBS-4.12A-risk-warning"), "clear"); // short-form warning is present
});

test("uploads give a clear error when the reader isn't configured", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const file = new File([new Uint8Array([1, 2, 3])], "ad.png", { type: "image/png" });
  await assert.rejects(readAsset(file), ReadAssetError);
});
