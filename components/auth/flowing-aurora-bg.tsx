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
      ctx!.globalCompositeOperation = 'source-over';
      ctx!.fillStyle = BASE;
      ctx!.fillRect(0, 0, w, h);

      ctx!.globalCompositeOperation = 'lighter';

      const violetX = w * 0.22 + Math.sin(t * 0.00014) * w * 0.16;
      const violetY = h * 0.72 + Math.cos(t * 0.00011) * h * 0.14;
      blob(violetX, violetY, Math.max(w, h) * 0.62, VIOLET, 0.55);

      const cyanX = w * 0.78 + Math.cos(t * 0.00016 + 2) * w * 0.16;
      const cyanY = h * 0.28 + Math.sin(t * 0.00013 + 1) * h * 0.16;
      blob(cyanX, cyanY, Math.max(w, h) * 0.58, CYAN, 0.5);

      const driftX = w * 0.5 + Math.sin(t * 0.00009 + 4) * w * 0.22;
      const driftY = h * 0.5 + Math.cos(t * 0.0001 + 3) * h * 0.18;
      blob(driftX, driftY, Math.max(w, h) * 0.38, VIOLET, 0.18);

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
