'use client';
import { useEffect, useRef, useState } from 'react';
import { LiproLogo } from '@/components/LiproLogo';
import { RotateCcw, X, Monitor } from 'lucide-react';

const W = 430;
const H = 932;

export function MobileModeFrame({ src, onExit }: { src: string; onExit: () => void }) {
  const [frameKey, setFrameKey] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const compute = () => {
      const el = wrapRef.current;
      if (!el) return;
      const availW = el.clientWidth - 24;
      const availH = el.clientHeight - 24;
      setScale(Math.min(1, availW / W, availH / H));
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex h-screen flex-col bg-[#0a0a0c]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2 text-white">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 ring-1 ring-white/10">
            <LiproLogo className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight">Mobile view</div>
            <div className="text-[10px] uppercase tracking-wider text-white/50">iPhone 14 Pro Max · 430×932</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFrameKey((k) => k + 1)}
            className="tap flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white/80 transition-colors hover:bg-white/20"
            title="Reload frame"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reload
          </button>
          <button
            onClick={onExit}
            className="tap flex items-center gap-1.5 rounded-lg bg-lipro-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-lipro-500"
            title="Switch to desktop view"
          >
            <Monitor className="h-3.5 w-3.5" /> Desktop view
          </button>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-auto p-3" ref={wrapRef}>
        <div style={{ width: W * scale, height: H * scale }} className="shrink-0">
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <div className="relative bg-black p-[10px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]" style={{ width: W, height: H, borderRadius: 55 }}>
              <div className="relative h-full w-full overflow-hidden bg-white" style={{ borderRadius: 45 }}>
                <div className="absolute left-1/2 top-2 z-10 h-[26px] w-[100px] -translate-x-1/2 rounded-full bg-black" aria-hidden="true" />
                <iframe
                  key={frameKey}
                  src={src}
                  className="h-full w-full border-0"
                  title={`Mobile preview of ${src}`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
