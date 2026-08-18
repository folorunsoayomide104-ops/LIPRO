'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence } from 'framer-motion';
import { Input, Label } from '@/components/ui/input';
import { Eye, EyeOff } from 'lucide-react';
import { LiproLogo } from '@/components/LiproLogo';
import { LoginIntro, LoginMascots } from '@/components/auth/login-mascots';

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
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  // The tumble-in + preloader only play once per browser session — a
  // returning user re-visiting /login shouldn't sit through it every time.
  const [showIntro, setShowIntro] = useState(false);
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      redirectRef.current = params.get('redirect');
      const oauthError = params.get('error');
      if (oauthError === 'google_not_configured') setError('Google Sign-In isn’t set up yet. Use email and password below.');
      else if (oauthError === 'google_state' || oauthError === 'google_failed') setError('Google Sign-In didn’t go through. Please try again.');

      if (sessionStorage.getItem('lipro_login_intro_seen')) {
        setIntroDone(true);
      } else {
        setShowIntro(true);
        sessionStorage.setItem('lipro_login_intro_seen', '1');
      }
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
    <>
      <AnimatePresence>
        {showIntro && !introDone && <LoginIntro onDone={() => setIntroDone(true)} />}
      </AnimatePresence>
    <div className="grid min-h-screen place-items-center bg-[#0a0a0c] p-4 md:p-8">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-[2rem] shadow-2xl shadow-black/50 ring-1 ring-white/10 md:grid-cols-2">
        {/* Illustration panel */}
        <div className="relative hidden flex-col items-center justify-end gap-8 overflow-hidden bg-[#e9e9ea] p-10 md:flex dark:bg-[#141518]">
          <LoginMascots
            ready={introDone}
            instant={!showIntro}
            emailFocused={emailFocused}
            passwordFocused={passwordFocused}
          />
          <div className="relative text-center">
            <p className="font-display text-lg font-semibold text-lipro-900 dark:text-lipro-50">
              Your Life In Progress.
            </p>
            <p className="mt-1 text-sm text-lipro-700/70 dark:text-lipro-200/60">
              Practice smarter, study with LIPRO AI, and track every gain.
            </p>
          </div>
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
                  onFocus={() => setEmailFocused(true)} onBlur={() => setEmailFocused(false)}
                  placeholder="you@example.com" required
                  className="rounded-none border-0 border-b border-lipro-200 bg-transparent px-0 focus:border-lipro-500 focus:ring-0 dark:border-lipro-700/40"
                />
              </div>
              <div>
                <Label htmlFor="password" className="normal-case tracking-normal">Password</Label>
                <div className="relative">
                  <Input
                    id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setPasswordFocused(true)} onBlur={() => setPasswordFocused(false)}
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

            <div className="mt-4">
              <a
                href="/api/auth/google"
                className="flex w-full items-center justify-center gap-2 rounded-full border border-lipro-200 bg-white py-3 text-sm font-semibold text-lipro-900 transition-all hover:bg-lipro-50 active:scale-[0.98] dark:border-lipro-700/40 dark:bg-surface-dark dark:text-lipro-50 dark:hover:bg-lipro-950/40"
              >
                <GoogleIcon className="h-4 w-4" /> Log in with Google
              </a>
            </div>

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
    </>
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
