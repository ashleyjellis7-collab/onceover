import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenMatches } from "./bypass";

test("bypass token falls back to CRON_SECRET and must match exactly", () => {
  delete process.env.BYPASS_TOKEN;
  process.env.CRON_SECRET = "abc123";
  assert.equal(tokenMatches("abc123"), true);
  assert.equal(tokenMatches(" abc123 "), true);
  assert.equal(tokenMatches("abc12"), false);
  process.env.BYPASS_TOKEN = "other";
  assert.equal(tokenMatches("abc123"), false);
  assert.equal(tokenMatches("other"), true);
});
