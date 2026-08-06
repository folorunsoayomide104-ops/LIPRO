'use client';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { LiproLogo } from '@/components/LiproLogo';
import { RotateCcw, Smartphone, Monitor } from 'lucide-react';

const DEVICES = [
  { name: 'iPhone 14 Pro Max', w: 430, h: 932, radius: 55, island: true },
  { name: 'iPhone 14 / 13', w: 390, h: 844, radius: 47, island: true },
  { name: 'iPhone SE', w: 375, h: 667, radius: 40, island: false },
  { name: 'Pixel 7', w: 412, h: 915, radius: 28, island: false },
  { name: 'Galaxy S23', w: 360, h: 780, radius: 24, island: false },
];

const QUICK_LINKS = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Courses', path: '/courses' },
  { label: 'Notes', path: '/notes' },
  { label: 'CBT', path: '/cbt' },
  { label: 'LIPRO AI', path: '/lipro-ai' },
  { label: 'Wallet', path: '/wallet' },
  { label: 'Settings', path: '/settings' },
];

export function DevicePreview() {
  const [device, setDevice] = useState(DEVICES[0]);
  const [url, setUrl] = useState('/dashboard');
  const [urlInput, setUrlInput] = useState('/dashboard');
  const [frameKey, setFrameKey] = useState(0);
  const scaleRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const compute = () => {
      const el = scaleRef.current;
      if (!el) return;
      const avail = el.clientWidth;
      setScale(Math.min(1, (avail - 24) / device.w));
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (scaleRef.current) ro.observe(scaleRef.current);
    return () => ro.disconnect();
  }, [device.w]);

  const navigate = (path: string) => {
    setUrl(path);
    setUrlInput(path);
    setFrameKey((k) => k + 1);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0c]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2 text-white">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 ring-1 ring-white/10">
            <LiproLogo className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight">Device Preview</div>
            <div className="text-[10px] uppercase tracking-wider text-white/50">LIPRO Academy · iPhone 14 Pro Max 430×932</div>
          </div>
        </div>
        <button
          onClick={() => setFrameKey((k) => k + 1)}
          className="tap flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white/80 transition-colors hover:bg-white/20"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reload frame
        </button>
      </header>

      <div className="flex flex-col gap-4 border-b border-white/10 px-4 py-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-white/50"><Smartphone className="h-3.5 w-3.5" /> Device</span>
          {DEVICES.map((d) => (
            <button
              key={d.name}
              onClick={() => setDevice(d)}
              className={cn(
                'tap rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                device.name === d.name ? 'bg-lipro-600 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'
              )}
            >
              {d.name} <span className="opacity-70">{d.w}×{d.h}</span>
            </button>
          ))}
        </div>
        <form
          className="flex flex-1 items-center gap-2 lg:max-w-xl"
          onSubmit={(e) => { e.preventDefault(); navigate(urlInput.startsWith('/') ? urlInput : `/${urlInput}`); }}
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-white/50"><Monitor className="h-3.5 w-3.5 inline" /> URL</span>
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="/dashboard"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-xs text-white outline-none placeholder:text-white/30 focus:border-lipro-500/60"
          />
          <button type="submit" className="tap rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/20">Go</button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        {QUICK_LINKS.map((l) => (
          <button
            key={l.path}
            onClick={() => navigate(l.path)}
            className={cn(
              'tap rounded-full px-3 py-1 text-xs font-medium transition-all',
              url === l.path ? 'bg-lipro-600 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'
            )}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 items-start justify-center overflow-auto px-3 py-8" ref={scaleRef}>
        <div style={{ width: device.w * scale, height: device.h * scale }} className="shrink-0">
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <div
              className="relative mx-auto bg-black p-[10px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
              style={{ width: device.w, height: device.h, borderRadius: device.radius }}
            >
              <div className="relative h-full w-full overflow-hidden rounded-[calc(max(device.radius,0px)-10px)] bg-white" style={{ borderRadius: Math.max(device.radius - 10, 0) }}>
                {device.island && (
                  <div className="absolute left-1/2 top-2 z-10 h-[26px] w-[100px] -translate-x-1/2 rounded-full bg-black" aria-hidden="true" />
                )}
                <iframe
                  key={`${device.w}-${frameKey}`}
                  src={url}
                  className="h-full w-full border-0"
                  title={`Preview of ${url} at ${device.w}×${device.h}`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
