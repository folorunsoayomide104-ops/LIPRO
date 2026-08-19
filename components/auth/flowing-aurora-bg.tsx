'use client';
import { useEffect, useRef } from 'react';

// Canvas-based recreation of the reference clip's background: a near-black
// canvas with two large soft-edged glow fields (violet + cyan) that drift
// past each other on independent slow elliptical paths, additively blended
// so their overlap washes toward white-violet the way the source does —
// rather than the flat blurred-circle "aurora" look this replaces. Colors
// were sampled directly from the reference frames.
const BASE = '#06070c';
const VIOLET = '117, 76, 230';
const CYAN = '45, 190, 216';

export default function FlowingAuroraBg({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      const canvasEl = canvasRef.current;
      if (!canvasEl) return;
      w = canvasEl.clientWidth;
      h = canvasEl.clientHeight;
      canvasEl.width = w * dpr;
      canvasEl.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    function blob(cx: number, cy: number, r: number, color: string, alpha: number) {
      const g = ctx!.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(${color}, ${alpha})`);
      g.addColorStop(1, `rgba(${color}, 0)`);
      ctx!.fillStyle = g;
      ctx!.fillRect(0, 0, w, h);
    }

    function draw(t: number) {
      const s = t * 0.001; // seconds, so every coefficient below reads as "cycles per second"

      ctx!.globalCompositeOperation = 'source-over';
      ctx!.fillStyle = BASE;
      ctx!.fillRect(0, 0, w, h);

      ctx!.globalCompositeOperation = 'lighter';
      const maxDim = Math.max(w, h);

      const violetX = w * 0.24 + Math.sin(s * 0.32) * w * 0.32;
      const violetY = h * 0.7 + Math.cos(s * 0.24) * h * 0.26;
      const violetR = maxDim * (0.46 + Math.sin(s * 0.18) * 0.08);
      blob(violetX, violetY, violetR, VIOLET, 0.6);

      const cyanX = w * 0.76 + Math.cos(s * 0.36 + 2) * w * 0.32;
      const cyanY = h * 0.3 + Math.sin(s * 0.27 + 1) * h * 0.26;
      const cyanR = maxDim * (0.44 + Math.cos(s * 0.21) * 0.08);
      blob(cyanX, cyanY, cyanR, CYAN, 0.55);

      const driftX = w * 0.5 + Math.sin(s * 0.2 + 4) * w * 0.4;
      const driftY = h * 0.5 + Math.cos(s * 0.23 + 3) * h * 0.32;
      blob(driftX, driftY, maxDim * 0.3, VIOLET, 0.22);

      ctx!.globalCompositeOperation = 'source-over';
    }

    if (reduceMotion) {
      draw(0);
    } else {
      const loop = (t: number) => {
        draw(t);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      window.removeEventListener('resize', resize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
