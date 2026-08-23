'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { LiproLogo } from '@/components/LiproLogo';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-[#f7f7f8] p-4 dark:bg-[#0a0a0c]">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-[#0a0a0c] ring-1 ring-white/10">
          <LiproLogo className="h-8 w-8" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-500">Error</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-lipro-900 dark:text-lipro-50">
          Something went wrong.
        </h1>
        <p className="mt-3 text-sm text-lipro-600/70 dark:text-lipro-200/60">
          That&apos;s on us, not you. Try again, or head back to the homepage.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="rounded-full bg-[#0a0a0c] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-full border border-lipro-200 px-5 py-2.5 text-sm font-semibold text-lipro-900 transition-all hover:bg-lipro-50 active:scale-[0.98] dark:border-lipro-700/40 dark:text-lipro-50 dark:hover:bg-lipro-950/40"
          >
            Go to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
