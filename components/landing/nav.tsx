'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LiproLogo } from '@/components/LiproLogo';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LandingNav() {
  const [open, setOpen] = useState(false);
  return (
    <nav className="sticky top-0 z-40 w-full">
      <div className="glass mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#0a0a0c] ring-1 ring-white/10">
            <LiproLogo className="h-5 w-5" />
          </div>
          <span className="text-base font-bold tracking-tight">LIPRO ACADEMY</span>
        </Link>
        <div className="hidden items-center gap-6 text-sm font-medium text-lipro-700/80 dark:text-lipro-200/80 md:flex">
          <a href="#about" className="hover:text-lipro-600">About</a>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
          <Link href="/register"><Button size="sm">Get started</Button></Link>
        </div>
        <button className="tap grid h-10 w-10 place-items-center rounded-xl md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu" aria-expanded={open}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open && (
        <div className="glass mx-auto flex max-w-7xl flex-col gap-2 border-t border-lipro-200/20 px-4 py-4 md:hidden">
          <a href="#about" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-medium text-lipro-700/80 hover:bg-lipro-50 dark:text-lipro-200/80 dark:hover:bg-lipro-950/40">About</a>
          <div className="mt-1 flex gap-2">
            <Link href="/login" className="flex-1" onClick={() => setOpen(false)}><Button variant="ghost" className="w-full">Sign in</Button></Link>
            <Link href="/register" className="flex-1" onClick={() => setOpen(false)}><Button className="w-full">Get started</Button></Link>
          </div>
        </div>
      )}
    </nav>
  );
}
