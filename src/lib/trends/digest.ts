import { desc } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { trendScans } from "@/lib/db/schema";
import type { TrendReport, TrendSignal } from "./types";

/**
 * Compact text digest of the owner's most recent trend scans — injected
 * into the AI strategist's system prompt so chat answers and reports can
 * reference what is actually trending in the niche right now.
 */
export async function latestTrendDigest(
  db: Db,
  limit = 3,
): Promise<string | null> {
  const scans = await db.query.trendScans.findMany({
    where: (t, { eq }) => eq(t.status, "done"),
    orderBy: [desc(trendScans.createdAt)],
    limit,
  });
  if (scans.length === 0) return null;

  const blocks = scans.map((scan) => {
    const report = scan.analysis as unknown as TrendReport | null;
    const signals = ((scan.signals ?? []) as TrendSignal[]).slice(0, 5);
    const lines = [
      `Keyword "${scan.keyword}" (scanned ${scan.createdAt.toISOString().slice(0, 10)}${
        signals.some((s) => s.source === "demo") ? ", demo signals" : ""
      }):`,
    ];
    if (report?.summary) lines.push(`  Pulse: ${report.summary}`);
    for (const p of report?.patterns?.slice(0, 3) ?? []) {
      lines.push(`  Pattern — ${p.name}: ${p.playbook}`);
    }
    for (const s of signals) {
      lines.push(
        `  Signal [${s.platformId}] "${s.title.slice(0, 90)}" — ${s.engagement.score.toLocaleString()} engagements`,
      );
    }
    return lines.join("\n");
  });

  return blocks.join("\n\n");
}
