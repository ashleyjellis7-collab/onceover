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
import { ReadAssetError, readAsset } from "@/engine/read-asset";
import { hasBypass } from "@/lib/bypass";
import {
  ANON_DAILY_LIMIT,
  consumeRateLimit,
  flagFinding,
  saveReport,
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

export async function checkAsset(_prev: CheckState, form: FormData): Promise<CheckState> {
  const checker = form.get("checker");
  const assetType = form.get("assetType");
  if (!isChecker(checker) || !isAssetType(assetType)) return { error: "Choose an asset type first." };

  const copy = String(form.get("copy") ?? "").trim();
  const url = String(form.get("url") ?? "").trim();
  const file = form.get("file");
  const upload = file instanceof File && file.size > 0 ? file : null;
  if (copy.length > MAX_TEXT) return { error: "That's too long. Paste up to 50,000 characters." };
  if (!copy && !url && !upload) return { error: "Add the asset's copy, a link or an upload." };

  const socialLink = url && isUnfetchableSocialLink(url);
  if (socialLink && !copy && !upload) {
    return {
      error:
        "We can't read Facebook Ad Library or social post links directly, because they need a login. Add a screenshot of the ad or paste its copy, and keep the link for your records.",
    };
  }

  if (!(await hasBypass()) && !(await consumeRateLimit(await clientIp()))) {
    return { error: `You've used today's ${ANON_DAILY_LIMIT} free tests. Try again tomorrow.` };
  }

  const started = Date.now();
  const parts: string[] = [];
  if (copy) parts.push(copy);
  let inputType: "url" | "text" | "image" | "pdf" = "text";
  let layout: unknown = null;
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

  const text = parts.join("\n\n").slice(0, MAX_TEXT);
  const product = form.get("product");
  const result = await check(text, {
    checker,
    product: isProduct(product) ? product : null,
    channel: ASSET_CHANNEL[assetType],
  });

  const id = await saveReport({
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
  const id = await saveReport({ assetVersionId: version.id, result, durationMs: Date.now() - started });
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
