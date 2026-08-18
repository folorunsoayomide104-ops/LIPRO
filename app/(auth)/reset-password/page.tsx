'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { LiproLogo } from '@/components/LiproLogo';

export default function ResetPasswordPage() {
  const router = useRouter();
  const tokenRef = useRef<string | null>(null);
  const [validToken, setValidToken] = useState<boolean | null>(null);
  // null while checking; once known, tells us whether this is a first-time
  // password (Google-only account) or an actual reset, so the copy can be
  // accurate instead of always saying "reset" to someone who never had one.
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = new URLSearchParams(window.location.search).get('token');
    tokenRef.current = token;
    if (!token) { setValidToken(false); return; }
    fetch(`/api/auth/reset-password/info?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        setValidToken(!!data?.valid);
        setHasPassword(data?.valid ? !!data.hasPassword : null);
      })
      .catch(() => setValidToken(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true); setError('');
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenRef.current, password }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) { setError(data?.error || 'Reset failed'); setLoading(false); return; }
    setDone(true);
    setTimeout(() => router.push('/login'), 2000);
  };

  if (validToken === null) return null;

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="card w-full max-w-md">
        <div className="mb-6 flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#0a0a0c] ring-1 ring-white/10">
            <LiproLogo className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{hasPassword === false ? 'Set a password' : 'Set a new password'}</h1>
            <p className="text-xs text-lipro-600/70 dark:text-lipro-200/60">
              {hasPassword === false
                ? 'This adds a password to your Google account, so you can sign in either way.'
                : 'Choose a strong password to secure your account'}
            </p>
          </div>
        </div>
        {done ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/60 p-4 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
            <div className="mb-1 flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4" /> {hasPassword === false ? 'Password set' : 'Password updated'}
            </div>
            {hasPassword === false
              ? 'You can now sign in with this password or continue using Google. Redirecting you to sign in…'
              : 'Redirecting you to sign in…'}
          </div>
        ) : validToken === false ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-50/60 p-4 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            <div className="mb-1 flex items-center gap-2 font-semibold">
              <AlertCircle className="h-4 w-4" /> Invalid or missing reset link
            </div>
            Use the link from your reset email, or request a new one.
            <div className="mt-3">
              <Link href="/forgot-password" className="font-medium text-lipro-600 hover:underline">Request a new reset link</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="password">New password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lipro-400" />
                <Input id="password" type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 pr-10" placeholder="At least 8 characters" minLength={8} required />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-lipro-400 transition-colors hover:text-lipro-600"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="confirm">Confirm password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lipro-400" />
                <Input id="confirm" type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="pl-10" placeholder="Re-enter your password" minLength={8} required />
              </div>
            </div>
            {error && (
              <p className="flex items-center gap-2 text-sm text-rose-500">
                <AlertCircle className="h-4 w-4" /> {error}
              </p>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (hasPassword === false ? 'Setting…' : 'Updating…') : hasPassword === false ? 'Set password' : 'Update password'} <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-lipro-600/70 dark:text-lipro-200/60">
          <Link href="/login" className="font-medium text-lipro-600 hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
