'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input, Label } from '@/components/ui/input';
import { Eye, EyeOff } from 'lucide-react';
import { LiproLogo } from '@/components/LiproLogo';

export default function LoginPage() {
  return <LoginForm />;
}

function LoginForm() {
  const router = useRouter();
  const redirectRef = useRef<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agree, setAgree] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      redirectRef.current = new URLSearchParams(window.location.search).get('redirect');
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) { setError('Please accept the Privacy Policy and Terms to continue.'); return; }
    setLoading(true); setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, remember }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) { setError(data?.error || 'Login failed'); setLoading(false); return; }
    router.push(redirectRef.current || '/dashboard');
  };

  return (
    <div className="grid min-h-screen place-items-center bg-[#0a0a0c] p-4 md:p-8">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-[2rem] shadow-2xl shadow-black/50 ring-1 ring-white/10 md:grid-cols-2">
        {/* Illustration panel */}
        <div className="relative hidden flex-col justify-end overflow-hidden bg-gradient-to-br from-lipro-50 to-lipro-100 p-10 md:flex dark:from-lipro-950/60 dark:to-lipro-900/40">
          <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-40" viewBox="0 0 400 500" preserveAspectRatio="none" aria-hidden="true">
            <line x1="0" y1="60" x2="400" y2="440" stroke="currentColor" strokeWidth="1" className="text-lipro-400/40" />
          </svg>
          <div aria-hidden className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-lipro-400/20 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -right-10 bottom-10 h-40 w-40 rounded-full bg-amber-300/20 blur-3xl" />

          <div className="relative flex items-end gap-3">
            {/* Book stack */}
            <div className="flex flex-col items-center gap-1">
              <div className="h-3 w-24 rounded-sm bg-amber-400 shadow-sm" />
              <div className="h-3 w-24 rounded-sm bg-lipro-500 shadow-sm" />
              <div className="h-3 w-24 rounded-sm bg-lipro-700 shadow-sm" />
            </div>
            {/* Graduation cap */}
            <div className="relative -ml-2 mb-4">
              <svg width="86" height="70" viewBox="0 0 86 70" fill="none">
                <path d="M43 6L2 24l41 18 41-18-41-18Z" fill="#0a0a0c" />
                <path d="M20 30v16c0 6 10 12 23 12s23-6 23-12V30" stroke="#0a0a0c" strokeWidth="3" strokeLinecap="round" />
                <path d="M76 26v18" stroke="#0a0a0c" strokeWidth="3" strokeLinecap="round" />
                <circle cx="76" cy="48" r="3.5" fill="#F5C842" />
              </svg>
            </div>
            {/* Rounded person shape reading */}
            <div className="relative">
              <div className="h-32 w-16 rounded-t-full bg-indigo-500 shadow-md" />
              <div className="absolute left-1/2 top-9 flex -translate-x-1/2 gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
                <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
              </div>
            </div>
          </div>
          <p className="relative mt-8 font-display text-lg font-semibold text-lipro-900 dark:text-lipro-50">
            Your Life In Progress.
          </p>
          <p className="relative mt-1 text-sm text-lipro-700/70 dark:text-lipro-200/60">
            Practice smarter, study with LIPRO AI, and track every gain.
          </p>
        </div>

        {/* Form panel */}
        <div className="flex flex-col justify-center bg-white p-8 dark:bg-surface-dark sm:p-10">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-6 flex justify-center">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0a0a0c] ring-1 ring-white/10">
                <LiproLogo className="h-6 w-6" />
              </div>
            </div>
            <h1 className="text-center text-2xl font-bold tracking-tight">Welcome back!</h1>
            <p className="mt-1 text-center text-sm text-lipro-600/60 dark:text-lipro-200/50">Sign in to continue your studies</p>

            <form onSubmit={submit} className="mt-8 space-y-5">
              <div>
                <Label htmlFor="email" className="normal-case tracking-normal">Email</Label>
                <Input
                  id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" required
                  className="rounded-none border-0 border-b border-lipro-200 bg-transparent px-0 focus:border-lipro-500 focus:ring-0 dark:border-lipro-700/40"
                />
              </div>
              <div>
                <Label htmlFor="password" className="normal-case tracking-normal">Password</Label>
                <div className="relative">
                  <Input
                    id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" required
                    className="rounded-none border-0 border-b border-lipro-200 bg-transparent px-0 pr-8 focus:border-lipro-500 focus:ring-0 dark:border-lipro-700/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-lipro-400 transition-colors hover:text-lipro-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 text-lipro-600/80 dark:text-lipro-200/70">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-3.5 w-3.5 accent-lipro-600"
                  />
                  Remember for 30 days
                </label>
                <Link href="/forgot-password" className="font-medium text-lipro-600 hover:underline dark:text-lipro-200/80">Forgot password?</Link>
              </div>

              <label className="flex items-start gap-2 text-xs text-lipro-600/70 dark:text-lipro-200/60">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 accent-lipro-600"
                />
                <span>
                  I agree to the{' '}
                  <Link href="/privacy" className="font-medium text-lipro-600 hover:underline">Privacy Policy</Link>{' '}
                  and{' '}
                  <Link href="/terms" className="font-medium text-lipro-600 hover:underline">Terms of Service</Link>.
                </span>
              </label>

              {error && <p className="text-sm text-rose-500">{error}</p>}

              <button
                type="submit"
                disabled={loading || !agree}
                className="w-full rounded-full bg-[#0a0a0c] py-3 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Signing in…' : 'Log In'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-lipro-600/70 dark:text-lipro-200/60">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="font-medium text-lipro-600 hover:underline">Sign Up</Link>
            </p>
            <p className="mt-3 text-center text-xs text-lipro-600/50 dark:text-lipro-200/40">
              <Link href="/" className="hover:underline">Visit homepage</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
