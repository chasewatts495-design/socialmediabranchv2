import { after } from "next/server";
import { getDb } from "@/lib/db/client";
import { getSetting, setSetting } from "@/lib/settings";

/**
 * Opportunistic scheduler tick: whenever the owner has the app open, due
 * work runs even without an external pinger (Vercel's free cron is
 * daily-only). Called from the authenticated layout on every render —
 * the staleness gate is one settings read, and the actual work happens
 * AFTER the response so pages never wait on it. Concurrent renders are
 * safe: the claim is optimistic and the job queue itself locks with
 * FOR UPDATE SKIP LOCKED.
 */

const FRESH_MS = 4 * 60_000;

export async function opportunisticTick(): Promise<void> {
  try {
    const last = await getSetting("cron.lastTickAt");
    if (last && Date.now() - new Date(last).getTime() < FRESH_MS) return;
    // Optimistic claim before the real work — cuts the herd when several
    // pages render at once.
    await setSetting("cron.lastTickAt", new Date().toISOString());
    after(async () => {
      try {
        const db = await getDb();
        const { runDueWork } = await import("@/lib/scheduler/runner");
        await import("@/lib/connectors/live/register");
        await runDueWork(db, { limit: 5 });
        await setSetting("cron.lastTickAt", new Date().toISOString());
      } catch {
        // Background best-effort — the cron endpoint remains the backstop.
      }
    });
  } catch {
    // Never let the tick gate break a page render.
  }
}
