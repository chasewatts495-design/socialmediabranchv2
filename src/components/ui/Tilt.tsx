"use client";

/**
 * Pointer-reactive 3D tilt — cards lean toward the cursor like plates of
 * HUD glass. Transform-only (GPU compositor), rAF-throttled, writes styles
 * directly so React never re-renders during movement. Inert on touch-only
 * devices and under prefers-reduced-motion.
 */

import { useEffect, useRef, type ReactNode } from "react";

export function Tilt({
  children,
  max = 6,
  className,
}: {
  children: ReactNode;
  /** Max tilt in degrees. */
  max?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover)").matches) return;

    let raf = 0;
    let targetX = 0;
    let targetY = 0;

    const apply = () => {
      raf = 0;
      el.style.transform = `perspective(900px) rotateX(${targetX}deg) rotateY(${targetY}deg) translateZ(0)`;
    };

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      targetY = px * max * 2;
      targetX = -py * max * 2;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    const onEnter = () => {
      el.style.transition = "transform 0.08s ease-out";
    };

    const onLeave = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      el.style.transition = "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)";
      el.style.transform =
        "perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0)";
    };

    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [max]);

  return (
    <div
      ref={ref}
      className={className}
      // preserve-3d lets .hud-lift children float above the card plane
      // while the tilt's perspective is active.
      style={{ willChange: "transform", transformStyle: "preserve-3d" }}
    >
      {children}
    </div>
  );
}
