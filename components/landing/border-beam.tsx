import { cn } from '@/lib/utils';

/**
 * A light beam that travels the border of its (relatively-positioned)
 * parent. Adapted from 21st.dev's Border Beam (dillionverma / Magic UI).
 * Reserved for a single, rare element (the hero's primary CTA) — this is
 * decorative/delight-tier motion, not a state indicator, so it's suppressed
 * under prefers-reduced-motion via the `motion-reduce:hidden` class.
 */
export function BorderBeam({
  className,
  size = 80,
  duration = 8,
  borderWidth = 1.5,
  anchor = 90,
  colorFrom = '#c084fc',
  colorTo = '#818cf8',
  delay = 0,
}: {
  className?: string;
  size?: number;
  duration?: number;
  borderWidth?: number;
  anchor?: number;
  colorFrom?: string;
  colorTo?: string;
  delay?: number;
}) {
  return (
    <div
      aria-hidden
      style={
        {
          '--size': size,
          '--duration': duration,
          '--anchor': anchor,
          '--border-width': borderWidth,
          '--color-from': colorFrom,
          '--color-to': colorTo,
          '--delay': `-${delay}s`,
        } as React.CSSProperties
      }
      className={cn(
        'pointer-events-none absolute inset-0 rounded-[inherit] motion-reduce:hidden',
        '[border:calc(var(--border-width)*1px)_solid_transparent]',
        '![mask-clip:padding-box,border-box] ![mask-composite:intersect] [mask:linear-gradient(transparent,transparent),linear-gradient(white,white)]',
        'after:absolute after:aspect-square after:w-[calc(var(--size)*1px)] after:animate-border-beam after:[animation-delay:var(--delay)] after:[background:linear-gradient(to_left,var(--color-from),var(--color-to),transparent)] after:[offset-anchor:calc(var(--anchor)*1%)_50%] after:[offset-path:rect(0_auto_auto_0_round_calc(var(--size)*1px))]',
        className
      )}
    />
  );
}
