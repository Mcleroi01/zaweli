"use client";

import { useEffect, useRef } from "react";
import { reducedMotion } from "../motion.js";

type Mote = { x: number; y: number; r: number; vx: number; vy: number; tw: number };

/** Poussière lumineuse qui flotte lentement. En pause hors écran. Reprise de Pauline. */
export function Dust({ density = 5, rgb = "214, 184, 120", className = "" }: { density?: number; rgb?: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let raf = 0;
    let motes: Mote[] = [];

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        const a = 0.25 + 0.35 * Math.sin(t * 0.0012 + m.tw);
        ctx.fillStyle = `rgba(${rgb}, ${a})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(((w * h) / 10000) * density * (w < 768 ? 0.6 : 1));
      motes = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h, r: 0.4 + Math.random() * 1.4,
        vx: (Math.random() - 0.5) * 0.12, vy: -0.05 - Math.random() * 0.18, tw: Math.random() * Math.PI * 2,
      }));
      draw(0);
    };

    const tick = (t: number) => {
      for (const m of motes) {
        m.x += m.vx;
        m.y += m.vy;
        if (m.y < -4) {
          m.y = h + 4;
          m.x = Math.random() * w;
        }
        if (m.x < -4) m.x = w + 4;
        if (m.x > w + 4) m.x = -4;
      }
      draw(t);
      raf = requestAnimationFrame(tick);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(raf);
      if (entry?.isIntersecting && !reducedMotion()) raf = requestAnimationFrame(tick);
    });
    io.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [density, rgb]);

  return <canvas ref={ref} aria-hidden="true" className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />;
}
