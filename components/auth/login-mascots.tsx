'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';

// Colors sampled directly from the reference clip: preloader purple, panel
// gray, and each character's fill — kept exact rather than approximated so
// the reskin reads as the same illustration, not a lookalike.
const PRELOADER_BG = '#5A0EE0';
const INK = '#15161b';
const PURPLE = '#6213F6';
const BLACK = '#1A1B21';
const ORANGE = '#F27C36';
const YELLOW = '#E6DE1F';

/**
 * Full-bleed preloader: a two-dot goo loader that splits, bounces, then
 * merges and blooms open to reveal the page underneath. Matches the
 * reference clip's opening ~1.6s. Shown once per browser session.
 */
export function LoginIntro({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion();

  useEffect(() => {
    const t = setTimeout(onDone, reduce ? 200 : 1650);
    return () => clearTimeout(t);
  }, [onDone, reduce]);

  if (reduce) {
    return (
      <motion.div
        className="fixed inset-0 z-[100]"
        style={{ background: PRELOADER_BG }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />
    );
  }

  return (
    <motion.div
      className="fixed inset-0 z-[100] grid place-items-center"
      style={{ background: PRELOADER_BG }}
      exit={{ opacity: 0, transition: { duration: 0.35, ease: [0.23, 1, 0.32, 1] } }}
    >
      <svg width="0" height="0" className="absolute">
        <filter id="lipro-login-goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
          <feColorMatrix in="blur" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" />
        </filter>
      </svg>
      <div className="relative h-10 w-10" style={{ filter: 'url(#lipro-login-goo)' }}>
        <motion.span
          className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
          animate={{ x: [0, -9, -9, 0, 0], y: [0, 0, -2, 0, 0], scale: [1, 1, 1, 1, 30] }}
          transition={{ duration: 1.55, times: [0, 0.32, 0.52, 0.72, 1], ease: [0.23, 1, 0.32, 1] }}
        />
        <motion.span
          className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
          animate={{ x: [0, 9, 9, 0, 0], y: [0, 0, 2, 0, 0], scale: [1, 1, 1, 1, 0] }}
          transition={{ duration: 1.55, times: [0, 0.32, 0.52, 0.72, 1], ease: [0.23, 1, 0.32, 1] }}
        />
      </div>
    </motion.div>
  );
}

interface LookVector { x: number; y: number }

function Eye({ look, shy, mirror, size = 13 }: { look: LookVector | null; shy: boolean; mirror?: boolean; size?: number }) {
  const pupil = size * 0.46;
  const maxOffset = (size - pupil) / 2 - 1;
  const ox = look ? look.x * maxOffset : 0;
  const oy = look ? look.y * maxOffset : 0;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center rounded-full bg-white" style={{ width: size, height: size }}>
      {shy ? (
        <span
          className="h-[2px] w-[62%] rounded-full"
          style={{ background: INK, transform: `rotate(${mirror ? 18 : -18}deg)` }}
        />
      ) : (
        <span
          className="rounded-full transition-transform duration-150 ease-out"
          style={{ width: pupil, height: pupil, background: INK, transform: `translate(${ox}px, ${oy}px)` }}
        />
      )}
    </span>
  );
}

const fall = (delay: number, rotate: number): Variants => ({
  hidden: { y: -220, rotate, opacity: 0 },
  show: { y: 0, rotate: 0, opacity: 1, transition: { type: 'spring', stiffness: 140, damping: 14, delay } },
});

/**
 * The four-character stack from the reference: purple + black rectangles,
 * an orange half-circle in front, a yellow capsule to the right. Eyes track
 * the cursor; they look toward the email field on focus and go shy (squint)
 * while the password field is being typed into.
 */
export function LoginMascots({
  ready,
  instant,
  emailFocused,
  passwordFocused,
}: {
  ready: boolean;
  instant: boolean;
  emailFocused: boolean;
  passwordFocused: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const [look, setLook] = useState<LookVector>({ x: 0, y: 0 });
  const reduce = useReducedMotion();

  useEffect(() => {
    function handleMove(e: MouseEvent) {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const max = 420;
        setLook({
          x: Math.max(-1, Math.min(1, (e.clientX - cx) / max)),
          y: Math.max(-1, Math.min(1, (e.clientY - cy) / max)),
        });
      });
    }
    window.addEventListener('mousemove', handleMove);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const effectiveLook: LookVector | null = passwordFocused ? null : emailFocused ? { x: 0.9, y: 0.5 } : look;
  const initial = instant ? false : 'hidden';
  const animate = ready ? 'show' : 'hidden';

  return (
    <div ref={containerRef} className="relative h-[210px] w-[280px]">
      {/* Purple — back layer */}
      <motion.div
        initial={initial}
        animate={animate}
        variants={reduce ? undefined : fall(0, -22)}
        className="absolute bottom-0 left-[22px] z-10"
        style={{ width: 98, height: 172, background: PURPLE }}
      >
        <div className="flex justify-center gap-[9px] pt-[22px]">
          <Eye look={effectiveLook} shy={passwordFocused} />
          <Eye look={effectiveLook} shy={passwordFocused} mirror />
        </div>
        <div className="mt-[7px] flex justify-center">
          <span className="h-[3px] w-[15px] rounded-full opacity-80" style={{ background: INK }} />
        </div>
      </motion.div>

      {/* Black — front-right of purple */}
      <motion.div
        initial={initial}
        animate={animate}
        variants={reduce ? undefined : fall(0.26, 30)}
        className="absolute bottom-0 left-[98px] z-20"
        style={{ width: 62, height: 136, background: BLACK }}
      >
        <div className="flex justify-center gap-[8px] pt-[18px]">
          <Eye look={effectiveLook} shy={passwordFocused} size={14} />
          <Eye look={effectiveLook} shy={passwordFocused} mirror size={14} />
        </div>
      </motion.div>

      {/* Yellow — right, in front of black's edge */}
      <motion.div
        initial={initial}
        animate={animate}
        variants={reduce ? undefined : fall(0.14, -18)}
        className="absolute bottom-0 left-[156px] z-30 rounded-t-full"
        style={{ width: 76, height: 116, background: YELLOW }}
      >
        <div className="relative pt-[38px]">
          <div className="flex justify-center">
            <Eye look={effectiveLook} shy={passwordFocused} size={9} />
          </div>
          <span
            className="absolute left-[52px] top-[42px] h-[2px] w-[42px] rounded-full opacity-90"
            style={{ background: INK }}
          />
        </div>
      </motion.div>

      {/* Orange — frontmost, covers the base of the others */}
      <motion.div
        initial={initial}
        animate={animate}
        variants={reduce ? undefined : fall(0.06, 16)}
        className="absolute bottom-0 left-[6px] z-40 rounded-t-full"
        style={{ width: 150, height: 75, background: ORANGE }}
      >
        <div className="flex justify-center gap-[13px] pt-[16px]">
          <Eye look={effectiveLook} shy={passwordFocused} size={11} />
          <Eye look={effectiveLook} shy={passwordFocused} mirror size={11} />
        </div>
        <div className="mt-[5px] flex justify-center">
          <span className="h-[7px] w-[15px] rounded-b-full" style={{ background: INK }} />
        </div>
      </motion.div>
    </div>
  );
}
