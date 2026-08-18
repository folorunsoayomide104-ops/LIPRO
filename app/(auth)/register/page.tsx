'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { LiproLogo } from '@/components/LiproLogo';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(false);
  const [form, setForm] = useState({
    email: '', password: '', fullName: '', matricNumber: '',
    university: '', faculty: '', department: '',
    level: '100', semester: 'First',
  });
  // When set, this signup is completing a Google sign-in: email is locked
  // (it's the Google-verified address, not client input) and no password
  // field is shown — /api/auth/google/complete reads the identity from a
  // signed server-side cookie, not from this form.
  const [googlePending, setGooglePending] = useState<{ email: string } | null>(null);
  const [checkingGoogle, setCheckingGoogle] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('google') !== '1') return;
    setCheckingGoogle(true);
    fetch('/api/auth/google/pending')
      .then((r) => r.json())
      .then((data) => {
        if (data?.pending) {
          setGooglePending({ email: data.pending.email });
          setForm((f) => ({ ...f, email: data.pending.email, fullName: data.pending.fullName || f.fullName }));
        } else {
          setError('Your Google sign-in expired. Please start again from the login page.');
        }
      })
      .finally(() => setCheckingGoogle(false));
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) { setError('Please accept the Privacy Policy and Terms to continue.'); return; }
    setLoading(true); setError('');
    const res = googlePending
      ? await fetch('/api/auth/google/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: form.fullName, matricNumber: form.matricNumber, university: form.university,
            faculty: form.faculty, department: form.department, level: form.level, semester: form.semester,
          }),
        })
      : await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
    const data = await res.json().catch(() => null);
    if (!res.ok) { setError(data?.error || 'Registration failed'); setLoading(false); return; }
    router.push('/dashboard');
  };

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="card w-full max-w-2xl">
        <div className="mb-6 flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#0a0a0c] ring-1 ring-white/10">
            <LiproLogo className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Create your LIPRO account</h1>
            <p className="text-xs text-lipro-600/70 dark:text-lipro-200/60">
              {googlePending ? 'Finish setting up your account' : 'Join thousands of Nigerian university students'}
            </p>
          </div>
        </div>
        {googlePending && (
          <div className="mb-4 rounded-xl border border-lipro-200/60 bg-lipro-50/60 px-3 py-2 text-xs text-lipro-700 dark:border-lipro-700/30 dark:bg-lipro-950/30 dark:text-lipro-200">
            Signing up with Google as <span className="font-semibold">{googlePending.email}</span>. We just need a few more details to match you with your university.
          </div>
        )}
        {checkingGoogle && <p className="mb-4 text-xs text-lipro-600/60">Checking your Google sign-in…</p>}
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div><Label>Full name</Label><Input value={form.fullName} onChange={set('fullName')} required /></div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={set('email')} required disabled={!!googlePending} className={googlePending ? 'opacity-60' : undefined} />
          </div>
          {!googlePending && (
            <div>
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  required
                  minLength={8}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-lipro-600/60 transition-colors hover:text-lipro-600 dark:text-lipro-300/60 dark:hover:text-lipro-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
          <div><Label>Matric number</Label><Input value={form.matricNumber} onChange={set('matricNumber')} required /></div>
          <div className="md:col-span-2"><Label>University</Label><Input value={form.university} onChange={set('university')} placeholder="University of Lagos" required /></div>
          <div><Label>Faculty</Label><Input value={form.faculty} onChange={set('faculty')} placeholder="Science" required /></div>
          <div><Label>Department</Label><Input value={form.department} onChange={set('department')} placeholder="Computer Science" required /></div>
          <div>
            <Label>Level</Label>
            <select className="input" value={form.level} onChange={set('level')}>
              {['100','200','300','400','500','600','Staff'].map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <Label>Semester</Label>
            <select className="input" value={form.semester} onChange={set('semester')}>
              <option value="First">First</option>
              <option value="Second">Second</option>
            </select>
          </div>
          <label className="flex items-start gap-2 text-sm text-lipro-600/80 dark:text-lipro-200/70 md:col-span-2">
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
          {error && <p className="text-sm text-rose-500 md:col-span-2">{error}</p>}
          <div className="md:col-span-2">
            <Button type="submit" disabled={loading || !agree} className="w-full">
              {loading ? 'Creating account…' : 'Create account'} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
        <p className="mt-6 text-center text-sm text-lipro-600/70 dark:text-lipro-200/60">
          Already have an account? <Link href="/login" className="font-medium text-lipro-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
