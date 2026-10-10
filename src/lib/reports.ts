import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CheckResult } from "@/engine/run";
import type { ComprehensionResult } from "@/engine/comprehension";

const ANON_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // report links last 30 days
export const ANON_DAILY_LIMIT = 5;

const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function publicId(len = 12) {
  const bytes = randomBytes(len);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export type AssetType = NonNullable<typeof schema.assetVersions.$inferInsert.assetType>;

type NewAsset = {
  inputType: "url" | "text" | "image" | "pdf";
  assetType: AssetType | null;
  sourceUrl: string | null;
  text: string;
  layout: unknown;
  name: string;
};

/**
 * Saves a test and its findings. Pass `asset` for a new upload, or
 * `assetVersionId` to run another check against an asset already saved.
 */
export async function saveReport(
  input: { result: CheckResult; comprehension?: ComprehensionResult | null; durationMs: number } & (
    | { asset: NewAsset; assetVersionId?: never }
    | { assetVersionId: string; asset?: never }
  ),
) {
  const testId = publicId();
  const { result } = input;
  const versionId = input.assetVersionId ?? randomUUID();
  const assetWrites = [];
  if (input.asset) {
    const assetId = randomUUID();
    const a = input.asset;
    assetWrites.push(
      db.insert(schema.assets).values({ id: assetId, name: a.name.slice(0, 120) }),
      db.insert(schema.assetVersions).values({
        id: versionId,
        assetId,
        inputType: a.inputType,
        assetType: a.assetType,
        sourceUrl: a.sourceUrl,
        extractedText: a.text,
        layout: a.layout ?? null,
        fileHash: createHash("sha256").update(a.text).digest("hex"),
      }),
    );
  }

  await db.batch([
    ...assetWrites,
    db.insert(schema.tests).values({
      id: testId,
      assetVersionId: versionId,
      checker: result.checker,
      ruleSetVersion: result.ruleSetVersion,
      modelVersion: result.modelVersion,
      product: result.product,
      channel: result.channel,
      isPromotion: result.isPromotion,
      finpromScore: result.finpromScore,
      consumerDutyScore: result.consumerDutyScore,
      comprehension: input.comprehension ?? null,
      durationMs: input.durationMs,
      expiresAt: new Date(Date.now() + ANON_RETENTION_MS),
    }),
    ...(result.findings.length
      ? [
          db.insert(schema.findings).values(
            result.findings.map((f) => ({
              id: randomUUID(),
              testId,
              ruleId: f.ruleId,
              score: f.score,
              band: f.band,
              severity: f.severity,
              probability: f.probability,
              decidedBy: f.decidedBy,
              evidence: f.evidence,
              explanation: f.explanation,
              suggestion: f.suggestion,
            })),
          ),
        ]
      : []),
  ] as unknown as Parameters<typeof db.batch>[0]);
  return testId;
}

export async function getReport(id: string) {
  const test = await db.query.tests.findFirst({
    where: eq(schema.tests.id, id),
  });
  if (!test) return null;
  if (test.expiresAt && test.expiresAt.getTime() < Date.now()) return null;
  const [version, rows] = await Promise.all([
    db.query.assetVersions.findFirst({
      where: eq(schema.assetVersions.id, test.assetVersionId),
    }),
    db.query.findings.findMany({ where: eq(schema.findings.testId, id) }),
  ]);
  const outcome = await db.query.complianceOutcomes.findFirst({
    where: eq(schema.complianceOutcomes.testId, id),
  });
  return {
    test,
    version,
    findings: rows,
    comprehension: (test.comprehension ?? null) as ComprehensionResult | null,
    outcome: outcome ?? null,
  };
}

export async function flagFinding(testId: string, findingId: string) {
  await db
    .update(schema.findings)
    .set({ flaggedWrong: true })
    .where(and(eq(schema.findings.id, findingId), eq(schema.findings.testId, testId)));
}

export type ComplianceOutcome = typeof schema.complianceOutcomes.$inferInsert.outcome;

/**
 * Records what the firm's compliance team decided. With consent, the report and
 * asset are kept (no expiry) so a reviewer can add them to the labelled test set;
 * withdrawing consent restores the normal 30-day expiry.
 */
export async function saveComplianceOutcome(
  testId: string,
  outcome: ComplianceOutcome,
  note: string | null,
  consent: boolean,
) {
  const test = await db.query.tests.findFirst({ where: eq(schema.tests.id, testId) });
  if (!test) return;
  const expiresAt = consent ? null : new Date(test.createdAt.getTime() + ANON_RETENTION_MS);
  await db.batch([
    db
      .insert(schema.complianceOutcomes)
      .values({ testId, outcome, note, consentToImprove: consent, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: schema.complianceOutcomes.testId,
        set: { outcome, note, consentToImprove: consent, reviewStatus: "new", updatedAt: new Date() },
      }),
    db.update(schema.tests).set({ expiresAt }).where(eq(schema.tests.id, testId)),
  ]);
}

/** Returns false once the caller has used up today's anonymous tests. */
export async function consumeRateLimit(ip: string, bucket = "test", limit = ANON_DAILY_LIMIT) {
  const day = new Date().toISOString().slice(0, 10);
  const salt = process.env.RATE_LIMIT_SALT ?? "dev";
  // Each bucket gets its own allowance; the "test" bucket keeps the original key format.
  const id = bucket === "test" ? salt + ip : `${salt}:${bucket}:${ip}`;
  const key = `${createHash("sha256").update(id).digest("hex").slice(0, 32)}:${day}`;
  const [row] = await db
    .insert(schema.rateLimits)
    .values({ key, count: 1 })
    .onConflictDoUpdate({
      target: schema.rateLimits.key,
      set: { count: sql`${schema.rateLimits.count} + 1` },
    })
    .returning({ count: schema.rateLimits.count });
  return row.count <= limit;
}

/** Deletes expired anonymous reports and old rate-limit rows. Run daily by Vercel Cron. */
export async function cleanupExpired() {
  const now = Date.now();
  // Explicit deletes rather than relying on ON DELETE CASCADE, which SQLite
  // only enforces when foreign keys are switched on for the connection.
  const expired = sql`SELECT id FROM tests WHERE expires_at IS NOT NULL AND expires_at < ${now}`;
  const [, , res] = await db.batch([
    db.run(sql`DELETE FROM compliance_outcomes WHERE test_id IN (${expired})`),
    db.run(sql`DELETE FROM findings WHERE test_id IN (${expired})`),
    db.run(sql`DELETE FROM tests WHERE id IN (${expired})`),
  ]);
  await db.batch([
    db.run(sql`DELETE FROM asset_versions WHERE id NOT IN (SELECT asset_version_id FROM tests)
      AND asset_id IN (SELECT id FROM assets WHERE workspace_id IS NULL)`),
    db.run(sql`DELETE FROM assets WHERE workspace_id IS NULL AND id NOT IN (SELECT asset_id FROM asset_versions)`),
    db.run(sql`DELETE FROM rate_limits WHERE substr(key, 34) < ${new Date(now).toISOString().slice(0, 10)}`),
  ]);
  return { deletedTests: res.rowsAffected };
}
