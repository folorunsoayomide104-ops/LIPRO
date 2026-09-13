import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ProfileEditor } from '@/components/dashboard/profile-editor';
import { ApiKeyEditor } from '@/components/dashboard/api-key-editor';
import { SignOutButton } from '@/components/dashboard/sign-out-button';
import { maskApiKey } from '@/lib/ai';
import { formatDate } from '@/lib/utils';

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const u = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, email: true, fullName: true, matricNumber: true, university: true, faculty: true, department: true, level: true, semester: true, role: true, avatarUrl: true, subscriptionTier: true, walletBalance: true, nvidiaApiKey: true, createdAt: true } });
  if (!u) return <div className="p-8">User not found.</div>;
  return (
    <div className="-mx-4 -mt-2 min-h-[calc(100dvh-4rem)] bg-studio-bg p-4 text-studio-fg md:p-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="studio-rise">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-studio-subtle">Preferences</p>
          <h1 className="mt-2 font-studio-display text-3xl tracking-tight md:text-4xl">Settings.</h1>
          <p className="mt-2 max-w-lg text-sm leading-normal text-studio-muted">Manage your profile and preferences.</p>
        </header>

        <div className="grid gap-4 md:grid-cols-3 studio-rise studio-rise-delay-1">
          <div className="rounded-xl bg-studio-surface p-5 shadow-studio-border">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-studio-subtle">Account</p>
            <p className="mt-2 truncate text-sm font-medium text-studio-fg">{u.email}</p>
            <p className="mt-2 text-xs text-studio-subtle">Role: <span className="rounded-full bg-studio-elevated px-2 py-0.5 text-studio-muted">{u.role}</span></p>
            <p className="mt-1 text-xs text-studio-subtle">Joined {formatDate(u.createdAt)}</p>
          </div>
          <div className="rounded-xl bg-studio-surface p-5 shadow-studio-border">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-studio-subtle">Plan &amp; balance</p>
            <p className="mt-2 text-sm font-medium text-studio-fg">{u.subscriptionTier}</p>
            <p className="mt-2 text-xs text-studio-subtle">Wallet: ₦{u.walletBalance.toLocaleString()}</p>
            <a href="/subscription" className="mt-1 inline-block text-xs text-studio-primary hover:underline">Change subscription</a>
          </div>
          <div className="rounded-xl bg-studio-surface p-5 shadow-studio-border">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-studio-subtle">Appearance</p>
            <p className="mt-2 text-sm font-medium text-studio-fg">Theme</p>
            <div className="mt-3"><ThemeToggle /></div>
          </div>
        </div>

        <section className="rounded-xl bg-studio-surface p-5 shadow-studio-border studio-rise studio-rise-delay-2">
          <h2 className="font-studio-display text-xl tracking-tight text-studio-fg">Profile</h2>
          <p className="mt-1 text-sm text-studio-muted">Update your personal information.</p>
          <div className="mt-5"><ProfileEditor user={u} /></div>
        </section>

        <section className="rounded-xl bg-studio-surface p-5 shadow-studio-border studio-rise studio-rise-delay-2">
          <h2 className="font-studio-display text-xl tracking-tight text-studio-fg">AI API Key — NVIDIA NIM</h2>
          <p className="mt-1 text-sm text-studio-muted">Add your own free NVIDIA NIM key to power LIPRO AI, CBT question generation, and PDF Intelligence — using your own key keeps your usage separate from every other student&apos;s.</p>
          <div className="mt-5"><ApiKeyEditor hasKey={!!u.nvidiaApiKey} masked={u.nvidiaApiKey ? maskApiKey(u.nvidiaApiKey) : null} /></div>
        </section>

        <section className="rounded-xl bg-studio-surface p-5 shadow-studio-border studio-rise studio-rise-delay-3">
          <h2 className="font-studio-display text-xl tracking-tight text-studio-danger">Sign out</h2>
          <p className="mt-1 text-sm text-studio-muted">End your session and return to the sign-in page.</p>
          <div className="mt-5"><SignOutButton /></div>
        </section>
      </div>
    </div>
  );
}
