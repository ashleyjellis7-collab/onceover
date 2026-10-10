"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { latestRuleSet } from "@/rules";
import { runChecks } from "@/engine/run";
import { FetchError, fetchPageText } from "@/engine/fetch-url";
import { decisionModel } from "@/engine/jev";
import { heuristicModel, isChannel, isProduct } from "@/engine/model";
import { ANON_DAILY_LIMIT, consumeRateLimit, flagFinding, saveReport } from "@/lib/reports";

const MAX_TEXT = 50_000;

export type CheckState = { error?: string };

export async function checkAsset(_prev: CheckState, form: FormData): Promise<CheckState> {
  const input = String(form.get("input") ?? "").trim();
  if (!input) return { error: "Paste a URL or some text to check." };
  if (input.length > MAX_TEXT) return { error: "That's too long. Paste up to 50,000 characters." };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  if (!(await consumeRateLimit(ip))) {
    return { error: `You've used today's ${ANON_DAILY_LIMIT} free tests. Try again tomorrow.` };
  }

  const started = Date.now();
  const isUrl = /^https?:\/\/\S+$/i.test(input);
  let text = input;
  let sourceUrl: string | null = null;
  if (isUrl) {
    try {
      const page = await fetchPageText(input);
      text = page.text.slice(0, MAX_TEXT);
      sourceUrl = page.url;
    } catch (e) {
      if (e instanceof FetchError) return { error: e.message };
      return { error: "Could not fetch that page. Try pasting its text instead." };
    }
    if (!text) return { error: "That page has no readable text. Try pasting its text instead." };
  }

  const product = form.get("product");
  const channel = form.get("channel");
  const opts = {
    product: isProduct(product) ? product : null,
    channel: isChannel(channel) ? channel : null,
  };
  let result;
  try {
    result = await runChecks(text, latestRuleSet, opts, decisionModel());
  } catch (e) {
    // Jev unavailable: fall back so the user still gets a report. The report
    // records the model that actually decided.
    console.error("Decision model failed; falling back to heuristic", e);
    result = await runChecks(text, latestRuleSet, opts, heuristicModel);
    result.modelVersion += " (Jev call failed)";
  }

  const id = await saveReport({
    inputType: isUrl ? "url" : "text",
    sourceUrl,
    text,
    result,
    durationMs: Date.now() - started,
  });
  redirect(`/r/${id}`);
}

export async function reportWrong(form: FormData) {
  const testId = String(form.get("testId") ?? "");
  const findingId = String(form.get("findingId") ?? "");
  if (testId && findingId) await flagFinding(testId, findingId);
  refresh();
}
