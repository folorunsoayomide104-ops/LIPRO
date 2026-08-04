'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Mail, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { LiproLogo } from '@/components/LiproLogo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(''); setSent('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setError(data?.error || 'Something went wrong. Please try again.'); setLoading(false); return; }
      setSent(data?.message || 'If that email is registered, a reset link is on its way.');
      setEmail('');
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="card w-full max-w-md">
        <div className="mb-6 flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#0a0a0c] ring-1 ring-white/10">
            <LiproLogo className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Forgot password</h1>
            <p className="text-xs text-lipro-600/70 dark:text-lipro-200/60">We will email you a reset link</p>
          </div>
        </div>
        {sent ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/60 p-4 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
            <div className="mb-1 flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4" /> Check your inbox
            </div>
            {sent}
            <p className="mt-2 text-xs opacity-80">The link expires in 30 minutes. Check spam if you do not see it.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lipro-400" />
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" placeholder="you@example.com" required />
              </div>
            </div>
            {error && (
              <p className="flex items-center gap-2 text-sm text-rose-500">
                <AlertCircle className="h-4 w-4" /> {error}
              </p>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Sending…' : 'Send reset link'} <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        )}
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
