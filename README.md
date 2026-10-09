# Onceover

A free Finprom & Consumer Duty pre-check: paste a URL or the text of a financial promotion
and get a PageSpeed-style report with two scores and the rule behind every finding.
It is a pre-check, never an approval.

Stack: Next.js 16 (App Router) on **Vercel**, **Turso** (libSQL) with Drizzle ORM.

## What's built so far (Phase 1, open beta slice)

- `/`: one box for a URL or pasted text, plus optional product and channel.
- `/r/<id>`: shareable report. It shows two gauges, findings grouped Issue / Review / Clear,
  the evidence sentence, the suggestion and a "This finding looks wrong" button. It is `noindex`.
- `/methodology`: every rule, the question asked, the thresholds, the score formula and a changelog.
- Rule set `v0.1` in `src/rules/` holds 21 starter rule records. They are a draft that a
  compliance reviewer still needs to check.
- `src/engine/` holds the engine. It runs applicability gates, then code checks (exact wording,
  reading age, layout) and judgement checks through a swappable `DecisionModel`, then scores.
- Anonymous limit of 5 tests a day per IP. Reports expire after 30 days. A daily cron deletes them.
- The URL fetcher has SSRF guards: it blocks private IPs and caps redirects, size and time.

Not built yet:

- **Jev is not wired in.** `heuristicModel` in `src/engine/model.ts` is a keyword stand-in.
  Implement the `DecisionModel` interface once Jev's API and terms are confirmed.
- Image and PDF upload (needs OCR and a vision model).
- JS rendering and screenshots (the separate Playwright worker).
- Sign-in, monitoring, alerts and Stripe. The database tables for these already exist.

## Local development

```bash
npm install
npm run db:migrate   # creates local.db when TURSO_* is unset
npm run db:seed      # syncs rule records into the rules tables
npm run dev
npm test
```

## Create the Turso database

```bash
# Install the CLI: https://docs.turso.tech/cli/installation
turso auth login
turso db create onceover --location aws-eu-west-2   # London; any UK/EU region works
turso db show onceover --url                         # -> TURSO_DATABASE_URL
turso db tokens create onceover                      # -> TURSO_AUTH_TOKEN
```

Put both values in `.env.local` (see `.env.example`), then apply the schema and seed the rules:

```bash
npm run db:migrate
npm run db:seed
```

Run `npm run db:generate` after changing `src/db/schema.ts`, then run `db:migrate` again.

## Deploy to Vercel

1. Push this repo to GitHub, then in Vercel choose **Add New → Project** and import it.
   The framework is detected as Next.js and needs no build settings.
2. Under **Settings → Environment Variables**, add:
   - `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`, from the Turso step above.
   - `CRON_SECRET`, any long random string. Vercel sends it to the cleanup cron.
   - `RATE_LIMIT_SALT`, any long random string.

   Alternatively, add the **Turso** integration from the Vercel Marketplace. It creates the
   database and sets the database URL and token variables for you. Check the variable names
   match `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
3. Deploy. `vercel.json` pins functions to London (`lhr1`) so they sit next to the database.
   It also schedules `/api/cron/cleanup` daily.

Migrations aren't run during the Vercel build. Run `npm run db:migrate` from your machine
against the production database whenever the schema changes.
