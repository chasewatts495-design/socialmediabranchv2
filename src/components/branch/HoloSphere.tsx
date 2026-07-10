"use client";

/**
 * Interactive 3D holographic particle globe — the "movable part" of the
 * Gold HUD. A fibonacci-distributed point sphere with orbit rings and
 * near-neighbor filaments, rendered on canvas at device-pixel scale.
 * Auto-rotates; drag (mouse or touch) to spin it with inertia.
 *
 * Performance: one rAF loop drawing pre-computed geometry (no allocation
 * per frame), DPR capped at 2, paused when offscreen or tab-hidden, and
 * static (but still draggable) under prefers-reduced-motion.
 */

import { useEffect, useRef } from "react";

const GOLD = [176, 138, 46] as const;
const GOLD_BRIGHT = [212, 180, 88] as const;
const GOLD_DEEP = [143, 111, 34] as const;

interface P3 {
  x: number;
  y: number;
  z: number;
  kind: 0 | 1 | 2; // 0 plain · 1 bright · 2 deep node
}

function buildGeometry(pointCount: number) {
  const points: P3[] = [];
  // Fibonacci sphere — evenly spread points, no pole clumping.
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < pointCount; i++) {
    const y = 1 - (i / (pointCount - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = phi * i;
    points.push({
      x: Math.cos(theta) * r,
      y,
      z: Math.sin(theta) * r,
      kind: i % 23 === 0 ? 2 : i % 7 === 0 ? 1 : 0,
    });
  }
  // Filaments between near neighbors (precomputed once).
  const links: [number, number][] = [];
  const maxD2 = 0.14;
  for (let i = 0; i < pointCount; i++) {
    for (let j = i + 1; j < pointCount && links.length < 700; j++) {
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      const dz = points[i].z - points[j].z;
      if (dx * dx + dy * dy + dz * dz < maxD2) links.push([i, j]);
    }
  }
  return { points, links };
}

function hexToRgb(hex: string): readonly [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return GOLD;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
}

export function HoloSphere({
  className,
  satellites = [],
}: {
  className?: string;
  /** One orbiting node per connected platform (brand-adjacent hex colors). */
  satellites?: string[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const satKey = satellites.join(",");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const { points, links } = buildGeometry(340);
    const proj = new Float32Array(points.length * 3); // sx, sy, depth

    // Orbiting platform satellites: fixed tilted orbits, varied speeds.
    const satColors = satKey ? satKey.split(",") : [];
    const sats = satColors.slice(0, 8).map((hex, i) => ({
      rgb: hexToRgb(hex),
      orbitR: 1.3 + (i % 3) * 0.16,
      tilt: 0.45 + (i % 4) * 0.35,
      speed: (0.0045 + i * 0.0009) * (i % 2 === 0 ? 1 : -1),
      phase: (i * Math.PI * 2) / Math.max(satColors.length, 1),
    }));
    let clock = 0; // frames — advances only while animating
    // A gold "transmission" beam fires from the globe to a satellite
    // every couple of seconds (skipped under reduced motion).
    let beam: { sat: number; startClock: number } | null = null;
    const BEAM_FRAMES = 45;
    const BEAM_EVERY = 150;

    let yaw = 0.6;
    let pitch = -0.35;
    let velYaw = reduceMotion ? 0 : 0.0035;
    let velPitch = 0;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
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

    const draw = () => {
      const cx = (width / 2) * dpr;
      const cy = (height / 2) * dpr;
      // With satellites the widest orbit reaches ~1.6× the globe radius —
      // shrink the globe so orbits stay inside the canvas at any size.
      const radius =
        Math.min(width, height) * (sats.length > 0 ? 0.29 : 0.42) * dpr;
      const f = 3.2; // perspective strength

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const sy = Math.sin(yaw);
      const cyw = Math.cos(yaw);
      const sp = Math.sin(pitch);
      const cp = Math.cos(pitch);

      // Camera transform for any world-space point (shared with satellites).
      const project = (
        px: number,
        py: number,
        pz: number,
      ): [number, number, number] => {
        const x1 = px * cyw + pz * sy;
        const z1 = -px * sy + pz * cyw;
        const y2 = py * cp - z1 * sp;
        const z2 = py * sp + z1 * cp;
        const s = f / (f + z2);
        return [cx + x1 * radius * s, cy + y2 * radius * s, z2];
      };

      const satPos = (si: number): [number, number, number] => {
        const sat = sats[si];
        const theta = clock * sat.speed + sat.phase;
        const st = Math.sin(sat.tilt);
        const ct = Math.cos(sat.tilt);
        return [
          Math.cos(theta) * sat.orbitR,
          -Math.sin(theta) * sat.orbitR * st,
          Math.sin(theta) * sat.orbitR * ct,
        ];
      };

      // Orbit tracks first, so the globe draws over their far side.
      ctx.lineWidth = 0.8 * dpr;
      for (const sat of sats) {
        ctx.strokeStyle = `rgba(${sat.rgb[0]},${sat.rgb[1]},${sat.rgb[2]},0.18)`;
        ctx.beginPath();
        for (let k = 0; k <= 48; k++) {
          const theta = (k / 48) * Math.PI * 2;
          const st = Math.sin(sat.tilt);
          const ct = Math.cos(sat.tilt);
          const [ox, oy] = project(
            Math.cos(theta) * sat.orbitR,
            -Math.sin(theta) * sat.orbitR * st,
            Math.sin(theta) * sat.orbitR * ct,
          );
          if (k === 0) ctx.moveTo(ox, oy);
          else ctx.lineTo(ox, oy);
        }
        ctx.stroke();
      }

      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        // yaw (Y axis) then pitch (X axis)
        const x1 = p.x * cyw + p.z * sy;
        const z1 = -p.x * sy + p.z * cyw;
        const y2 = p.y * cp - z1 * sp;
        const z2 = p.y * sp + z1 * cp;
        const s = f / (f + z2);
        proj[i * 3] = cx + x1 * radius * s;
        proj[i * 3 + 1] = cy + y2 * radius * s;
        proj[i * 3 + 2] = z2; // -1 (front) … 1 (back)
      }

      // Filaments first, faint, front-weighted.
      ctx.lineWidth = 1 * dpr;
      for (const [a, b] of links) {
        const za = proj[a * 3 + 2];
        const zb = proj[b * 3 + 2];
        const depth = (za + zb) / 2;
        const alpha = 0.16 * (1 - depth); // brighter toward viewer
        if (alpha <= 0.02) continue;
        ctx.strokeStyle = `rgba(${GOLD[0]},${GOLD[1]},${GOLD[2]},${alpha})`;
        ctx.beginPath();
        ctx.moveTo(proj[a * 3], proj[a * 3 + 1]);
        ctx.lineTo(proj[b * 3], proj[b * 3 + 1]);
        ctx.stroke();
      }

      // Points, back-to-front alpha.
      for (let i = 0; i < points.length; i++) {
        const depth = proj[i * 3 + 2];
        const alpha = 0.25 + 0.6 * (1 - depth) * 0.5;
        const kind = points[i].kind;
        const c = kind === 1 ? GOLD_BRIGHT : kind === 2 ? GOLD_DEEP : GOLD;
        const size = (kind === 2 ? 2.4 : kind === 1 ? 1.9 : 1.3) * dpr;
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
        ctx.beginPath();
        ctx.arc(proj[i * 3], proj[i * 3 + 1], size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Equator ring for the HUD look.
      ctx.strokeStyle = `rgba(${GOLD[0]},${GOLD[1]},${GOLD[2]},0.35)`;
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      ctx.ellipse(
        cx,
        cy,
        radius * 1.12,
        radius * 0.34,
        -0.35,
        0,
        Math.PI * 2,
      );
      ctx.stroke();

      // Transmission beam: globe surface → the satellite, fading as it lands.
      if (beam && sats.length) {
        const age = clock - beam.startClock;
        if (age > BEAM_FRAMES) {
          beam = null;
        } else {
          const [tx, ty, tz] = satPos(beam.sat);
          const len = Math.hypot(tx, ty, tz) || 1;
          const pr = age / BEAM_FRAMES;
          const [sx0, sy0] = project(tx / len, ty / len, tz / len);
          const [hx, hy] = project(
            (tx / len) * (1 + (len - 1) * pr),
            (ty / len) * (1 + (len - 1) * pr),
            (tz / len) * (1 + (len - 1) * pr),
          );
          ctx.strokeStyle = `rgba(${GOLD_BRIGHT[0]},${GOLD_BRIGHT[1]},${GOLD_BRIGHT[2]},${0.7 * (1 - pr)})`;
          ctx.lineWidth = 1.4 * dpr;
          ctx.beginPath();
          ctx.moveTo(sx0, sy0);
          ctx.lineTo(hx, hy);
          ctx.stroke();
          ctx.fillStyle = `rgba(${GOLD_BRIGHT[0]},${GOLD_BRIGHT[1]},${GOLD_BRIGHT[2]},${0.95 * (1 - pr * 0.5)})`;
          ctx.beginPath();
          ctx.arc(hx, hy, 2.2 * dpr, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // The satellites themselves — brand-colored nodes with a gold halo.
      for (let si = 0; si < sats.length; si++) {
        const [px3, py3, pz3] = satPos(si);
        const [sx1, sy1, depth] = project(px3, py3, pz3);
        const alpha = 0.55 + 0.45 * (1 - depth) * 0.5;
        const { rgb } = sats[si];
        ctx.strokeStyle = `rgba(${GOLD[0]},${GOLD[1]},${GOLD[2]},${alpha * 0.6})`;
        ctx.lineWidth = 1 * dpr;
        ctx.beginPath();
        ctx.arc(sx1, sy1, 4.6 * dpr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
        ctx.beginPath();
        ctx.arc(sx1, sy1, 2.6 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const tick = () => {
      if (!dragging) {
        yaw += velYaw;
        pitch += velPitch;
        // inertia decay back toward the idle spin
        velPitch *= 0.95;
        if (!reduceMotion) {
          velYaw = velYaw * 0.97 + 0.0035 * 0.03;
        } else {
          velYaw *= 0.95;
        }
        pitch = Math.max(-1.2, Math.min(1.2, pitch));
      }
      if (!reduceMotion) {
        clock++;
        if (sats.length > 0 && !beam && clock % BEAM_EVERY === 0) {
          beam = {
            sat: Math.floor(Math.random() * sats.length),
            startClock: clock,
          };
        }
      }
      draw();
      const idle =
        !dragging &&
        reduceMotion &&
        Math.abs(velYaw) < 0.0001 &&
        Math.abs(velPitch) < 0.0001;
      if (running && !idle) raf = requestAnimationFrame(tick);
      else raf = 0;
    };

    const start = () => {
      if (running && raf) return;
      running = true;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      yaw += dx * 0.006;
      pitch += dy * 0.004;
      pitch = Math.max(-1.2, Math.min(1.2, pitch));
      velYaw = dx * 0.0015;
      velPitch = dy * 0.0008;
      start(); // reduced-motion: dragging still animates while it settles
    };
    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
    };

    resize();
    draw();
    if (!reduceMotion) start();

    const ro = new ResizeObserver(() => {
      resize();
      draw();
    });
    ro.observe(canvas);

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (!reduceMotion) start();
      } else stop();
    });
    io.observe(canvas);

    const onVisibility = () => {
      if (document.hidden) stop();
      else if (!reduceMotion) start();
    };
    document.addEventListener("visibilitychange", onVisibility);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
    };
  }, [satKey]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="holo-sphere"
      aria-label="Interactive network globe — drag to spin"
      role="img"
      className={`h-full w-full cursor-grab touch-none active:cursor-grabbing ${className ?? ""}`}
    />
  );
}
