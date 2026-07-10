import type { PlatformId } from "@/lib/connectors/types";
import { PLATFORM_BADGE_COLORS, PLATFORM_LABELS } from "@/lib/metrics/colors";

export function PlatformBadge({ platformId }: { platformId: PlatformId }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-medium text-muted">
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: PLATFORM_BADGE_COLORS[platformId] }}
      />
      {PLATFORM_LABELS[platformId]}
    </span>
  );
}

export function ModeChip({ mode }: { mode: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    demo: { label: "Demo", cls: "bg-info-soft text-info" },
    live: { label: "Live", cls: "bg-success-soft text-success" },
    manual: { label: "Manual", cls: "bg-warning-soft text-warning" },
  };
  const m = map[mode] ?? map.demo;
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${m.cls}`}
    >
      {m.label}
    </span>
  );
}
