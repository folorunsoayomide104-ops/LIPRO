'use client';
import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, BookOpen, StickyNote, Layers, Brain, Wallet as WalletIcon, Bell, Settings, LogOut, Menu, Home, ArrowRight, MoreHorizontal, Smartphone, Monitor, Sparkles, ShieldCheck
} from 'lucide-react';
import { LiproLogo } from '@/components/LiproLogo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useViewMode } from '@/components/view-mode-provider';
import { MobileModeFrame } from '@/components/mobile-mode-frame';

// Exact colors sampled from the NeuroBank dashboard reference clip — used
// verbatim here rather than the app's lipro-violet tokens, since matching
// the reference precisely was the point of this pass.
const REF_ACCENT = '#3559F7';
const REF_ACCENT_2 = '#545AC5';
const REF_ELEVATED = '#20212C';

const ADMIN_NAV_ITEM = { label: 'Admin', href: '/admin', icon: ShieldCheck, highlight: false };

const NAV = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Courses', href: '/courses', icon: BookOpen },
  { label: 'Notes', href: '/notes', icon: StickyNote },
  { label: 'Flashcards', href: '/flashcards', icon: Layers },
  { label: 'CBT Engine', href: '/cbt', icon: Brain },
  { label: 'LIPRO AI', href: '/lipro-ai', icon: LiproLogo, highlight: true },
  { label: 'Wallet', href: '/wallet', icon: WalletIcon },
  { label: 'Settings', href: '/settings', icon: Settings },
];

// Looked up by href rather than fixed indices into NAV — a positional
// reference silently breaks (points at the wrong tab) the moment NAV grows
// or reorders, which is exactly what adding Flashcards above just did.
const MOBILE_TAB_HREFS = ['/dashboard', '/courses', '/cbt', '/lipro-ai'];
const MOBILE_TABS = MOBILE_TAB_HREFS.map((href) => NAV.find((item) => item.href === href)!);

export function LayoutShell({ children, roleLabel, isAdmin, unreadCount = 0 }: { children: ReactNode; roleLabel?: string; isAdmin?: boolean; unreadCount?: number }) {
  const navItems = isAdmin ? [NAV[0], ADMIN_NAV_ITEM, ...NAV.slice(1)] : NAV;
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [inFrame, setInFrame] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { viewMode, setViewMode } = useViewMode();

  useEffect(() => {
    setInFrame(typeof window !== 'undefined' && window.self !== window.top);
    setIsMobile(typeof window !== 'undefined' && window.innerWidth < 768);
  }, []);

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => {
      if (d.user?.avatarUrl) setAvatarUrl(d.user.avatarUrl);
      if (d.user?.fullName) setFullName(d.user.fullName);
    }).catch(() => {});
    const onAvatar = (e: Event) => setAvatarUrl((e as CustomEvent).detail || null);
    window.addEventListener('avatar-updated', onAvatar);
    return () => window.removeEventListener('avatar-updated', onAvatar);
  }, []);

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
  const firstName = fullName?.split(' ')[0] || 'there';

  useEffect(() => {
    navItems.forEach((item) => router.prefetch(item.href));
    router.prefetch('/notifications');
  }, [router, navItems]);

  const logout = async () => {
    await fetch('/api/auth/login', { method: 'DELETE' });
    router.push('/login');
  };

  const Sidebar = () => (
    <aside className="flex h-full w-72 max-w-[85vw] flex-col p-4">
      <div className="mb-4 flex shrink-0 items-center gap-2.5 px-2">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ring-white/10"
          style={{ background: `linear-gradient(135deg, ${REF_ACCENT_2}, ${REF_ACCENT})` }}
        >
          <LiproLogo className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <div className="heading truncate text-sm font-bold tracking-tight uppercase">LIPRO Academy</div>
          <div className="truncate text-[10px] uppercase tracking-wider text-lipro-500">{roleLabel || 'AI Learning Platform'}</div>
        </div>
      </div>

      {/* Welcome card — avatar, greeting, date, theme toggle, matching the reference sidebar */}
      <div
        className="mb-4 flex shrink-0 items-center justify-between gap-2 rounded-2xl p-3"
        style={{ background: REF_ELEVATED }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-lipro-500 to-indigo-500 text-xs font-bold text-white">
            {avatarUrl ? <img src={avatarUrl} alt="Your avatar" className="h-full w-full object-cover" /> : firstName[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[10px] font-semibold uppercase tracking-wider text-white/40">{today}</div>
            <div className="truncate text-sm font-bold text-white">Welcome back, {firstName}!</div>
          </div>
        </div>
        <div className="shrink-0"><ThemeToggle /></div>
      </div>

      {/* Nav list scrolls independently — the welcome card and bottom CTA
          stay pinned, so nothing gets clipped on shorter phone screens no
          matter how tall this list gets. */}
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                active
                  ? 'bg-[rgb(168_85_247_/_0.08)] text-lipro-900 dark:bg-[#20212C] dark:text-white'
                  : 'text-lipro-600/70 hover:bg-lipro-50 dark:text-lipro-200/70 dark:hover:bg-white/[0.04]'
              )}
            >
              {active && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full" style={{ background: REF_ACCENT }} aria-hidden="true" />}
              <Icon className="h-4 w-4 shrink-0" style={active ? { color: REF_ACCENT } : undefined} />
              <span className="truncate">{item.label}</span>
              {item.highlight && (
                <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white" style={{ background: REF_ACCENT }}>
                  <Sparkles className="h-2.5 w-2.5" /> AI
                </span>
              )}
              {active && !item.highlight && <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0" style={{ color: REF_ACCENT }} />}
            </Link>
          );
        })}
      </div>

      <div className="shrink-0 pt-4">
        <Link
          href="/lipro-ai"
          onClick={() => setMobileOpen(false)}
          className="mb-2 flex w-full flex-col items-start gap-1 rounded-2xl p-4 text-left text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.99]"
          style={{ background: `linear-gradient(135deg, ${REF_ACCENT_2}, ${REF_ACCENT})`, boxShadow: `0 12px 28px -12px ${REF_ACCENT}66` }}
        >
          <span className="inline-flex items-center gap-1.5 text-sm font-bold"><Sparkles className="h-4 w-4" /> Ask LIPRO AI</span>
          <span className="text-xs text-white/80">Get instant help with any topic</span>
        </Link>
        <Link href="/" onClick={() => setMobileOpen(false)} className="mb-2 flex w-full items-center gap-3 rounded-xl border border-lipro-200/50 bg-lipro-50/50 px-3 py-2.5 text-sm font-medium text-lipro-700 transition-colors hover:bg-lipro-100/60 dark:border-lipro-500/20 dark:bg-lipro-950/30 dark:text-lipro-200 dark:hover:bg-lipro-950/50">
          <Home className="h-4 w-4 shrink-0" /> <span className="truncate">Visit homepage</span>
        </Link>
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-500 transition-all hover:bg-rose-50 dark:hover:bg-rose-950/30">
          <LogOut className="h-4 w-4 shrink-0" /> Sign out
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
            <Link href="/notifications" className="tap relative grid h-10 w-10 place-items-center rounded-xl glass-hover" aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}>
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-none text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
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
