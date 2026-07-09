# Branch — Social Media Command Center

One place to **track, analyze, and publish to every brand account you own** —
Instagram, Facebook, TikTok, X (Twitter), YouTube, Reddit, Pinterest, and
Snapchat — with a built-in **AI strategist** trained on platform algorithms,
marketing case studies, influencer playbooks, and selling psychology.

Works on desktop and phone (one responsive web app).

## What it does

- **Unified dashboard** — followers, reach, impressions, and engagement rate
  across all accounts, with per-platform growth charts and top posts.
- **Per-account analytics** — drill into any account: trends, engagement
  breakdown, sortable post performance.
- **Compose once, post everywhere** — upload media, write one caption, pick
  any subset of accounts, and Branch adapts the post per platform (X's 280
  chars, YouTube/Reddit/Pinterest titles, subreddits, hashtags), validates it
  against each network's real rules, and publishes simultaneously.
- **Schedule & queue** — content calendar, scheduled posting via cron,
  per-account publish status with retries; Snapchat (no public API) becomes a
  "post manually + mark done" checklist.
- **Content library** — reusable media with tags, alt text, and drafts.
- **AI Strategist** — audits your accounts, builds 2-week content plans
  (one click turns them into scheduled drafts), generates post ideas, weekly
  reviews, and **Ad Builder** campaign briefs with scripts, CTAs, and the
  psychology behind every element. Runs on your Anthropic API key — or in a
  deterministic demo mode without one.
- **Demo mode first** — the entire app boots with 90 days of realistic sample
  data. Every platform is a plug-in connector: paste real API credentials in
  the Connections wizard when you have them.

## Quick start (local)

```bash
npm install
npm run dev
```

That's it — open http://localhost:3000. With no `DATABASE_URL` set, Branch
runs an embedded Postgres (PGlite) in `.data/` and seeds demo data on first
load. No accounts, no keys, no setup.

Optional env (see `.env.example`): `APP_PASSWORD` (login gate),
`APP_ENCRYPTION_KEY` (credential encryption), `ENABLE_DEV_TICKER=true`
(scheduled posts run every 60s in dev).

## Deploy to the cloud (free tier)

Follow [DEPLOY.md](./DEPLOY.md) — Vercel (hosting) + Neon (Postgres) +
Vercel Blob (media) + a free cron pinger, all on free tiers, ~15 minutes.

## Connecting real platforms

Open **Connections** in the app. Each platform has a wizard with exact
click-by-click steps to get API credentials, plus an honest capability
matrix (what's free, what's paid, what's impossible):

| Platform | Auto-post | Analytics | Cost |
|---|---|---|---|
| Instagram / Facebook | ✅ (Business acct + FB Page) | ✅ | Free |
| TikTok | ✅ (private until TikTok audits your app) | Partial | Free |
| YouTube | ✅ (private until Google audit; ~6/day quota) | ✅ Excellent | Free |
| Reddit | ✅ (instant self-serve) | Per-post only | Free |
| Pinterest | ✅ (Business acct) | ✅ | Free |
| X (Twitter) | ✅ | Paid reads | **Pay-per-use** |
| Snapchat | ❌ No public API — manual checklist + CSV stats | ❌ | n/a |

Credentials are AES-256-GCM encrypted at rest. Live connector
implementations ship platform-by-platform (Reddit first); until then every
account runs in demo mode and credentials wait, stored and ready.

## Architecture

Next.js 16 (App Router) · Drizzle ORM (Neon Postgres in prod, embedded
PGlite in dev, node-postgres for self-hosting) · Recharts · Tailwind v4 ·
Anthropic SDK (`claude-sonnet-5` default) · zod everywhere.

```
src/lib/connectors/   pluggable platform contract + demo/manual connectors
src/lib/ai/           strategist: prompts, contracts, knowledge base, demo engine
src/lib/ai/knowledge/ curated marketing knowledge (editable TS-markdown)
src/lib/scheduler/    serverless job runner (publish, stats sync, AI reports)
src/lib/storage/      media storage driver (local disk | Vercel Blob)
src/app/(app)/        dashboard, composer, calendar, library, strategist, …
```

Adding a future platform = one file implementing the `Connector` interface
(`src/lib/connectors/types.ts`) plus a capabilities descriptor.

## Commands

| Command | What |
|---|---|
| `npm run dev` | dev server (auto-seeds demo data) |
| `npm run build` / `start` | production build / serve |
| `npm test` | unit tests (validators, generators, scheduler) |
| `npm run e2e` | Playwright suite at 390px and 1440px |
| `npm run db:generate` | regenerate SQL migrations after schema changes |
| `npm run db:migrate` | apply migrations (used by the Vercel build) |
| `npm run db:seed` | seed demo data (no-op if already seeded) |
