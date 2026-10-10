"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { latestRuleSet, type Channel, type ScoreKind } from "@/rules";
import { runChecks, type CheckResult } from "@/engine/run";
import { FetchError, fetchPageText } from "@/engine/fetch-url";
import { decisionModel } from "@/engine/jev";
import { heuristicModel, isProduct, type DecisionModel } from "@/engine/model";
import { ReadAssetError, readAsset, type AssetReading } from "@/engine/read-asset";
import {
  AUDIENCES,
  DEPTHS,
  PURPOSES,
  normaliseInput,
  runComprehension,
  type ComprehensionInput,
  type ComprehensionResult,
} from "@/engine/comprehension";
import { SuggestError, suggestStatements, type Suggestions } from "@/engine/suggest";
import { hasBypass } from "@/lib/bypass";
import {
  ANON_DAILY_LIMIT,
  consumeRateLimit,
  flagFinding,
  saveComplianceOutcome,
  saveReport,
  type ComplianceOutcome,
  type AssetType,
} from "@/lib/reports";

const MAX_TEXT = 50_000;

const ASSET_CHANNEL: Record<AssetType, Channel | null> = {
  social: "social",
  webpage: "website",
  display_ad: "display_ad",
  email: "email",
  brochure: "print",
  text: null,
};

const isAssetType = (v: unknown): v is AssetType =>
  typeof v === "string" && v in ASSET_CHANNEL;
const isChecker = (v: unknown): v is ScoreKind => v === "finprom" || v === "consumer_duty";

/** Links to social posts and the Meta Ad Library sit behind logins and scripts, so they can't be fetched. */
function isUnfetchableSocialLink(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return /(^|\.)(facebook|instagram|tiktok|x|twitter|linkedin|threads)\.(com|net)$/.test(host) ||
      host === "fb.com";
  } catch {
    return false;
  }
}

export type CheckState = { error?: string };

type GatheredAsset = {
  text: string;
  layout: AssetReading | null;
  inputType: "url" | "text" | "image" | "pdf";
  sourceUrl: string | null;
  upload: File | null;
};

/** Cheap checks on the asset fields, before any rate limit is spent. */
function validateAssetFields(form: FormData): string | null {
  const copy = String(form.get("copy") ?? "").trim();
  const url = String(form.get("url") ?? "").trim();
  const file = form.get("file");
  const upload = file instanceof File && file.size > 0 ? file : null;
  if (copy.length > MAX_TEXT) return "That's too long. Paste up to 50,000 characters.";
  if (!copy && !url && !upload) return "Add the asset's copy, a link or an upload.";
  if (url && isUnfetchableSocialLink(url) && !copy && !upload) {
    return "We can't read Facebook Ad Library or social post links directly, because they need a login. Add a screenshot of the ad or paste its copy, and keep the link for your records.";
  }
  return null;
}

/** Builds the text record from pasted copy, a fetched page and/or an uploaded file. */
async function gatherAsset(form: FormData): Promise<GatheredAsset | { error: string }> {
  const copy = String(form.get("copy") ?? "").trim();
  const url = String(form.get("url") ?? "").trim();
  const file = form.get("file");
  const upload = file instanceof File && file.size > 0 ? file : null;
  const socialLink = Boolean(url) && isUnfetchableSocialLink(url);

  const parts: string[] = [];
  if (copy) parts.push(copy);
  let inputType: GatheredAsset["inputType"] = "text";
  let layout: AssetReading | null = null;
  let sourceUrl: string | null = null;

  if (url && !socialLink) {
    try {
      const page = await fetchPageText(url);
      if (!page.text) return { error: "That page has no readable text. Upload a screenshot instead." };
      parts.push(page.text);
      sourceUrl = page.url;
      inputType = "url";
    } catch (e) {
      if (e instanceof FetchError) return { error: e.message };
      return { error: "Could not fetch that page. Upload a screenshot instead." };
    }
  } else if (socialLink) {
    sourceUrl = url;
  }

  if (upload) {
    try {
      const read = await readAsset(upload);
      parts.push(read.text);
      layout = read.reading;
      inputType = read.kind;
    } catch (e) {
      if (e instanceof ReadAssetError) return { error: e.message };
      console.error("Reading the upload failed", e);
      return { error: "We couldn't read that file. Try again, or paste the text instead." };
    }
  }

  return { text: parts.join("\n\n").slice(0, MAX_TEXT), layout, inputType, sourceUrl, upload };
}

export async function checkAsset(_prev: CheckState, form: FormData): Promise<CheckState> {
  const checker = form.get("checker");
  const assetType = form.get("assetType");
  if (!isChecker(checker) || !isAssetType(assetType)) return { error: "Choose an asset type first." };

  const comprehensionInput = checker === "consumer_duty" ? readComprehensionInput(form) : null;
  const precheck = validateAssetFields(form);
  if (precheck) return { error: precheck };

  if (!(await hasBypass()) && !(await consumeRateLimit(await clientIp()))) {
    return { error: `You've used today's ${ANON_DAILY_LIMIT} free tests. Try again tomorrow.` };
  }

  const started = Date.now();
  const asset = await gatherAsset(form);
  if ("error" in asset) return { error: asset.error };
  const { text, layout, inputType, sourceUrl, upload } = asset;
  const product = form.get("product");
  const result = await check(text, {
    checker,
    product: isProduct(product) ? product : null,
    channel: ASSET_CHANNEL[assetType],
  });

  const comprehension = comprehensionInput
    ? await comprehend(text, comprehensionInput, layout)
    : null;

  const id = await saveReport({
    comprehension,
    asset: {
      inputType,
      assetType,
      sourceUrl,
      text,
      layout,
      name: sourceUrl ?? upload?.name ?? text.slice(0, 60),
    },
    result,
    durationMs: Date.now() - started,
  });
  redirect(`/r/${id}`);
}

/** Runs the other checker against an asset that has already been checked. */
export async function checkSameAsset(form: FormData) {
  const testId = String(form.get("testId") ?? "");
  const checker = form.get("checker");
  if (!isChecker(checker)) return;
  const test = await db.query.tests.findFirst({ where: eq(schema.tests.id, testId) });
  if (!test) return;
  const version = await db.query.assetVersions.findFirst({
    where: eq(schema.assetVersions.id, test.assetVersionId),
  });
  if (!version) return;
  if (!(await hasBypass()) && !(await consumeRateLimit(await clientIp()))) {
    redirect(`/r/${testId}?limit=1`);
  }

  const started = Date.now();
  const result = await check(version.extractedText, {
    checker,
    product: isProduct(test.product) ? test.product : null,
    channel: (test.channel as Channel | null) ?? null,
  });
  const comprehension =
    checker === "consumer_duty"
      ? await comprehend(
          version.extractedText,
          normaliseInput({ depth: "quick", audience: "general", purpose: "other" }),
          (version.layout ?? null) as AssetReading | null,
        )
      : null;
  const id = await saveReport({
    assetVersionId: version.id,
    result,
    comprehension,
    durationMs: Date.now() - started,
  });
  redirect(`/r/${id}`);
}

async function check(
  text: string,
  opts: Parameters<typeof runChecks>[2],
): Promise<CheckResult> {
  const model: DecisionModel = decisionModel();
  try {
    return await runChecks(text, latestRuleSet, opts, model);
  } catch (e) {
    // Jev unavailable: fall back so the user still gets a report. The report
    // records the model that actually decided.
    console.error("Decision model failed; falling back to heuristic", e);
    const result = await runChecks(text, latestRuleSet, opts, heuristicModel);
    result.modelVersion += " (Jev call failed)";
    return result;
  }
}

function readComprehensionInput(form: FormData): ComprehensionInput {
  const pick = <T extends string>(name: string, options: Record<T, unknown>, fallback: T): T => {
    const v = String(form.get(name) ?? "");
    return v in options ? (v as T) : fallback;
  };
  const lines = (name: string) => String(form.get(name) ?? "").split(/\r?\n/);
  return normaliseInput({
    depth: pick("depth", DEPTHS, "quick"),
    audience: pick("audience", AUDIENCES, "general"),
    purpose: pick("purpose", PURPOSES, "other"),
    callToAction: String(form.get("callToAction") ?? ""),
    keyMessages: lines("keyMessages"),
    trueStatements: lines("trueStatements"),
    falseStatements: lines("falseStatements"),
  });
}

async function comprehend(
  text: string,
  input: ComprehensionInput,
  reading: AssetReading | null,
): Promise<ComprehensionResult> {
  try {
    return await runComprehension(text, input, decisionModel(), reading);
  } catch (e) {
    console.error("Comprehension test failed on Jev; falling back to heuristic", e);
    const result = await runComprehension(text, input, heuristicModel, reading);
    result.modelVersion += " (Jev call failed)";
    return result;
  }
}

const SUGGEST_DAILY_LIMIT = 10;

export type SuggestState = { suggestions?: Suggestions; error?: string };

/** Drafts comprehension statements from the asset currently in the form. */
export async function suggestFromAsset(form: FormData): Promise<SuggestState> {
  const precheck = validateAssetFields(form);
  if (precheck) return { error: precheck };
  if (!(await hasBypass()) && !(await consumeRateLimit(await clientIp(), "suggest", SUGGEST_DAILY_LIMIT))) {
    return { error: `You've used today's ${SUGGEST_DAILY_LIMIT} suggestions. Write the statements yourself, or try tomorrow.` };
  }
  const asset = await gatherAsset(form);
  if ("error" in asset) return { error: asset.error };
  const { depth, audience, purpose } = readComprehensionInput(form);
  try {
    return { suggestions: await suggestStatements(asset.text, { depth, audience, purpose }) };
  } catch (e) {
    if (e instanceof SuggestError) return { error: e.message };
    console.error("Suggesting statements failed", e);
    return { error: "We couldn't suggest statements right now. Try again, or write them yourself." };
  }
}

const OUTCOMES: ComplianceOutcome[] = ["approved", "approved_with_changes", "rejected", "not_reviewed"];

export async function recordComplianceOutcome(form: FormData) {
  const testId = String(form.get("testId") ?? "");
  const outcome = String(form.get("outcome") ?? "") as ComplianceOutcome;
  if (!testId || !OUTCOMES.includes(outcome)) return;
  const note = String(form.get("note") ?? "").trim().slice(0, 2000) || null;
  await saveComplianceOutcome(testId, outcome, note, form.get("consent") === "on");
  refresh();
}

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

export async function reportWrong(form: FormData) {
  const testId = String(form.get("testId") ?? "");
  const findingId = String(form.get("findingId") ?? "");
  if (testId && findingId) await flagFinding(testId, findingId);
  refresh();
}
