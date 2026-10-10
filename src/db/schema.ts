import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

// Data model from the product brief ("Logged-in state → Data model").
// Timestamps are stored as unix epoch milliseconds.

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  signInMethod: text("sign_in_method", {
    enum: ["magic_link", "google", "microsoft"],
  }).notNull(),
  createdAt: createdAt(),
});

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  plan: text("plan", { enum: ["free", "pro", "team", "enterprise"] })
    .notNull()
    .default("free"),
  retentionDays: integer("retention_days").notNull().default(30),
  // Per-workspace confidence thresholds and other settings, as JSON.
  settings: text("settings", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: createdAt(),
});

export const workspaceMembers = sqliteTable(
  "workspace_members",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["marketer", "reviewer", "admin"] }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })],
);

// Rule records are authored in src/rules and synced here by `npm run db:seed`.
export const ruleSets = sqliteTable("rule_sets", {
  version: text("version").primaryKey(), // e.g. "v1.0"
  releasedAt: text("released_at").notNull(), // ISO date
  changelog: text("changelog").notNull(),
});

export const rules = sqliteTable(
  "rules",
  {
    id: text("id").notNull(), // e.g. "COBS-4.12A.7R-incentives"
    ruleSetVersion: text("rule_set_version")
      .notNull()
      .references(() => ruleSets.version),
    score: text("score", { enum: ["finprom", "consumer_duty"] }).notNull(),
    record: text("record", { mode: "json" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.id, t.ruleSetVersion] })],
);

export const assets = sqliteTable("assets", {
  id: text("id").primaryKey(),
  // Null for anonymous tests.
  workspaceId: text("workspace_id").references(() => workspaces.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export const assetVersions = sqliteTable("asset_versions", {
  id: text("id").primaryKey(),
  assetId: text("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "cascade" }),
  inputType: text("input_type", {
    enum: ["url", "text", "image", "pdf"],
  }).notNull(),
  assetType: text("asset_type", {
    enum: ["social", "webpage", "display_ad", "email", "brochure", "text"],
  }),
  sourceUrl: text("source_url"),
  extractedText: text("extracted_text").notNull(),
  layout: text("layout", { mode: "json" }),
  screenshotKey: text("screenshot_key"),
  fileHash: text("file_hash").notNull(),
  createdAt: createdAt(),
});

export const tests = sqliteTable(
  "tests",
  {
    id: text("id").primaryKey(), // public, unguessable; used in /r/<id>
    assetVersionId: text("asset_version_id")
      .notNull()
      .references(() => assetVersions.id, { onDelete: "cascade" }),
    // Which checker ran. Null on reports made before the tool was split in two.
    checker: text("checker", { enum: ["finprom", "consumer_duty"] }),
    ruleSetVersion: text("rule_set_version").notNull(),
    modelVersion: text("model_version").notNull(),
    product: text("product"),
    audience: text("audience"),
    channel: text("channel"),
    isPromotion: integer("is_promotion", { mode: "boolean" }).notNull(),
    finpromScore: integer("finprom_score"),
    consumerDutyScore: integer("consumer_duty_score"),
    // Consumer Duty comprehension pre-test: the user's inputs and the predicted results.
    comprehension: text("comprehension", { mode: "json" }),
    durationMs: integer("duration_ms").notNull(),
    // Anonymous reports expire; saved reports have this cleared.
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("tests_expires_at_idx").on(t.expiresAt)],
);

export const findings = sqliteTable(
  "findings",
  {
    id: text("id").primaryKey(),
    testId: text("test_id")
      .notNull()
      .references(() => tests.id, { onDelete: "cascade" }),
    ruleId: text("rule_id").notNull(),
    score: text("score", { enum: ["finprom", "consumer_duty"] }).notNull(),
    band: text("band", { enum: ["issue", "review", "clear"] }).notNull(),
    severity: text("severity", {
      enum: ["critical", "major", "minor"],
    }).notNull(),
    probability: real("probability").notNull(),
    decidedBy: text("decided_by", { enum: ["code", "model"] }).notNull(),
    evidence: text("evidence"),
    explanation: text("explanation").notNull(),
    suggestion: text("suggestion"),
    reviewerNote: text("reviewer_note"),
    flaggedWrong: integer("flagged_wrong", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => [index("findings_test_id_idx").on(t.testId)],
);

// "What did compliance decide?" on a report. With consent, the asset is kept
// past the anonymous retention window so it can join the labelled test set.
export const complianceOutcomes = sqliteTable("compliance_outcomes", {
  testId: text("test_id")
    .primaryKey()
    .references(() => tests.id, { onDelete: "cascade" }),
  outcome: text("outcome", {
    enum: ["approved", "approved_with_changes", "rejected", "not_reviewed"],
  }).notNull(),
  note: text("note"),
  consentToImprove: integer("consent_to_improve", { mode: "boolean" }).notNull().default(false),
  reviewStatus: text("review_status", { enum: ["new", "confirmed", "dismissed"] })
    .notNull()
    .default("new"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const watches = sqliteTable("watches", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  assetId: text("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  schedule: text("schedule", { enum: ["weekly", "daily", "hourly"] }).notNull(),
  alertSettings: text("alert_settings", { mode: "json" }),
  lastCheckedAt: integer("last_checked_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
});

export const snapshots = sqliteTable("snapshots", {
  id: text("id").primaryKey(),
  watchId: text("watch_id")
    .notNull()
    .references(() => watches.id, { onDelete: "cascade" }),
  fingerprints: text("fingerprints", { mode: "json" }).notNull(),
  // Set when the content changed and became a new asset version.
  assetVersionId: text("asset_version_id").references(() => assetVersions.id),
  fetchStatus: text("fetch_status", {
    enum: ["ok", "could_not_fetch"],
  }).notNull(),
  createdAt: createdAt(),
});

export const alerts = sqliteTable("alerts", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  testId: text("test_id")
    .notNull()
    .references(() => tests.id, { onDelete: "cascade" }),
  trigger: text("trigger", {
    enum: ["new_issue", "score_drop", "rule_set_update"],
  }).notNull(),
  channel: text("channel", { enum: ["email", "slack"] }).notNull(),
  readAt: integer("read_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
});

// Anonymous rate limiting (5 tests a day per IP on the free tier).
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(), // "<hashed ip>:<yyyy-mm-dd>"
  count: integer("count").notNull().default(0),
});
