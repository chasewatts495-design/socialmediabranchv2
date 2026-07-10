import { cn } from "@/components/ui/cn";

/**
 * Arc-reactor ornament: three concentric dashed rings counter-rotating
 * (pure CSS transforms — GPU only). Decorative page-title jewelry and the
 * loading motif of the Gold HUD; sized by the parent (h-7 on mobile
 * headers, h-9 on desktop reads well).
 */
export function ArcRings({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("shrink-0", className)} aria-hidden>
      <g className="arc-spin" style={{ transformOrigin: "24px 24px" }}>
        <circle
          cx="24"
          cy="24"
          r="20"
          fill="none"
          stroke="#b08a2e"
          strokeWidth="1.5"
          strokeDasharray="18 10 4 10"
          strokeLinecap="round"
          opacity="0.8"
        />
      </g>
      <g className="arc-spin-rev" style={{ transformOrigin: "24px 24px" }}>
        <circle
          cx="24"
          cy="24"
          r="14"
          fill="none"
          stroke="#d4b458"
          strokeWidth="1.5"
          strokeDasharray="10 6 22 6"
          strokeLinecap="round"
          opacity="0.9"
        />
      </g>
      <g className="arc-spin-slow" style={{ transformOrigin: "24px 24px" }}>
        <circle
          cx="24"
          cy="24"
          r="8"
          fill="none"
          stroke="#8f6f22"
          strokeWidth="1.5"
          strokeDasharray="6 5"
          opacity="0.85"
        />
      </g>
      <circle cx="24" cy="24" r="2.5" fill="#b08a2e" className="branch-glow-soft" />
    </svg>
  );
}
