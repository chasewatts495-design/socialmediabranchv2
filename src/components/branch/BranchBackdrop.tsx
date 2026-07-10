/**
 * Decorative bioluminescent branch-network backdrop (server-safe, pure SVG).
 * Three node clusters joined by slowly flowing braided streams — the visual
 * language of the reference art, dimmed so content stays readable.
 */

const CYAN = "#22d3ee";
const TEAL = "#0e7490";
const MAGENTA = "#c026d3";
const LIME = "#a3e635";

function Cluster({ cx, cy, r = 1 }: { cx: number; cy: number; r?: number }) {
  const spokes = Array.from({ length: 12 }, (_, i) => (i * Math.PI) / 6);
  return (
    <g className="branch-glow-soft">
      {spokes.map((a, i) => {
        const inner = 12 * r;
        const outer = (i % 2 === 0 ? 34 : 26) * r;
        const x1 = cx + Math.cos(a) * inner;
        const y1 = cy + Math.sin(a) * inner;
        const x2 = cx + Math.cos(a) * outer;
        const y2 = cy + Math.sin(a) * outer;
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={CYAN} strokeWidth={1} opacity={0.8} />
            <circle
              cx={x2}
              cy={y2}
              r={2}
              fill={i % 4 === 0 ? MAGENTA : i % 5 === 0 ? LIME : CYAN}
            />
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={9 * r} fill="none" stroke={CYAN} strokeWidth={1.2} />
      <circle cx={cx} cy={cy} r={4 * r} fill={CYAN} opacity={0.9} />
      <circle
        cx={cx + 26 * r}
        cy={cy - 20 * r}
        r={6 * r}
        fill="none"
        stroke={MAGENTA}
        strokeWidth={1.5}
        opacity={0.7}
        className="branch-glow-magenta"
      />
    </g>
  );
}

export function BranchBackdrop({ opacity = 0.14 }: { opacity?: number }) {
  const streams = [
    "M110,120 C220,60 300,180 420,150 S620,60 700,95",
    "M118,132 C240,110 310,210 430,165 S610,90 696,108",
    "M104,142 C200,190 330,240 440,235 S600,270 690,240",
    "M420,170 C480,220 520,260 560,300 S640,330 700,300",
  ];
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ opacity }}
      aria-hidden
    >
      <svg
        viewBox="0 0 800 400"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
      >
        {streams.map((d, i) => (
          <g key={i}>
            {[0, 3, -3].map((off) => (
              <path
                key={off}
                d={d}
                transform={`translate(0 ${off})`}
                fill="none"
                stroke={off === 0 ? CYAN : TEAL}
                strokeWidth={off === 0 ? 1.6 : 1}
                className="branch-stream-slow"
                style={{ animationDelay: `${i * -3 + off}s` }}
              />
            ))}
          </g>
        ))}
        <Cluster cx={110} cy={120} />
        <Cluster cx={430} cy={210} r={1.25} />
        <Cluster cx={690} cy={100} r={0.9} />
      </svg>
    </div>
  );
}
