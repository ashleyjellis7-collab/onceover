// Syncs the rule sets in src/rules into the rule_sets and rules tables.
// Run after migrations: `npm run db:seed`.
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../src/db/schema";
import { ruleSets } from "../src/rules";

config({ path: [".env.local", ".env"], quiet: true });

const db = drizzle(
  createClient({
    url: process.env.TURSO_DATABASE_URL ?? "file:local.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  }),
  { schema },
);

// RegExp values don't survive JSON, so store their source text.
const toJson = (v: unknown) =>
  JSON.parse(JSON.stringify(v, (_k, x) => (x instanceof RegExp ? x.toString() : x)));

for (const rs of ruleSets) {
  await db
    .insert(schema.ruleSets)
    .values({ version: rs.version, releasedAt: rs.releasedAt, changelog: rs.changelog })
    .onConflictDoUpdate({
      target: schema.ruleSets.version,
      set: { releasedAt: rs.releasedAt, changelog: rs.changelog },
    });
  for (const r of rs.rules) {
    await db
      .insert(schema.rules)
      .values({ id: r.id, ruleSetVersion: rs.version, score: r.score, record: toJson(r) })
      .onConflictDoUpdate({
        target: [schema.rules.id, schema.rules.ruleSetVersion],
        set: { score: r.score, record: toJson(r) },
      });
  }
  console.log(`Seeded ${rs.version}: ${rs.rules.length} rules`);
}
