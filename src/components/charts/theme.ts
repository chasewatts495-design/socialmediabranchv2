/** Shared Recharts styling for the dark surface. */
export const CHART = {
  grid: "#1f2739",
  axisLine: "#26304a",
  tick: { fill: "#94a1b8", fontSize: 11 },
  tooltip: {
    contentStyle: {
      background: "#1a2130",
      border: "1px solid #26304a",
      borderRadius: 12,
      fontSize: 12,
      color: "#e7ecf5",
    },
    labelStyle: { color: "#94a1b8", marginBottom: 4 },
    itemStyle: { padding: 0 },
    cursor: { stroke: "#3b4763", strokeWidth: 1 },
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
