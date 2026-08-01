type Variant = 'aurora' | 'sheen' | 'beams' | 'mesh' | 'dots' | 'drift' | 'breathe' | 'orb3d'

const DOTS = [
  { left: '12%', top: '62%', size: 'h-2 w-2', delay: '0s' },
  { left: '30%', top: '36%', size: 'h-1.5 w-1.5', delay: '-2.4s' },
  { left: '52%', top: '68%', size: 'h-2.5 w-2.5', delay: '-5.2s' },
  { left: '70%', top: '28%', size: 'h-1.5 w-1.5', delay: '-1.4s' },
  { left: '86%', top: '56%', size: 'h-2 w-2', delay: '-3.8s' },
  { left: '24%', top: '80%', size: 'h-1 w-1', delay: '-6.1s' },
]

export default function AmbientBackground({
  variant = 'aurora',
  className = '',
}: {
  variant?: Variant
  className?: string
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {variant === 'aurora' && (
        <>
          <div className="amb-drift absolute -left-1/4 -top-1/3 h-[85%] w-1/2 rounded-full bg-gradient-to-br from-lipro-500/25 via-lipro-400/10 to-transparent blur-3xl" />
          <div className="amb-drift-slow absolute -bottom-1/3 right-[-15%] h-[75%] w-1/2 rounded-full bg-gradient-to-br from-indigo-500/20 via-fuchsia-500/10 to-transparent blur-3xl" />
        </>
      )}
      {variant === 'sheen' && (
        <div
          className="amb-spin absolute -inset-1/2 opacity-[0.08]"
          style={{
            background:
              'conic-gradient(from 0deg, transparent 0deg, rgba(124,92,255,0.7) 80deg, transparent 160deg, rgba(34,211,238,0.6) 250deg, transparent 320deg)',
          }}
        />
      )}
      {variant === 'beams' && (
        <>
          <div
            className="amb-spin absolute -inset-1/2 opacity-[0.07]"
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0deg, rgba(124,92,255,0.7) 80deg, transparent 160deg, rgba(34,211,238,0.6) 250deg, transparent 320deg)',
            }}
          />
          <div className="amb-sweep absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        </>
      )}
      {variant === 'mesh' && (
        <>
          <div
            className="amb-shift absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'linear-gradient(rgb(124 92 255 / 0.6) 1px, transparent 1px), linear-gradient(90deg, rgb(124 92 255 / 0.6) 1px, transparent 1px)',
              backgroundSize: '26px 26px',
            }}
          />
          <div className="amb-breathe absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lipro-500/20 blur-3xl" />
        </>
      )}
      {variant === 'dots' && (
        <div className="absolute inset-0">
          {DOTS.map((d, i) => (
            <span
              key={i}
              className={`amb-rise absolute rounded-full bg-lipro-400/70 ${d.size}`}
              style={{ left: d.left, top: d.top, animationDelay: d.delay }}
            />
          ))}
        </div>
      )}
      {variant === 'drift' && (
        <>
          <div className="amb-drift absolute -right-10 -top-10 h-40 w-40 rounded-full bg-lipro-400/10 blur-2xl" />
          <div className="amb-drift-slow absolute -bottom-12 -left-6 h-48 w-48 rounded-full bg-indigo-400/10 blur-2xl" />
        </>
      )}
      {variant === 'breathe' && (
        <div className="amb-breathe absolute -right-[10%] -top-[20%] h-56 w-56 rounded-full bg-gradient-to-br from-lipro-500/25 to-indigo-400/15 blur-3xl" />
      )}
      {variant === 'orb3d' && (
        <div className="absolute inset-0 [perspective:900px]">
          <div className="amb-tilt absolute left-1/2 top-1/2 h-[440px] w-[440px] [transform-style:preserve-3d]">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-lipro-500/25 via-transparent to-indigo-500/20 blur-2xl" />
            <div
              className="absolute inset-[12%] rounded-full border border-lipro-400/25"
              style={{ transform: 'rotateX(70deg)', willChange: 'transform' }}
            />
            <div
              className="absolute inset-[12%] rounded-full border border-cyan-400/20"
              style={{ transform: 'rotateY(70deg)', willChange: 'transform' }}
            />
            <div className="absolute inset-[30%] rounded-full bg-white/10 blur-xl" />
          </div>
        </div>
      )}
    </div>
  )
}
