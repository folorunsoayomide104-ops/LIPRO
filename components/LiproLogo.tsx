import { useId } from 'react';

export function LiproLogo({ className }: { className?: string }) {
  const id = useId();
  const gradId = `ls-${id.replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.25" stopColor="#cbd5e1" />
          <stop offset="0.5" stopColor="#94a3b8" />
          <stop offset="0.75" stopColor="#cbd5e1" />
          <stop offset="1" stopColor="#64748b" />
        </linearGradient>
      </defs>
      <path
        d="M22 14 A26 26 0 0 1 22 66 L22 88 L78 88"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
