'use client';

import { useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Wraps existing `.card` content with a cursor-tracked radial glow on hover.
 * Pure mouse-event driven (no CSS :hover), so it's naturally inert on touch —
 * no separate `(hover: hover)` gate needed. Adapted from 21st.dev's Spotlight
 * Card (preetsuthar17) to sit on top of this app's own `.card`/`.glass`
 * classes instead of replacing them.
 */
export function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(168, 85, 247, 0.25)',
}: {
  children: ReactNode;
  className?: string;
  spotlightColor?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={cn('relative', className)}
    >
      {/* Clipped to the card's own shape, separately from the outer div — so
          content that intentionally overflows the card (e.g. a badge pinned
          above the top edge) isn't cut off by this layer's own clipping. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <div
          className="absolute inset-0 transition-opacity duration-500 ease-out motion-reduce:hidden"
          style={{
            opacity,
            background: `radial-gradient(240px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 70%)`,
          }}
        />
      </div>
      {children}
    </div>
  );
}
