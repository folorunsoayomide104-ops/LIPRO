import Link from 'next/link';

const PALETTE = [
  { name: 'Matte Black', hex: '#070708', text: 'text-zinc-200' },
  { name: 'Graphite', hex: '#475569', text: 'text-zinc-100' },
  { name: 'Platinum', hex: '#cbd5e1', text: 'text-zinc-900' },
  { name: 'Silver', hex: '#94a3b8', text: 'text-zinc-900' },
  { name: 'Bright White', hex: '#ffffff', text: 'text-zinc-900' },
];

const PRINCIPLES = [
  { title: 'Minimal', desc: 'A single unbroken line. No decoration, no noise.' },
  { title: 'Memorable', desc: 'One stroke forms both letters. Instantly drawn, instantly recalled.' },
  { title: 'Balanced', desc: 'Set on a golden-ratio grid with optical centering in a perfect square.' },
  { title: 'Timeless', desc: 'Platinum on matte black — quiet luxury that never dates.' },
];

function Construction() {
  return (
    <div className="relative mx-auto aspect-square w-64 sm:w-80">
      <img src="/logo/lipro-mark.svg" alt="LIPRO monogram with construction grid" className="relative z-10 h-full w-full" />
      <svg viewBox="0 0 100 100" className="absolute inset-0 z-20 h-full w-full" aria-hidden="true">
        <g stroke="#cbd5e1" strokeOpacity="0.28" strokeWidth="0.35" strokeDasharray="1.5 2" fill="none">
          <line x1="22" y1="0" x2="22" y2="100" />
          <line x1="48" y1="0" x2="48" y2="100" />
          <line x1="78" y1="0" x2="78" y2="100" />
          <line x1="61.8" y1="0" x2="61.8" y2="100" />
          <line x1="0" y1="14" x2="100" y2="14" />
          <line x1="0" y1="40" x2="100" y2="40" />
          <line x1="0" y1="66" x2="100" y2="66" />
          <line x1="0" y1="88" x2="100" y2="88" />
          <circle cx="22" cy="40" r="26" />
          <circle cx="22" cy="40" r="42" strokeOpacity="0.14" />
        </g>
      </svg>
    </div>
  );
}

export default function LogoPage() {
  return (
    <div className="min-h-screen bg-[#070708] text-zinc-300 antialiased">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-[#1e293b]/30 blur-[140px]" />
        <div className="relative mx-auto max-w-4xl px-6 py-24 text-center md:py-32">
          <img src="/logo/lipro-lockup.svg" alt="LIPRO ACADEMY" className="mx-auto w-[320px] max-w-full sm:w-[420px]" />
          <p className="mt-10 text-[11px] font-medium uppercase tracking-[0.45em] text-zinc-500">Intelligence · Education · Excellence</p>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-zinc-500">
            A luxury EdTech identity — the L &amp; P monogram rendered as a single
            continuous stroke in polished platinum on matte black.
          </p>
        </div>
      </section>

      {/* Principles */}
      <section className="border-b border-white/5">
        <div className="mx-auto grid max-w-5xl gap-px bg-white/5 sm:grid-cols-2 lg:grid-cols-4">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="bg-[#0a0a0c] p-8">
              <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-600">{p.title}</div>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Construction */}
      <section className="border-b border-white/5">
        <div className="mx-auto grid max-w-5xl items-center gap-12 px-6 py-20 md:grid-cols-2 md:py-28">
          <Construction />
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white">Geometry, not decoration</h2>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">
              The mark is a single unbroken path. The vertical stem is shared — it reads as the
              bowl of the <span className="text-zinc-200">P</span> at the top and the foot of the{' '}
              <span className="text-zinc-200">L</span> at the base. Two letters, one stroke.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-zinc-500">
              <li>· Perfect semicircle bowl — radius 26 on a 100 grid</li>
              <li>· Optical center at the golden-ratio line 61.8</li>
              <li>· Uniform 8-unit stroke, rounded caps and joins</li>
              <li>· Square tile, generous negative space</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Palette */}
      <section className="border-b border-white/5">
        <div className="mx-auto max-w-5xl px-6 py-20 md:py-24">
          <h2 className="text-3xl font-bold tracking-tight text-white">Palette</h2>
          <p className="mt-2 text-sm text-zinc-500">Platinum silver swept across a matte black field.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-5">
            {PALETTE.map((c) => (
              <div key={c.hex} className="overflow-hidden rounded-2xl border border-white/10">
                <div className="flex h-24 items-center justify-center" style={{ background: c.hex }}>
                  <span className={`text-[10px] font-semibold uppercase tracking-widest ${c.text}`}>{c.hex}</span>
                </div>
                <div className="bg-[#0a0a0c] px-3 py-2.5 text-xs text-zinc-400">{c.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Typography */}
      <section className="border-b border-white/5">
        <div className="mx-auto grid max-w-5xl gap-12 px-6 py-20 md:grid-cols-2 md:py-24">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white">Typography</h2>
            <p className="mt-2 text-sm text-zinc-500">Outfit — geometric, futuristic, precise.</p>
            <div className="mt-8 rounded-2xl border border-white/10 bg-[#0a0a0c] p-8">
              <div className="text-4xl font-bold tracking-[0.18em] text-white">LIPRO</div>
              <div className="mt-2 text-sm font-medium tracking-[0.4em] text-zinc-500">ACADEMY</div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-zinc-600">
              Tight weight contrast: bold letterspaced display over a light, widely tracked
              subline. Clean negative space, no serifs, no noise.
            </p>
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white">&amp; Application</h2>
            <p className="mt-2 text-sm text-zinc-500">Clearspace and usage.</p>
            <div className="mt-8 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-[#0a0a0c] p-8">
                <img src="/logo/lipro-mark.svg" alt="Mark on dark" className="h-16 w-16" />
                <p className="mt-4 text-xs text-zinc-600">On matte black — the primary lockup.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-zinc-100 p-8">
                <img src="/logo/lipro-mark-inverse.svg" alt="Mark on light" className="h-16 w-16" />
                <p className="mt-4 text-xs text-zinc-500">On light fields — the inverse graphite mark.</p>
              </div>
              <p className="text-xs text-zinc-600">
                Keep at least one bowl-radius of clear space on all sides. Minimum size 20px for the mark.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Downloads */}
      <section className="mx-auto max-w-5xl px-6 py-16 text-center">
        <h2 className="text-xl font-bold tracking-tight text-white">Download</h2>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a href="/logo/lipro-mark.svg" download className="rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/10">Mark (SVG)</a>
          <a href="/logo/lipro-lockup.svg" download className="rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/10">Lockup (SVG)</a>
          <a href="/logo/lipro-mark-inverse.svg" download className="rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/10">Inverse (SVG)</a>
        </div>
        <p className="mt-8 text-xs text-zinc-600">
          <Link href="/" className="text-zinc-400 underline-offset-4 hover:underline">Back to homepage</Link>
        </p>
      </section>
    </div>
  );
}
