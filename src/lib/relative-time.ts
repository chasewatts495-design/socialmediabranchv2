export function relativeTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const abs = Math.abs(diff);
  const suffix = diff >= 0 ? "ago" : "from now";
  const min = Math.round(abs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ${suffix}`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours}h ${suffix}`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ${suffix}`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
