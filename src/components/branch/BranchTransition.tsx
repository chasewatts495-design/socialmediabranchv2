"use client";

import type { ReactNode } from "react";

/**
 * Animates step content in when the step changes: forward slides in from the
 * right with a glow-blur settle, backward from the left. Remounting via
 * `key` restarts the CSS animation.
 */
export function BranchTransition({
  step,
  direction,
  children,
}: {
  step: number | string;
  direction: 1 | -1;
  children: ReactNode;
}) {
  return (
    <div
      key={step}
      className={direction > 0 ? "branch-step-fwd" : "branch-step-back"}
    >
      {children}
    </div>
  );
}
