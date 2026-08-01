'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LiproLogo } from '@/components/LiproLogo';

export function LandingNav() {
  return (
    <nav className="sticky top-0 z-40 w-full">
      <div className="glass mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#0a0a0c] ring-1 ring-white/10">
            <LiproLogo className="h-5 w-5" />
          </div>
          <span className="text-base font-bold tracking-tight">LIPRO ACADEMY</span>
        </Link>
        <div className="hidden items-center gap-6 text-sm font-medium text-lipro-700/80 dark:text-lipro-200/80 md:flex">
          <a href="#about" className="hover:text-lipro-600">About</a>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
          <Link href="/register"><Button size="sm">Get started</Button></Link>
        </div>
      </div>
    </nav>
  );
}
