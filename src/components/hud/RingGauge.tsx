import { cn } from "@/components/ui/cn";

/**
 * Jarvis-style radial readout: a gold arc sweeps in on mount, its length
 * proportional to the period-over-period change (±50% change = full
 * ring). The arc is reinforcement, never the only signal — the printed
 * value and delta carry the data. Pure SVG + CSS, server-safe, scales
 * fluidly from the 390px two-column grid up.
 */

const R = 26;
const CIRC = 2 * Math.PI * R;

export function RingGauge({
  label,
  value,
  deltaPct,
  className,
}: {
  label: string;
  value: string;
  /** Percent change vs the previous window; null → no arc, em-dash. */
  deltaPct: number | null;
  className?: string;
}) {
  const up = (deltaPct ?? 0) >= 0;
  const frac =
    deltaPct === null ? 0 : Math.min(Math.abs(deltaPct), 50) / 50;
  const targetOffset = CIRC * (1 - Math.max(frac, 0.03)); // sliver at 0
  const arcColor = deltaPct === null ? "#d8dce4" : up ? "#b08a2e" : "#c0362c";

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <svg
        viewBox="0 0 64 64"
        className="h-14 w-14 shrink-0 md:h-16 md:w-16"
        aria-hidden
        style={
          {
            "--ring-circ": CIRC,
            "--ring-target": targetOffset,
          } as React.CSSProperties
        }
      >
        {/* idle track + tick marks for the HUD look */}
        <circle
          cx="32"
          cy="32"
          r={R}
          fill="none"
          stroke="#e8ebf0"
          strokeWidth="4"
        />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          return (
            <line
              key={i}
              x1={32 + Math.cos(a) * (R + 4)}
              y1={32 + Math.sin(a) * (R + 4)}
              x2={32 + Math.cos(a) * (R + 6)}
              y2={32 + Math.sin(a) * (R + 6)}
              stroke="#d8dce4"
              strokeWidth="1"
            />
          );
        })}
        <circle
          cx="32"
          cy="32"
          r={R}
          fill="none"
          stroke={arcColor}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          transform="rotate(-90 32 32)"
          className="ring-sweep"
        />
        <text
          x="32"
          y="30"
          textAnchor="middle"
          fontSize="13"
          fontWeight="700"
          fill={arcColor}
        >
          {deltaPct === null ? "—" : up ? "▲" : "▼"}
        </text>
        <text
          x="32"
          y="42"
          textAnchor="middle"
          fontSize="10"
          fontWeight="600"
          fill="#5b6472"
        >
          {deltaPct === null
            ? ""
            : `${Math.abs(deltaPct).toLocaleString(undefined, {
                maximumFractionDigits: 1,
              })}%`}
        </text>
      </svg>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium tracking-wide text-muted uppercase">
          {label}
        </p>
        {/* Lifts toward the viewer inside a Tilt's perspective. */}
        <p className="hud-lift mt-0.5 text-lg font-semibold md:text-2xl">
          {value}
        </p>
      </div>
    </div>
  );
}
