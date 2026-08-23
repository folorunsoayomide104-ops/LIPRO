import Link from 'next/link';
import { LiproLogo } from '@/components/LiproLogo';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f7f7f8] p-4 dark:bg-[#0a0a0c]">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-[#0a0a0c] ring-1 ring-white/10">
          <LiproLogo className="h-8 w-8" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-lipro-500">404</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-lipro-900 dark:text-lipro-50">
          This page doesn&apos;t exist.
        </h1>
        <p className="mt-3 text-sm text-lipro-600/70 dark:text-lipro-200/60">
          The link might be broken, or the page may have moved.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-[#0a0a0c] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
          >
            Go to homepage
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border border-lipro-200 px-5 py-2.5 text-sm font-semibold text-lipro-900 transition-all hover:bg-lipro-50 active:scale-[0.98] dark:border-lipro-700/40 dark:text-lipro-50 dark:hover:bg-lipro-950/40"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
