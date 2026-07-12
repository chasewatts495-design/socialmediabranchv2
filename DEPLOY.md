# Deploying Branch (free tier, ~15 minutes)

You'll create two free accounts (Vercel, Neon), paste four environment
variables, and add a free cron pinger. No credit card required.

## 1. Neon — the database (free)

1. Go to **neon.tech** → Sign up (GitHub login is easiest).
2. Create a project (name it `branch`, pick the region closest to you).
3. On the project dashboard, click **Connect** → copy the **connection
   string** (starts with `postgresql://...neon.tech/...`).

## 2. Vercel — the app (free)

1. Go to **vercel.com** → Sign up with your **GitHub** account.
2. Click **Add New → Project** → import **socialmediabranchv2**.
3. Before deploying, open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string from step 1 |
   | `APP_PASSWORD` | a strong password — this is your login |
   | `APP_ENCRYPTION_KEY` | random 32+ chars — run `openssl rand -base64 32`, or mash the keyboard |
   | `CRON_SECRET` | another random string — protects the scheduler endpoint |
   | `APP_BASE_URL` | your production URL (add after the first deploy, e.g. `https://socialmediabranchv2.vercel.app`) — pins the OAuth redirect URIs for live connections |

4. Click **Deploy**. The build runs `npm run db:migrate` against Neon
   automatically (see `vercel.json`), then builds the app.
5. Open your new URL (e.g. `https://socialmediabranchv2.vercel.app`), enter
   your `APP_PASSWORD` — the app seeds its demo data on first load.

## 3. Vercel Blob — media uploads (free)

1. In your Vercel project: **Storage → Create Database → Blob** (free tier).
2. Connect it to the project. This adds `BLOB_READ_WRITE_TOKEN`
   automatically — redeploy when prompted.

Uploads now go straight from your browser to Blob storage (no size issues).

## 4. Scheduled posting — the pinger (free, optional)

Branch ticks its own scheduler **whenever the app is open in a browser**
(in-app auto-tick), and Vercel's free cron runs **once per day** as a
backstop (already configured in `vercel.json`). For posts that must go
out **while nobody has the app open**, add a free external pinger:

1. Go to **cron-job.org** → sign up (free).
2. Create a cron job:
   - URL: `https://YOUR-APP.vercel.app/api/cron/tick`
   - Schedule: **every 5 minutes**
   - Advanced → Headers: add `Authorization` = `Bearer YOUR_CRON_SECRET`
     (the same value you set in Vercel).
3. Save. Scheduled posts now publish within 5 minutes of their time.

**Check it works:** Settings → System → "Scheduled work" should say
*Healthy* a few minutes after the pinger starts.

## 5. Connect your real accounts (free, ~5–15 min per platform)

Open **Connections** in the deployed app. Each platform wizard walks you
through creating its free developer app and shows the exact **Redirect
URI** to paste into that app's settings. Then:

1. **Reddit** (fastest, ~2 min): reddit.com/prefs/apps → create a
   **script** app → paste its client ID/secret + your Reddit login into
   the wizard. Saving runs a live check and flips the account to LIVE.
2. **Pinterest**: developers.pinterest.com → create an app (Trial access
   is instant) → paste the App ID/secret → **Connect with Pinterest**.
3. **YouTube**: console.cloud.google.com → enable the YouTube Data +
   Analytics APIs → Web OAuth client → **Connect** (push the consent
   screen to "In production" so the connection doesn't expire weekly).
4. **Instagram + Facebook**: developers.facebook.com → Business app →
   **Connect**, then pick which Pages/IG profiles to link. Instagram
   publishing needs media on public URLs — uploads via Vercel Blob (step
   3) qualify automatically.

You always log in on the platform's own page — Branch stores only
revocable, encrypted tokens, never your passwords. TikTok and X are
deferred (TikTok forces unaudited apps to post privately; X's API is
pay-per-use).

## 6. Turn on the AI Strategist (optional, pay-as-you-go)

1. Create an API key at **console.anthropic.com** (Anthropic account).
2. In Branch: **Settings → AI Strategist** → paste the key → **Test key**.

Reports cost a few cents each (token usage is tracked on the same page).
Without a key, everything still works in demo-analysis mode.

## Updating

Push to the repo's default branch — Vercel redeploys automatically.

## Self-hosting instead of Vercel

Any Node 20+ host works: set the same env vars (`DATABASE_URL` can be any
Postgres, or leave unset for embedded PGlite + local disk), then
`npm run build && npm run start`, and point any cron at
`/api/cron/tick` with the Bearer secret. `docker-compose.yml` includes an
optional local Postgres.
