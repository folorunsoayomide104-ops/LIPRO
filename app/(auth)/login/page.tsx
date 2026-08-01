'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { LiproLogo } from '@/components/LiproLogo';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agree, setAgree] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) { setError('Please accept the Privacy Policy and Terms to continue.'); return; }
    setLoading(true); setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) { setError(data?.error || 'Login failed'); setLoading(false); return; }
    const redirect = search.get('redirect') || '/dashboard';
    router.push(redirect);
  };

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="card w-full max-w-md">
        <div className="mb-6 flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#0a0a0c] ring-1 ring-white/10">
            <LiproLogo className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-xs text-lipro-600/70 dark:text-lipro-200/60">Sign in to LIPRO Academy</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lipro-400" />
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" placeholder="you@example.com" required />
            </div>
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lipro-400" />
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" placeholder="••••••••" required />
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm text-lipro-600/80 dark:text-lipro-200/70">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-lipro-600"
            />
            <span>
              I agree to the{' '}
              <Link href="/privacy" className="font-medium text-lipro-600 hover:underline">Privacy Policy</Link>{' '}
              and{' '}
              <Link href="/terms" className="font-medium text-lipro-600 hover:underline">Terms of Service</Link>.
            </span>
          </label>
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <Button type="submit" disabled={loading || !agree} className="w-full">
            {loading ? 'Signing in…' : 'Sign in'} <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-lipro-600/70 dark:text-lipro-200/60">
          New here? <Link href="/register" className="font-medium text-lipro-600 hover:underline">Create an account</Link>
        </p>
        <div className="mt-4 rounded-xl bg-lipro-50/50 p-3 text-xs text-lipro-700/80 dark:bg-lipro-950/30 dark:text-lipro-200/70">
          <div className="font-semibold mb-1">Demo accounts (password: Password123!):</div>
          <div>superadmin@lipro.academy · admin@lipro.academy</div>
          <div>lecturer@lipro.academy · student@lipro.academy</div>
        </div>
      </div>
    </div>
  );
}
