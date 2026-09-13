'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowUpRight } from 'lucide-react';

const EASE = [0.22, 1, 0.36, 1] as const;

export default function InsightCarousel({ insights }: { insights: string[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || insights.length <= 1) return;
    const t = setInterval(() => setI((v) => (v + 1) % insights.length), 4500);
    return () => clearInterval(t);
  }, [paused, insights.length]);

  return (
    <div
      className="relative flex h-full min-h-[260px] flex-col justify-between overflow-hidden rounded-xl p-1"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* dot-grid texture, matching the reference's AI panel */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.5]"
        style={{
          backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)',
          backgroundSize: '16px 16px',
          maskImage: 'radial-gradient(ellipse 100% 90% at 70% 30%, black 0%, transparent 75%)',
        }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-studio-primary/20 blur-3xl" />

      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-studio-elevated px-3 py-1 text-[11px] font-semibold text-studio-muted shadow-studio-border backdrop-blur">
          <Sparkles className="h-3 w-3" /> AI Insights
        </span>
      </div>

      <div className="relative mt-auto">
        <div className="mb-3 flex items-center gap-1.5">
          {insights.map((_, dotIdx) => (
            <button
              key={dotIdx}
              onClick={() => setI(dotIdx)}
              aria-label={`Show insight ${dotIdx + 1}`}
              className={`h-1.5 rounded-full transition-all ${dotIdx === i ? 'w-5 bg-studio-primary' : 'w-1.5 bg-studio-primary/25'}`}
            />
          ))}
        </div>
        <div className="flex items-end justify-between gap-3">
          <AnimatePresence mode="wait">
            <motion.p
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="font-studio-display max-w-[85%] text-lg leading-snug tracking-tight text-studio-fg"
            >
              {insights[i]}
            </motion.p>
          </AnimatePresence>
          <Link
            href="/lipro-ai"
            aria-label="Open LIPRO AI"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-studio-primary text-studio-primary-fg shadow-studio-border transition-transform hover:scale-105 active:scale-95"
          >
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
