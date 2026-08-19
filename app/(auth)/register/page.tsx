'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { LiproLogo } from '@/components/LiproLogo';
import FlowingAuroraBg from '@/components/auth/flowing-aurora-bg';

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

  // Forced-dark palette (not tied to the site's light/dark toggle) with a
  // solid, singular violet accent — deliberately not a gradient fill, which
  // reads as the generic "AI purple" cliche. Inputs get real contrast
  // (visible border at rest, brighter + soft ring on focus) rather than the
  // washed-out barely-there fields the previous pass shipped.
  const inputClass = 'border-white/[0.14] bg-white/[0.03] text-white placeholder:text-white/35 focus:border-lipro-400 focus:ring-2 focus:ring-lipro-400/25 focus:bg-lipro-500/[0.06]';
  const labelClass = 'text-[11px] font-bold uppercase tracking-wider text-white/45';
  const linkClass = 'font-semibold text-white hover:text-lipro-300 underline decoration-white/25 underline-offset-2 hover:decoration-lipro-300/60 transition-colors';

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#06070c] p-4">
      <FlowingAuroraBg />

      {/* Double-bezel shell: an outer ring that reads as machined hardware
          around the card, with its own hairline border and inset padding,
          separate from the card's own background/inner highlight. */}
      <div className="relative z-10 w-full max-w-2xl rounded-[2rem] border border-white/[0.07] bg-[#0e0c14] p-1.5 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.7)]">
        <div className="rounded-[1.65rem] border border-white/[0.04] bg-[#141019] p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-10">
          <div className="mb-7 flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-lipro-400 to-lipro-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_8px_18px_-8px_rgba(124,92,255,0.65)]">
              <LiproLogo className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-white">Create your LIPRO account</h1>
              <p className="text-[13px] text-white/50">
                {googlePending ? 'Finish setting up your account' : 'Join thousands of Nigerian university students'}
              </p>
            </div>
          </div>

          {googlePending && (
            <div className="mb-5 rounded-xl border border-lipro-400/20 bg-lipro-500/10 px-3.5 py-2.5 text-xs text-lipro-200">
              Signing up with Google as <span className="font-semibold">{googlePending.email}</span>. We just need a few more details to match you with your university.
            </div>
          )}
          {checkingGoogle && <p className="mb-5 text-xs text-white/50">Checking your Google sign-in…</p>}

          <form onSubmit={submit} className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Full name</label>
              <input value={form.fullName} onChange={set('fullName')} required className={`w-full rounded-xl border px-3.5 py-2.5 text-[14.5px] transition-colors ${inputClass}`} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Email</label>
              <input
                type="email" value={form.email} onChange={set('email')} required disabled={!!googlePending}
                className={`w-full rounded-xl border px-3.5 py-2.5 text-[14.5px] transition-colors ${inputClass} ${googlePending ? 'opacity-60' : ''}`}
              />
            </div>
            {!googlePending && (
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={set('password')}
                    required
                    minLength={8}
                    className={`w-full rounded-xl border px-3.5 py-2.5 pr-10 text-[14.5px] transition-colors ${inputClass}`}
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
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Matric number</label>
              <input value={form.matricNumber} onChange={set('matricNumber')} required className={`w-full rounded-xl border px-3.5 py-2.5 text-[14.5px] transition-colors ${inputClass}`} />
            </div>
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className={labelClass}>University</label>
              <input value={form.university} onChange={set('university')} placeholder="University of Lagos" required className={`w-full rounded-xl border px-3.5 py-2.5 text-[14.5px] transition-colors ${inputClass}`} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Faculty</label>
              <input value={form.faculty} onChange={set('faculty')} placeholder="Science" required className={`w-full rounded-xl border px-3.5 py-2.5 text-[14.5px] transition-colors ${inputClass}`} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Department</label>
              <input value={form.department} onChange={set('department')} placeholder="Computer Science" required className={`w-full rounded-xl border px-3.5 py-2.5 text-[14.5px] transition-colors ${inputClass}`} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Level</label>
              <select value={form.level} onChange={set('level')} className={`w-full appearance-none rounded-xl border bg-[length:16px] bg-[right_0.9rem_center] bg-no-repeat px-3.5 py-2.5 text-[14.5px] transition-colors ${inputClass}`} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%23948da2' stroke-width='2'%3E%3Cpath d='M5 7l5 5 5-5'/%3E%3C/svg%3E\")" }}>
                {['100','200','300','400','500','600','Staff'].map(l => <option key={l} value={l} className="bg-[#141019] text-white">{l}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Semester</label>
              <select value={form.semester} onChange={set('semester')} className={`w-full appearance-none rounded-xl border bg-[length:16px] bg-[right_0.9rem_center] bg-no-repeat px-3.5 py-2.5 text-[14.5px] transition-colors ${inputClass}`} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%23948da2' stroke-width='2'%3E%3Cpath d='M5 7l5 5 5-5'/%3E%3C/svg%3E\")" }}>
                <option value="First" className="bg-[#141019] text-white">First</option>
                <option value="Second" className="bg-[#141019] text-white">Second</option>
              </select>
            </div>

            <label className="flex items-start gap-2.5 text-[13px] text-white/55 md:col-span-2">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-lipro-400"
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
              <button
                type="submit"
                disabled={loading || !agree}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-lipro-500 py-3.5 text-[14.5px] font-bold text-[#06070c] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_14px_30px_-12px_rgba(124,92,255,0.55)] transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Creating account…' : 'Create account'}
                <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-[#06070c]/[0.18] transition-transform duration-150 group-hover:translate-x-0.5">
                  <ArrowRight className="h-3 w-3" />
                </span>
              </button>
            </div>
          </form>

          <p className="mt-7 text-center text-sm text-white/50">
            Already have an account? <Link href="/login" className={linkClass}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
