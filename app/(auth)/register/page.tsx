'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { LiproLogo } from '@/components/LiproLogo';
import AmbientBackground from '@/components/dashboard/ambient-bg';

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

  // Palette-only reskin of this one page: forced-dark (not tied to the
  // site's light/dark toggle) so the moving aurora glow behind the card
  // always reads correctly, matching a reference. Local overrides on top
  // of the shared .card/Input/Button components (utility classes beat
  // their `.glass`/@apply rules under Tailwind's layer order) — every
  // other page keeps the app's normal light/dark behavior untouched.
  const inputClass = 'border-white/10 bg-white/[0.04] text-white placeholder:text-white/30 focus:border-lipro-400 focus:ring-lipro-400/20';
  const linkClass = 'font-medium text-lipro-300 hover:text-lipro-200 hover:underline';

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#08070c] p-4">
      <AmbientBackground variant="aurora" />
      {/* A third, cooler-blue blob alongside the shared violet/indigo aurora pair, closer to the reference's blue-to-purple sweep. */}
      <div aria-hidden className="amb-drift-slow pointer-events-none absolute right-[-10%] top-[-10%] h-[70%] w-1/2 rounded-full bg-gradient-to-br from-sky-500/20 via-cyan-400/8 to-transparent blur-3xl" style={{ animationDelay: '-3.5s' }} />

      <div className="card relative z-10 w-full max-w-2xl !border-white/10 !bg-[#101018]/80 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="mb-6 flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 ring-1 ring-white/10">
            <LiproLogo className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Create your LIPRO account</h1>
            <p className="text-xs text-white/50">
              {googlePending ? 'Finish setting up your account' : 'Join thousands of Nigerian university students'}
            </p>
          </div>
        </div>
        {googlePending && (
          <div className="mb-4 rounded-xl border border-lipro-400/20 bg-lipro-500/10 px-3 py-2 text-xs text-lipro-200">
            Signing up with Google as <span className="font-semibold">{googlePending.email}</span>. We just need a few more details to match you with your university.
          </div>
        )}
        {checkingGoogle && <p className="mb-4 text-xs text-white/50">Checking your Google sign-in…</p>}
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div><Label className="text-white/60">Full name</Label><Input value={form.fullName} onChange={set('fullName')} required className={inputClass} /></div>
          <div>
            <Label className="text-white/60">Email</Label>
            <Input type="email" value={form.email} onChange={set('email')} required disabled={!!googlePending} className={`${inputClass} ${googlePending ? 'opacity-60' : ''}`} />
          </div>
          {!googlePending && (
            <div>
              <Label className="text-white/60">Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  required
                  minLength={8}
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 transition-colors hover:text-lipro-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
          <div><Label className="text-white/60">Matric number</Label><Input value={form.matricNumber} onChange={set('matricNumber')} required className={inputClass} /></div>
          <div className="md:col-span-2"><Label className="text-white/60">University</Label><Input value={form.university} onChange={set('university')} placeholder="University of Lagos" required className={inputClass} /></div>
          <div><Label className="text-white/60">Faculty</Label><Input value={form.faculty} onChange={set('faculty')} placeholder="Science" required className={inputClass} /></div>
          <div><Label className="text-white/60">Department</Label><Input value={form.department} onChange={set('department')} placeholder="Computer Science" required className={inputClass} /></div>
          <div>
            <Label className="text-white/60">Level</Label>
            <select className={`input ${inputClass}`} value={form.level} onChange={set('level')}>
              {['100','200','300','400','500','600','Staff'].map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-white/60">Semester</Label>
            <select className={`input ${inputClass}`} value={form.semester} onChange={set('semester')}>
              <option value="First">First</option>
              <option value="Second">Second</option>
            </select>
          </div>
          <label className="flex items-start gap-2 text-sm text-white/60 md:col-span-2">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-lipro-400"
            />
            <span>
              I agree to the{' '}
              <Link href="/privacy" className={linkClass}>Privacy Policy</Link>{' '}
              and{' '}
              <Link href="/terms" className={linkClass}>Terms of Service</Link>.
            </span>
          </label>
          {error && <p className="text-sm text-rose-400 md:col-span-2">{error}</p>}
          <div className="md:col-span-2">
            <Button
              type="submit"
              disabled={loading || !agree}
              className="w-full !bg-gradient-to-r !from-sky-500 !to-lipro-500 shadow-lipro-500/30 disabled:!opacity-50"
            >
              {loading ? 'Creating account…' : 'Create account'} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
        <p className="mt-6 text-center text-sm text-white/50">
          Already have an account? <Link href="/login" className={linkClass}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
