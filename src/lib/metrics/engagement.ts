/**
 * Branch's engagement-rate definition (shown in the UI wherever ER appears):
 *   ER = engagements ÷ reach × 100
 * falling back to impressions, then followers, when a platform doesn't
 * expose reach. Nullable metrics stay null — never fabricated.
 */
export function engagementRate(m: {
  engagements?: number | null;
  reach?: number | null;
  impressions?: number | null;
  followers?: number | null;
}): number | null {
  const eng = m.engagements ?? null;
  if (eng === null) return null;
  const base = m.reach ?? m.impressions ?? m.followers ?? null;
  if (!base) return null;
  return (eng / base) * 100;
}

export function pctDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function formatCompact(n: number | null | undefined): string {
  if (n == null) return "—";
  if (Math.abs(n) >= 1_000_000)
    return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 1000)}K`;
  if (Math.abs(n) >= 1_000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function formatPct(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}%`;
}
