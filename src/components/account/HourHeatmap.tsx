import type { AccountPostRow } from "@/lib/db/account-queries";

/**
 * Engagement-by-hour heat strip: average engagement rate of this
 * account's posts bucketed by publish hour (UTC — the same clock the
 * scheduler and recycling windows use). Sequential gold ramp, light→dark
 * with monotonic lightness; exact numbers live in each cell's tooltip
 * and the summary line, so color never carries the data alone.
 */

const LIGHT = [245, 237, 216] as const; // #f5edd8
const DARK = [111, 85, 24] as const; // #6f5518

function rampColor(t: number): string {
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${mix(LIGHT[0], DARK[0])},${mix(LIGHT[1], DARK[1])},${mix(LIGHT[2], DARK[2])})`;
}

export function HourHeatmap({ posts }: { posts: AccountPostRow[] }) {
  const buckets = Array.from({ length: 24 }, () => ({ sum: 0, n: 0 }));
  for (const p of posts) {
    const er = p.metrics?.engagementRate;
    if (er == null || !p.publishedAt) continue;
    const hour = new Date(p.publishedAt).getUTCHours();
    buckets[hour].sum += er;
    buckets[hour].n += 1;
  }
  const avgs = buckets.map((b) => (b.n > 0 ? b.sum / b.n : null));
  const max = Math.max(...avgs.map((v) => v ?? 0), 0.001);
  const best = avgs.reduce<{ hour: number; avg: number } | null>(
    (acc, v, hour) =>
      v !== null && buckets[hour].n >= 2 && (!acc || v > acc.avg)
        ? { hour, avg: v }
        : acc,
    null,
  );
  const sampled = buckets.reduce((n, b) => n + b.n, 0);

  if (sampled < 4) {
    return (
      <p className="px-4 py-6 text-center text-xs text-muted md:px-5">
        Not enough published posts yet — the hourly pattern appears after a
        few posts have metrics.
      </p>
    );
  }

  return (
    <div className="p-4 md:p-5">
      <div className="grid grid-cols-24 gap-0.5" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
        {avgs.map((v, hour) => (
          <div
            key={hour}
            title={
              v === null
                ? `${hour}:00 UTC — no posts`
                : `${hour}:00 UTC — avg ER ${v.toFixed(1)}% (${buckets[hour].n} post${buckets[hour].n === 1 ? "" : "s"})`
            }
            className="h-9 rounded-[3px] border border-border/50 md:h-10"
            style={{
              background: v === null ? "#f4f5f7" : rampColor(v / max),
              outline:
                best && hour === best.hour ? "2px solid #b08a2e" : undefined,
              outlineOffset: best && hour === best.hour ? "1px" : undefined,
            }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-faint">
        {[0, 6, 12, 18, 23].map((h) => (
          <span key={h}>{h}:00</span>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        {best
          ? `Best hour so far: ${best.hour}:00 UTC — ${best.avg.toFixed(1)}% average engagement (the composer's "Best time each" mode uses this).`
          : "No hour has enough posts yet for a reliable best-time call."}
      </p>
    </div>
  );
}
