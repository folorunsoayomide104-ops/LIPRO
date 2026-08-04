'use client';
import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, BookOpen, StickyNote, Brain, Wallet as WalletIcon, Bell, Settings, LogOut, Menu, Home, ArrowRight, MoreHorizontal, GraduationCap, Smartphone, Monitor
} from 'lucide-react';
import { LiproLogo } from '@/components/LiproLogo';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useViewMode } from '@/components/view-mode-provider';
import { MobileModeFrame } from '@/components/mobile-mode-frame';

const NAV = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Courses', href: '/courses', icon: BookOpen },
  { label: 'Notes', href: '/notes', icon: StickyNote },
  { label: 'CBT Engine', href: '/cbt', icon: Brain },
  { label: 'LIPRO AI', href: '/lipro-ai', icon: LiproLogo, highlight: true },
  { label: 'PDF Intelligence', href: '/pdf-intelligence', icon: GraduationCap, highlight: true },
  { label: 'Wallet', href: '/wallet', icon: WalletIcon },
  { label: 'Settings', href: '/settings', icon: Settings },
];

const MOBILE_TABS = [
  NAV[0], // Dashboard
  NAV[1], // Courses
  NAV[3], // CBT Engine
  NAV[4], // LIPRO AI
];

export function LayoutShell({ children, roleLabel }: { children: ReactNode; roleLabel?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [inFrame, setInFrame] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { viewMode, setViewMode } = useViewMode();

  useEffect(() => {
    setInFrame(typeof window !== 'undefined' && window.self !== window.top);
    setIsMobile(typeof window !== 'undefined' && window.innerWidth < 768);
  }, []);

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => { if (d.user?.avatarUrl) setAvatarUrl(d.user.avatarUrl); }).catch(() => {});
    const onAvatar = (e: Event) => setAvatarUrl((e as CustomEvent).detail || null);
    window.addEventListener('avatar-updated', onAvatar);
    return () => window.removeEventListener('avatar-updated', onAvatar);
  }, []);

  useEffect(() => {
    NAV.forEach((item) => router.prefetch(item.href));
    router.prefetch('/notifications');
  }, [router]);

  const logout = async () => {
    await fetch('/api/auth/login', { method: 'DELETE' });
    router.push('/login');
  };

  const Sidebar = () => (
    <aside className="flex h-full w-64 flex-col gap-1 p-4">
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#0a0a0c] ring-1 ring-white/10">
          <LiproLogo className="h-5 w-5" />
        </div>
        <div>
          <div className="heading text-sm font-bold tracking-tight uppercase">LIPRO Academy</div>
          <div className="text-[10px] uppercase tracking-wider text-lipro-500">{roleLabel || 'AI Learning Platform'}</div>
        </div>
      </div>
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/');
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={cn('group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all', active ? 'glass text-lipro-700 dark:text-white' : 'text-lipro-600/70 hover:bg-lipro-50 dark:text-lipro-200/70 dark:hover:bg-lipro-950/40')}>
            {active && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-lipro-500" aria-hidden="true" />}
            <Icon className={cn('h-4 w-4', active && 'text-lipro-600')} />
            <span>{item.label}</span>
            {item.highlight && <span className="ml-auto h-2 w-2 rounded-full bg-lipro-500 animate-glow" />}
            {active && <ArrowRight className="ml-auto h-3.5 w-3.5 text-lipro-400" />}
          </Link>
        );
      })}
      <div className="mt-auto px-2 pt-4">
        <Link href="/" onClick={() => setMobileOpen(false)} className="mb-2 flex w-full items-center gap-3 rounded-xl border border-lipro-200/50 bg-lipro-50/50 px-3 py-2.5 text-sm font-medium text-lipro-700 transition-colors hover:bg-lipro-100/60 dark:border-lipro-500/20 dark:bg-lipro-950/30 dark:text-lipro-200 dark:hover:bg-lipro-950/50">
          <Home className="h-4 w-4" /> Visit homepage
        </Link>
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-500 transition-all hover:bg-rose-50 dark:hover:bg-rose-950/30">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </aside>
  );

  return (
    viewMode === 'mobile' && !inFrame && !isMobile ? (
      <MobileModeFrame src={pathname} onExit={() => setViewMode('desktop')} />
    ) : (
    <div className="flex min-h-screen">
      <div className="sticky top-0 hidden h-screen lg:block">{Sidebar()}</div>
      {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} /><div className="absolute left-0 top-0 h-full glass">{Sidebar()}</div></div>}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-lipro-100/60 bg-white/70 px-4 backdrop-blur-xl dark:border-lipro-500/10 dark:bg-surface-dark/70">
          <button className="tap lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu className="h-6 w-6" /></button>
          <div className="ml-auto flex items-center gap-2">
            {!inFrame && (
              <button onClick={() => setViewMode(viewMode === 'mobile' ? 'desktop' : 'mobile')} className="tap hidden lg:flex items-center gap-1.5 rounded-xl border border-lipro-200/60 px-3 py-2 text-xs font-medium text-lipro-700 transition-colors hover:bg-lipro-50 dark:border-lipro-500/20 dark:text-lipro-200 dark:hover:bg-lipro-950/40" aria-label="Toggle view mode" title="Toggle mobile/desktop view">
                {viewMode === 'mobile' ? <Monitor className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                {viewMode === 'mobile' ? 'Desktop' : 'Mobile'}
              </button>
            )}
            <Link href="/notifications" className="tap grid h-10 w-10 place-items-center rounded-xl glass-hover" aria-label="Notifications"><Bell className="h-5 w-5" /></Link>
            <Link href="/settings" className="tap ml-1 flex items-center gap-2 rounded-xl glass px-3 py-1.5" aria-label="Account">
              <div className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-lipro-500 to-lipro-700 text-xs font-bold text-white">
                {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" /> : 'U'}
              </div>
              <span className="hidden text-xs font-medium sm:inline">Account</span>
            </Link>
          </div>
        </header>
        <main className="flex-1 px-4 pb-tabbar pt-2 lg:pb-12">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-50 flex items-stretch border-t border-lipro-100/60 bg-white/80 backdrop-blur-xl lg:hidden dark:border-lipro-500/10 dark:bg-surface-dark/80" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {MOBILE_TABS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={cn('tap flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors', active ? 'text-lipro-600 dark:text-lipro-400' : 'text-lipro-600/60 dark:text-lipro-200/50')}>
              <Icon className={cn('h-5 w-5', active && 'scale-110')} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
        <button onClick={() => setMobileOpen(true)} className={cn('tap flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors', mobileOpen ? 'text-lipro-600 dark:text-lipro-400' : 'text-lipro-600/60 dark:text-lipro-200/50')} aria-label="More">
          <MoreHorizontal className="h-5 w-5" />
          <span>More</span>
        </button>
      </nav>
    </div>
    )
  );
}
