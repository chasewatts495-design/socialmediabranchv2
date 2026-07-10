"use client";

/**
 * The "branch system" step rail: dandelion-like glowing nodes joined by
 * braided gold-filament streams. Completed streams flow; a pulse travels
 * down the stream you just crossed; the active node breathes. The circuitry
 * look of the Gold HUD theme.
 */

import { cn } from "@/components/ui/cn";

const GOLD_BRIGHT = "#d4b458";
const GOLD = "#b08a2e";
const GOLD_DEEP = "#8f6f22";
const IDLE = "#d8dce4";

export interface BranchStep {
  key: string;
  label: string;
}

function Node({
  state,
  size = 44,
}: {
  state: "done" | "active" | "todo";
  size?: number;
}) {
  const lit = state !== "todo";
  const stroke = state === "active" ? GOLD : state === "done" ? GOLD_DEEP : IDLE;
  const spokes = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={cn(
        state === "active" && "branch-glow branch-node-active",
        state === "done" && "branch-glow-soft",
      )}
      aria-hidden
    >
      {spokes.map((a, i) => {
        const x1 = 24 + Math.cos(a) * 8;
        const y1 = 24 + Math.sin(a) * 8;
        const x2 = 24 + Math.cos(a) * (i % 2 === 0 ? 16 : 13);
        const y2 = 24 + Math.sin(a) * (i % 2 === 0 ? 16 : 13);
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={1.3} />
            <circle
              cx={x2}
              cy={y2}
              r={1.6}
              fill={lit ? (i % 3 === 0 ? GOLD_BRIGHT : GOLD) : IDLE}
              opacity={lit ? 0.95 : 0.7}
            />
          </g>
        );
      })}
      <circle
        cx={24}
        cy={24}
        r={6}
        fill={state === "active" ? GOLD : state === "done" ? GOLD_DEEP : "#ffffff"}
        stroke={stroke}
        strokeWidth={1.5}
      />
      {state === "done" && (
        <path
          d="M20.5 24l2.5 2.5 4.5-5"
          stroke="#ffffff"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

function Stream({
  lit,
  pulse,
  reverse,
}: {
  lit: boolean;
  pulse: boolean;
  reverse: boolean;
}) {
  const paths = [
    "M0,20 C25,8 40,32 60,20 S85,10 100,20",
    "M0,20 C20,30 45,6 65,26 S90,28 100,20",
    "M0,20 C30,14 52,26 74,12 S92,22 100,20",
  ];
  return (
    <svg
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      className="h-10 min-w-6 flex-1"
      aria-hidden
    >
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={lit ? (i === 1 ? GOLD_DEEP : GOLD) : IDLE}
          strokeWidth={lit ? 1.4 : 1}
          opacity={lit ? 0.55 + i * 0.16 : 0.8}
          className={lit ? "branch-stream" : undefined}
          style={lit ? { animationDelay: `${i * -1.2}s` } : undefined}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {pulse && (
        <circle r={3.2} fill={GOLD_BRIGHT} className="branch-glow">
          <animateMotion
            dur="0.7s"
            repeatCount="1"
            fill="freeze"
            path={paths[0]}
            keyPoints={reverse ? "1;0" : "0;1"}
            keyTimes="0;1"
          />
        </circle>
      )}
    </svg>
  );
}

export function BranchProgress({
  steps,
  current,
  direction = 1,
  onStepClick,
  className,
}: {
  steps: BranchStep[];
  current: number;
  direction?: 1 | -1;
  onStepClick?: (index: number) => void;
  className?: string;
}) {
  // The stream that was just crossed gets the traveling pulse.
  const pulseIndex = direction > 0 ? current - 1 : current;

  return (
    <div className={cn("select-none", className)} data-testid="branch-progress">
      <div className="flex items-center">
        {steps.map((step, i) => {
          const state = i < current ? "done" : i === current ? "active" : "todo";
          return (
            <div key={step.key} className="contents">
              {i > 0 && (
                <Stream
                  lit={i <= current}
                  pulse={i - 1 === pulseIndex && pulseIndex >= 0}
                  reverse={direction < 0}
                />
              )}
              <button
                type="button"
                onClick={onStepClick ? () => onStepClick(i) : undefined}
                disabled={!onStepClick}
                aria-current={state === "active" ? "step" : undefined}
                aria-label={`Step ${i + 1}: ${step.label}`}
                className={cn(
                  "flex shrink-0 flex-col items-center gap-0.5",
                  onStepClick && "cursor-pointer",
                )}
              >
                <Node state={state} />
                <span
                  className={cn(
                    "max-w-16 truncate text-[10px] font-medium md:max-w-24 md:text-[11px]",
                    state === "active"
                      ? "text-ink"
                      : state === "done"
                        ? "text-muted"
                        : "text-faint",
                  )}
                >
                  {step.label}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
