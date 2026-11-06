"use client";

import { useEffect, useRef } from "react";
import { reducedMotion } from "../motion.js";

type BurstOptions = { x?: number; y?: number; count?: number; power?: number; colors?: string[] };
type ConfettiApi = { burst: (o?: BurstOptions) => void; cannons: (colors?: string[]) => void };

let api: ConfettiApi | null = null;

/** Appels utilisables partout : confetti.burst({ x, y }) et confetti.cannons(). Repris de Pauline. */
export const confetti = {
  burst: (o?: BurstOptions) => api?.burst(o),
  cannons: (colors?: string[]) => api?.cannons(colors),
};

type Particle = {
  x: number; y: number; vx: number; vy: number; w: number; h: number;
  rot: number; vr: number; tilt: number; vt: number; round: boolean; color: string; life: number; max: number;
};

/** Couche unique de confettis, au-dessus de l'expérience. */
export function ConfettiLayer({ colors }: { colors: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const c2d = canvas?.getContext("2d");
    if (!canvas || !c2d) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let parts: Particle[] = [];
    let raf = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const spawn = (x: number, y: number, angle: number, spread: number, power: number, palette: string[]) => {
      const a = angle + (Math.random() - 0.5) * spread;
      const v = power * (0.55 + Math.random() * 0.6);
      parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        w: 5 + Math.random() * 7, h: 3 + Math.random() * 5,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
        tilt: Math.random() * Math.PI, vt: 0.08 + Math.random() * 0.12,
        round: Math.random() < 0.3,
        color: palette[Math.floor(Math.random() * palette.length)] ?? "#ffffff",
        life: 0, max: 140 + Math.random() * 90,
      });
    };

    const loop = () => {
      c2d.clearRect(0, 0, w, h);
      parts = parts.filter((p) => p.life < p.max && p.y < h + 40);
      for (const p of parts) {
        p.life++;
        p.vx *= 0.985;
        p.vy = p.vy * 0.985 + 0.16;
        p.x += p.vx + Math.sin(p.life * 0.07) * 0.4;
        p.y += p.vy;
        p.rot += p.vr;
        p.tilt += p.vt;
        c2d.save();
        c2d.globalAlpha = Math.min(1, (p.max - p.life) / 40);
        c2d.translate(p.x, p.y);
        c2d.rotate(p.rot);
        c2d.scale(Math.cos(p.tilt), 1);
        c2d.fillStyle = p.color;
        if (p.round) {
          c2d.beginPath();
          c2d.arc(0, 0, p.h * 0.7, 0, Math.PI * 2);
          c2d.fill();
        } else c2d.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        c2d.restore();
      }
      raf = parts.length ? requestAnimationFrame(loop) : 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };

    api = {
      burst({ x = w / 2, y = h / 2, count = 60, power = 9, colors: palette = colors } = {}) {
        const n = reducedMotion() ? Math.min(count, 14) : count;
        for (let i = 0; i < n; i++) spawn(x, y, -Math.PI / 2, Math.PI * 2, power, palette);
        kick();
      },
      cannons(palette = colors) {
        const n = reducedMotion() ? 20 : 90;
        for (let i = 0; i < n; i++) {
          spawn(-10, h * 0.85, -Math.PI / 3.2, 0.6, 19, palette);
          spawn(w + 10, h * 0.85, -Math.PI + Math.PI / 3.2, 0.6, 19, palette);
        }
        kick();
      },
    };

    return () => {
      api = null;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [colors]);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[85] h-full w-full" />;
}
