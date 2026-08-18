'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { LiproLogo } from '@/components/LiproLogo';

const ERROR_MESSAGES: Record<string, string> = {
  google_not_configured: 'Google Sign-In isn’t set up yet, so there’s no way to reset a password right now. Contact support for help.',
  google_state: 'That didn’t go through — please try again.',
  google_failed: 'That didn’t go through — please try again.',
  no_account: 'No LIPRO Academy account uses that Google email. Double-check you’re signing in with the right Google account, or create an account instead.',
};

export default function ForgotPasswordPage() {
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const code = new URLSearchParams(window.location.search).get('error');
    if (code) setError(ERROR_MESSAGES[code] || 'Something went wrong. Please try again.');
  }, []);

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="card w-full max-w-md">
        <div className="mb-6 flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#0a0a0c] ring-1 ring-white/10">
            <LiproLogo className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Forgot password</h1>
            <p className="text-xs text-lipro-600/70 dark:text-lipro-200/60">Verify it&apos;s you with Google, then set a new one</p>
          </div>
        </div>

        {error && (
          <p className="mb-4 flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-50/60 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </p>
        )}

        <p className="mb-5 text-sm text-lipro-600/70 dark:text-lipro-200/60">
          This account&apos;s email doesn&apos;t need to match how you originally signed up — as long as it&apos;s the same email your LIPRO Academy account uses, signing in with Google proves it&apos;s you and lets you set a new password.
        </p>

        <a
          href="/api/auth/google/reset"
          className="flex w-full items-center justify-center gap-2 rounded-full border border-lipro-200 bg-white py-3 text-sm font-semibold text-lipro-900 transition-all hover:bg-lipro-50 active:scale-[0.98] dark:border-lipro-700/40 dark:bg-surface-dark dark:text-lipro-50 dark:hover:bg-lipro-950/40"
        >
          <GoogleIcon className="h-4 w-4" /> Continue with Google
        </a>

        <p className="mt-6 text-center text-sm text-lipro-600/70 dark:text-lipro-200/60">
          Remembered it? <Link href="/login" className="font-medium text-lipro-600 hover:underline">Back to sign in</Link>
        </p>
        <p className="mt-4 text-center text-sm text-lipro-600/70 dark:text-lipro-200/60">
          <Link href="/" className="font-medium text-lipro-600 hover:underline">Visit homepage</Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.5c-2 1.4-4.6 2.3-7.5 2.3-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.3 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.5 5.5C41.5 35.9 44 30.3 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}
