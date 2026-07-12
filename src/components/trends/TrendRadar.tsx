"use client";

/**
 * 3D holographic radar — the Trend Radar centerpiece. A perspective-tilted
 * plane of concentric rings with a rotating sweep beam; each signal is a
 * blip rising out of the plane, sized/heightened by heat and colored by
 * platform. Scanning mode spins the sweep faster and pulses the rings.
 *
 * Same performance discipline as HoloSphere: one rAF loop, zero per-frame
 * allocation, DPR ≤ 2, paused offscreen/hidden, static under
 * prefers-reduced-motion.
 */

import { useEffect, useRef } from "react";

const GOLD = [176, 138, 46] as const;
const GOLD_BRIGHT = [212, 180, 88] as const;

export interface RadarBlip {
  /** 0..1 — hotter renders bigger, taller, closer to the center. */
  heat: number;
  /** Platform hex color. */
  color: string;
}

function hexToRgb(hex: string): readonly [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return GOLD;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
}

export function TrendRadar({
  blips = [],
  scanning = false,
  className,
}: {
  blips?: RadarBlip[];
  scanning?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blipKey = blips.map((b) => `${b.heat.toFixed(2)}${b.color}`).join("|");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // Pre-compute blip geometry: golden-angle spiral, hot blips inward.
    // Heat is clamped — a bad value must never reach the canvas API.
    const GA = Math.PI * (3 - Math.sqrt(5));
    const items = blips.slice(0, 40).map((b, i) => {
      const heat = Math.min(1, Math.max(0, b.heat));
      return {
        angle: i * GA,
        dist: 0.25 + (1 - heat) * 0.65,
        h: 0.08 + heat * 0.3, // rise height (plane units)
        r: 2.2 + heat * 3.4, // dot radius (css px)
        rgb: hexToRgb(b.color),
        phase: i * 0.7,
      };
    });

    let sweep = 0;
    let clock = 0;
    let raf = 0;
    let running = false;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    };

    // Tilted-plane projection: y squashed, z (height) lifts points up.
    const TILT = 0.42;
    const draw = () => {
      const cx = (width / 2) * dpr;
      const cy = (height / 2 + height * 0.06) * dpr;
      const R = Math.min(width / 2, height / (2 * TILT + 0.6)) * 0.92 * dpr;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const px = (ang: number, dist: number, z: number): [number, number] => [
        cx + Math.cos(ang) * dist * R,
        cy + Math.sin(ang) * dist * R * TILT - z * R,
      ];

      // Concentric rings (+ soft pulse while scanning).
      for (let ring = 1; ring <= 4; ring++) {
        const d = ring / 4;
        const pulse = scanning
          ? 0.1 + 0.08 * Math.sin(clock * 0.09 - ring * 0.9)
          : 0.12;
        ctx.beginPath();
        ctx.ellipse(cx, cy, d * R, d * R * TILT, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${GOLD[0]},${GOLD[1]},${GOLD[2]},${pulse + (ring === 4 ? 0.08 : 0)})`;
        ctx.lineWidth = (ring === 4 ? 1.4 : 1) * dpr;
        ctx.stroke();
      }
      // Cross hairs.
      ctx.strokeStyle = `rgba(${GOLD[0]},${GOLD[1]},${GOLD[2]},0.10)`;
      ctx.lineWidth = 1 * dpr;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const [x1, y1] = px(a, 1, 0);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }

      // Sweep beam — a translucent gold wedge with a bright leading edge.
      if (!reduceMotion) {
        const wedge = 0.55;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        grad.addColorStop(0, `rgba(${GOLD_BRIGHT[0]},${GOLD_BRIGHT[1]},${GOLD_BRIGHT[2]},0.16)`);
        grad.addColorStop(1, `rgba(${GOLD_BRIGHT[0]},${GOLD_BRIGHT[1]},${GOLD_BRIGHT[2]},0)`);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1, TILT);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, R, sweep - wedge, sweep);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        // Leading edge.
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(sweep) * R, Math.sin(sweep) * R);
        ctx.strokeStyle = `rgba(${GOLD_BRIGHT[0]},${GOLD_BRIGHT[1]},${GOLD_BRIGHT[2]},0.5)`;
        ctx.lineWidth = 1.6 * dpr;
        ctx.stroke();
        ctx.restore();
      }

      // Blips: stem + head, brightened as the sweep passes.
      for (const b of items) {
        const bob = reduceMotion ? 0 : Math.sin(clock * 0.05 + b.phase) * 0.012;
        const [bx, by] = px(b.angle, b.dist, 0);
        const [hx, hy] = px(b.angle, b.dist, b.h + bob);
        // Sweep proximity → glow boost (angle distance, wrapped).
        let da = Math.abs(((b.angle - sweep) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        if (da > Math.PI) da = Math.PI * 2 - da;
        const boost = reduceMotion ? 0.35 : Math.max(0, 1 - da / 0.9);
        const alpha = 0.45 + boost * 0.55;

        ctx.strokeStyle = `rgba(${b.rgb[0]},${b.rgb[1]},${b.rgb[2]},${alpha * 0.45})`;
        ctx.lineWidth = 1.2 * dpr;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(hx, hy);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(hx, hy, b.r * dpr * (1 + boost * 0.35), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${b.rgb[0]},${b.rgb[1]},${b.rgb[2]},${alpha})`;
        ctx.fill();
        // Ground marker.
        ctx.beginPath();
        ctx.ellipse(bx, by, 2.4 * dpr, 2.4 * dpr * TILT, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${b.rgb[0]},${b.rgb[1]},${b.rgb[2]},${0.25 + boost * 0.3})`;
        ctx.fill();
      }

      // Idle state with no blips: ambient scanning dots so it never looks dead.
      if (items.length === 0) {
        for (let i = 0; i < 7; i++) {
          const a = i * GA * 2.3 + (reduceMotion ? 0 : clock * 0.006 * (i % 2 ? 1 : -1));
          const d = 0.3 + (i % 4) * 0.17;
          const [x, y] = px(a, d, 0.04 + (i % 3) * 0.03);
          ctx.beginPath();
          ctx.arc(x, y, 2.4 * dpr, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${GOLD[0]},${GOLD[1]},${GOLD[2]},0.5)`;
          ctx.fill();
        }
      }
    };

    const frame = () => {
      clock += 1;
      sweep += scanning ? 0.085 : 0.016;
      if (sweep > Math.PI * 2) sweep -= Math.PI * 2;
      draw();
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running) return;
      running = true;
      resize();
      if (reduceMotion) {
        sweep = 2.2;
        draw(); // single static frame
      } else {
        raf = requestAnimationFrame(frame);
      }
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const io = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? start() : stop()),
      { threshold: 0.05 },
    );
    io.observe(canvas);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    const ro = new ResizeObserver(() => {
      resize();
      if (reduceMotion) draw();
    });
    ro.observe(canvas);

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blipKey, scanning]);

  return (
    <canvas
      ref={canvasRef}
      className={className ?? "h-full w-full"}
      aria-hidden
      data-testid="trend-radar"
    />
  );
}
