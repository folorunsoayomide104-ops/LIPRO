'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
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

function Eye({ look, shy, blinking, mirror, size = 13 }: { look: LookVector | null; shy: boolean; blinking: boolean; mirror?: boolean; size?: number }) {
  const pupil = size * 0.46;
  const maxOffset = (size - pupil) / 2 - 1;
  const ox = look ? look.x * maxOffset : 0;
  const oy = look ? look.y * maxOffset : 0;
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white transition-transform duration-[180ms] ease-out"
      style={{ width: size, height: size, transform: blinking && !shy ? 'scaleY(0.12)' : 'scaleY(1)' }}
    >
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

// Idle bob lives on an inner wrapper, separate from the outer motion.div's
// fall-in transform — letting a one-time spring entrance and a continuous
// breathing loop coexist without fighting over the same transform property.
const bobStyle = (phaseOffset: number): React.CSSProperties => ({
  animation: 'lipro-mascot-bob 4.2s ease-in-out infinite',
  animationDelay: `${phaseOffset}s`,
});

/**
 * The four-character stack from the reference: purple + black rectangles,
 * an orange half-circle in front, a yellow capsule to the right.
 *
 * Beyond the original fall-in + cursor-tracked eyes, this version adds:
 * idle breathing (staggered per character, so they don't move in unison),
 * randomized independent blinking, gaze that targets the *actual* focused
 * input's screen position (via the refs the parent passes in) rather than
 * a hardcoded look vector, per-shape contact shadows for physical stacking
 * depth, and a one-time "celebrate" beat for a successful login.
 */
export function LoginMascots({
  ready,
  instant,
  emailFocused,
  passwordFocused,
  emailRef,
  passwordRef,
  celebrate,
}: {
  ready: boolean;
  instant: boolean;
  emailFocused: boolean;
  passwordFocused: boolean;
  emailRef?: RefObject<HTMLElement | null>;
  passwordRef?: RefObject<HTMLElement | null>;
  celebrate?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const [look, setLook] = useState<LookVector>({ x: 0, y: 0 });
  const [blinking, setBlinking] = useState<Record<number, boolean>>({});
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

  // Real gaze targeting: compute the actual on-screen vector from the
  // character stack's center to the focused input's bounding box, rather
  // than a fixed { x: 0.9, y: 0.5 } guess that only happened to line up
  // with one specific layout.
  const [targetLook, setTargetLook] = useState<LookVector | null>(null);
  useEffect(() => {
    const target = emailFocused ? emailRef?.current : null;
    if (!target || !containerRef.current) {
      setTargetLook(null);
      return;
    }
    const update = () => {
      const c = containerRef.current;
      if (!c) return;
      const box = c.getBoundingClientRect();
      const t = target.getBoundingClientRect();
      const dist = 520;
      setTargetLook({
        x: Math.max(-1, Math.min(1, (t.left + t.width / 2 - (box.left + box.width / 2)) / dist)),
        y: Math.max(-1, Math.min(1, (t.top + t.height / 2 - (box.top + box.height / 2)) / dist)),
      });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [emailFocused, emailRef]);

  // Independent, randomized blink loop per eye-pair — staggered intervals
  // so all four characters never blink in sync, which reads as robotic.
  useEffect(() => {
    if (reduce) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    [0, 1, 2, 3].forEach((i) => {
      const tick = () => {
        setBlinking((b) => ({ ...b, [i]: true }));
        setTimeout(() => setBlinking((b) => ({ ...b, [i]: false })), 220);
        timers[i] = setTimeout(tick, 2200 + Math.random() * 3600);
      };
      timers[i] = setTimeout(tick, 800 + Math.random() * 2000 + i * 300);
    });
    return () => timers.forEach(clearTimeout);
  }, [reduce]);

  const effectiveLook: LookVector | null = passwordFocused ? null : emailFocused ? (targetLook ?? { x: 0.9, y: 0.5 }) : look;
  const initial = instant ? false : 'hidden';
  const animate = ready ? 'show' : 'hidden';

  return (
    <div ref={containerRef} className="relative h-[210px] w-[280px]">
      <style>{`
        @keyframes lipro-mascot-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes lipro-mascot-shadow { 0%, 100% { transform: scaleX(1); opacity: 0.22; } 50% { transform: scaleX(0.94); opacity: 0.15; } }
        @keyframes lipro-mascot-hop { 0% { transform: translateY(0) rotate(0); } 35% { transform: translateY(-26px) rotate(-6deg); } 65% { transform: translateY(-26px) rotate(4deg); } 100% { transform: translateY(0) rotate(0); } }
        @keyframes lipro-mascot-nod { 0%, 100% { transform: translateY(0); } 40% { transform: translateY(-8px); } }
      `}</style>

      {/* Grounding contact shadow, breathing in sync-ish with the stack. */}
      {!reduce && (
        <span
          aria-hidden="true"
          className="absolute bottom-[-4px] left-[20px] h-4 w-[240px] rounded-[50%] bg-black"
          style={{ animation: 'lipro-mascot-shadow 4.2s ease-in-out infinite' }}
        />
      )}

      {/* Purple — back layer */}
      <motion.div
        initial={initial}
        animate={animate}
        variants={reduce ? undefined : fall(0, -22)}
        style={celebrate ? { animation: 'lipro-mascot-nod 620ms cubic-bezier(0.23,1,0.32,1) 60ms' } : undefined}
        className="absolute bottom-0 left-[22px] z-10"
      >
        <div style={reduce ? undefined : bobStyle(-0.6)}>
          <div style={{ width: 98, height: 172, background: PURPLE, boxShadow: '8px 0 14px -6px rgba(0,0,0,0.25)' }} className="rounded-t-lg">
            <div className="flex justify-center gap-[9px] pt-[22px]">
              <Eye look={effectiveLook} shy={passwordFocused} blinking={!!blinking[0]} />
              <Eye look={effectiveLook} shy={passwordFocused} blinking={!!blinking[0]} mirror />
            </div>
            <div className="mt-[7px] flex justify-center">
              <span className="h-[3px] w-[15px] rounded-full opacity-80" style={{ background: INK }} />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Black — front-right of purple */}
      <motion.div
        initial={initial}
        animate={animate}
        variants={reduce ? undefined : fall(0.26, 30)}
        style={celebrate ? { animation: 'lipro-mascot-nod 620ms cubic-bezier(0.23,1,0.32,1) 100ms' } : undefined}
        className="absolute bottom-0 left-[98px] z-20"
      >
        <div style={reduce ? undefined : bobStyle(-1.8)}>
          <div style={{ width: 62, height: 136, background: BLACK, boxShadow: '6px 0 12px -6px rgba(0,0,0,0.3)' }} className="rounded-t-lg">
            <div className="flex justify-center gap-[8px] pt-[18px]">
              <Eye look={effectiveLook} shy={passwordFocused} blinking={!!blinking[1]} size={14} />
              <Eye look={effectiveLook} shy={passwordFocused} blinking={!!blinking[1]} mirror size={14} />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Yellow — right, in front of black's edge */}
      <motion.div
        initial={initial}
        animate={animate}
        variants={reduce ? undefined : fall(0.14, -18)}
        style={celebrate ? { animation: 'lipro-mascot-nod 620ms cubic-bezier(0.23,1,0.32,1) 40ms' } : undefined}
        className="absolute bottom-0 left-[156px] z-30"
      >
        <div style={reduce ? undefined : bobStyle(-2.6)}>
          <div style={{ width: 76, height: 116, background: YELLOW, boxShadow: '-4px 0 10px -6px rgba(0,0,0,0.2)' }} className="rounded-t-full">
            <div className="relative pt-[38px]">
              <div className="flex justify-center">
                <Eye look={effectiveLook} shy={passwordFocused} blinking={!!blinking[2]} size={9} />
              </div>
              <span
                className="absolute left-[52px] top-[42px] h-[2px] w-[42px] rounded-full opacity-90"
                style={{ background: INK }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Orange — frontmost, covers the base of the others */}
      <motion.div
        initial={initial}
        animate={animate}
        variants={reduce ? undefined : fall(0.06, 16)}
        style={celebrate ? { animation: 'lipro-mascot-hop 620ms cubic-bezier(0.23,1,0.32,1)' } : undefined}
        className="absolute bottom-0 left-[6px] z-40"
      >
        <div style={reduce ? undefined : bobStyle(-0.2)}>
          <div style={{ width: 150, height: 75, background: ORANGE, boxShadow: 'inset 0 -3px 8px -2px rgba(0,0,0,0.18)' }} className="rounded-t-full">
            <div className="flex justify-center gap-[13px] pt-[16px]">
              <Eye look={effectiveLook} shy={passwordFocused} blinking={!!blinking[3]} size={11} />
              <Eye look={effectiveLook} shy={passwordFocused} blinking={!!blinking[3]} mirror size={11} />
            </div>
            <div className="mt-[5px] flex justify-center">
              <span className="h-[7px] w-[15px] rounded-b-full" style={{ background: INK }} />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
