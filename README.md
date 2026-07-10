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
- **Brands** — group accounts by brand and switch between them from the
  sidebar; every page (dashboard, composer, calendar, AI) scopes to the
  active brand.
- **Per-account permissions** — toggle posting and stats sync per account;
  live connections show exactly what they're allowed to do, with
  reconnect-to-change and one-click disconnect.
- **Per-platform scheduling** — one time for all platforms, a custom time per
  platform, or each account's learned best hour (from its own engagement
  history).
- **Content recycling** — per-account auto-reposting: Branch picks a random
  already-published post (outside a no-repeat window), optionally freshens
  the caption, and schedules the rerun inside your posting hours.
- **Live connections** — Reddit, Pinterest, YouTube (analytics), and Meta
  (Instagram + Facebook) connect for real via platform login windows (OAuth)
  or Reddit's sanctioned script-app flow. Branch never stores social
  passwords — only revocable, encrypted tokens.
- **Demo mode first** — the entire app boots with 90 days of realistic sample
  data. Every platform is a plug-in connector that flips to live when
  connected.

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
click-by-click steps (create the free developer app, paste its keys, hit
Connect), plus an honest capability matrix:

| Platform | Go live | Auto-post | Analytics | Cost |
|---|---|---|---|---|
| Reddit | **Live now** (script app, ~2 min) | ✅ | Per-post only | Free |
| Pinterest | **Live now** (trial access, instant) | ✅ | ✅ | Free |
| YouTube | **Live now** (analytics; uploads via Studio until Google audit) | Studio | ✅ Excellent | Free |
| Instagram / Facebook | **Live now** (Meta dev mode; Business acct + FB Page) | ✅ | ✅ | Free |
| TikTok | Deferred — unaudited apps can only post private | ✅* | Partial | Free |
| X (Twitter) | Deferred — API is pay-per-use | ✅* | Paid reads | **Pay-per-use** |
| Snapchat | ❌ No public API — manual checklist + CSV stats | ❌ | ❌ | n/a |

You log in on each platform's own page (OAuth) — Branch never sees or
stores social passwords, only revocable tokens, AES-256-GCM encrypted at
rest. The one sanctioned exception is Reddit's script-app flow, where the
password goes directly to reddit.com's token endpoint.

## Architecture

Next.js 16 (App Router) · Drizzle ORM (Neon Postgres in prod, embedded
PGlite in dev, node-postgres for self-hosting) · Recharts · Tailwind v4 ·
Anthropic SDK (`claude-sonnet-5` default) · zod everywhere.

```
src/lib/connectors/   pluggable platform contract + demo/manual/live connectors
src/lib/oauth/        OAuth engine: providers, signed state, app credentials
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
