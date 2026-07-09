/**
 * Dev-only in-process ticker: with ENABLE_DEV_TICKER=true, due scheduled
 * work runs every 60s inside `next dev` / `next start` — no cron needed
 * locally. Production on Vercel uses /api/cron/tick instead.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.ENABLE_DEV_TICKER !== "true") return;

  const g = globalThis as typeof globalThis & { __branchTicker?: boolean };
  if (g.__branchTicker) return;
  g.__branchTicker = true;

  const { getDb } = await import("@/lib/db/client");
  const { runDueWork } = await import("@/lib/scheduler/runner");

  setInterval(() => {
    void (async () => {
      try {
        const db = await getDb();
        const res = await runDueWork(db, { limit: 10 });
        if (res.claimed > 0) {
          console.log("[branch ticker]", JSON.stringify(res));
        }
      } catch (err) {
        console.error("[branch ticker] failed:", err);
      }
    })();
  }, 60_000).unref?.();
}
