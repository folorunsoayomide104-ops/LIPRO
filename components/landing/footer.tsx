import Link from 'next/link';
import { LiproLogo } from '@/components/LiproLogo';

export function LandingFooter() {
  return (
    <footer className="px-4 pb-12 pt-16">
      <div className="glass mx-auto max-w-7xl rounded-2xl p-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#0a0a0c] ring-1 ring-white/10">
                <LiproLogo className="h-5 w-5" />
              </div>
              <span className="font-bold">LIPRO ACADEMY</span>
            </Link>
            <p className="mt-3 text-xs text-lipro-700/60 dark:text-lipro-200/60">Smarter revision for Nigerian university students.</p>
          </div>
          {[
            { title: 'Product', links: [{ label: 'LIPRO AI', href: '/lipro-ai' }] },
            { title: 'Account', links: [{ label: 'Sign in', href: '/login' }, { label: 'Register', href: '/register' }, { label: 'Wallet', href: '/wallet' }] },
            { title: 'Legal', links: [{ label: 'Privacy Policy', href: '/privacy' }, { label: 'Terms', href: '/terms' }] },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-lipro-600/80 dark:text-lipro-200/80">{col.title}</h4>
              <ul className="mt-3 space-y-2 text-sm">
                {col.links.map((l) => (
                  <li key={l.label}><Link href={l.href} className="text-lipro-700/70 hover:text-lipro-600 dark:text-lipro-200/70">{l.label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-8 border-t border-lipro-200/30 pt-6 text-center text-xs text-lipro-700/50 dark:text-lipro-200/50">
          © {new Date().getFullYear()} LIPRO ACADEMY. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
