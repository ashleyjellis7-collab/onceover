# Onceover

A free Finprom & Consumer Duty pre-check: paste a URL or the text of a financial promotion
and get a PageSpeed-style report with two scores and the rule behind every finding.
It is a pre-check, never an approval.

Stack: Next.js 16 (App Router) on **Vercel**, **Turso** (libSQL) with Drizzle ORM.

## What's built so far (Phase 1, open beta slice)

- `/`: chooses between the two checkers.
- `/finprom` and `/consumer-duty`: each starts with an asset type (social post or ad, web page,
  display ad, email or letter, brochure or PDF, plain text), then asks for that type's copy,
  link and/or upload.
- Uploads (PNG, JPG, GIF, WebP or PDF, up to 4MB) are transcribed by Claude into a text record
  with each element's role, size, position and contrast (`src/engine/read-asset.ts`). Claude
  only transcribes; Jev and the code checks decide. Needs `ANTHROPIC_API_KEY`.
- Facebook Ad Library and social post links need a login, so they are stored as the source but
  not fetched; the user adds a screenshot or the copy. Ordinary web page links are fetched.
- `/r/<id>`: shareable report for one checker, with findings grouped Issue / Review / Clear,
  the evidence sentence, the suggestion, a "This finding looks wrong" button, a "What we read"
  panel, and a button to run the other checker on the same asset. It is `noindex`.
- `/api/bypass?token=<BYPASS_TOKEN or CRON_SECRET>` lets the owner skip the daily limit in that
  browser; `/api/bypass?off` turns it off.
- `/methodology`: every rule, the question asked, the thresholds, the score formula and a changelog.
- Rule set `v0.1` in `src/rules/` holds 21 starter rule records. They are a draft that a
  compliance reviewer still needs to check.
- `src/engine/` holds the engine. It runs applicability gates, then code checks (exact wording,
  reading age, layout) and judgement checks through a swappable `DecisionModel`, then scores.
- Jev (`src/engine/jev.ts`, pinned to `jev-1.13.0`) classifies the asset, answers each rule
  question as a Noul, and finds the evidence sentence for findings that aren't Clear. It is used
  when `TYPESAFE_API_KEY` is set. If Jev errors, the test falls back to the keyword heuristic and
  the report records which model decided.
- Anonymous limit of 5 tests a day per IP. Reports expire after 30 days. A daily cron deletes them.
- The URL fetcher has SSRF guards: it blocks private IPs and caps redirects, size and time.

Not built yet:

- Reading Ad Library and social post links automatically (needs a headless browser worker or
  Meta API access).
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
   - `TYPESAFE_API_KEY`, your Jev key.
   - `ANTHROPIC_API_KEY`, for reading uploaded images and PDFs.

   Alternatively, add the **Turso** integration from the Vercel Marketplace. It creates the
   database and sets the database URL and token variables for you. Check the variable names
   match `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
3. Deploy. `vercel.json` pins functions to London (`lhr1`) so they sit next to the database.
   It also schedules `/api/cron/cleanup` daily.

Vercel runs `npm run vercel-build`, which applies any new migrations to Turso before building.
Locally, run `npm run db:migrate` yourself.
