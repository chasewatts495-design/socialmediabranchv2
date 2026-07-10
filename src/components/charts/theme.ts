/** Shared Recharts styling for the light Gold-HUD surface. */
export const CHART = {
  grid: "#e8ebf0",
  axisLine: "#dfe3ea",
  tick: { fill: "#5b6472", fontSize: 11 },
  tooltip: {
    contentStyle: {
      background: "#ffffff",
      border: "1px solid #e2e5eb",
      borderRadius: 12,
      fontSize: 12,
      color: "#171a20",
      boxShadow: "0 6px 20px rgba(23, 26, 32, 0.08)",
    },
    labelStyle: { color: "#5b6472", marginBottom: 4 },
    itemStyle: { padding: 0 },
    cursor: { stroke: "#b08a2e", strokeWidth: 1, strokeOpacity: 0.5 },
  },
} as const;

export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
