import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ProfileEditor } from '@/components/dashboard/profile-editor';
import { ApiKeyEditor } from '@/components/dashboard/api-key-editor';
import { SignOutButton } from '@/components/dashboard/sign-out-button';
import { maskApiKey } from '@/lib/ai';
import { formatDate } from '@/lib/utils';
import AmbientBackground from '@/components/dashboard/ambient-bg';

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const u = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, email: true, fullName: true, matricNumber: true, university: true, faculty: true, department: true, level: true, semester: true, role: true, avatarUrl: true, subscriptionTier: true, walletBalance: true, nvidiaApiKey: true, createdAt: true } });
  if (!u) return <div className="p-8">User not found.</div>;
  return (
    <div className="relative overflow-hidden">
      <AmbientBackground variant="orb3d" />
      <div className="relative space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Settings</h1><p className="text-sm text-lipro-600/70 dark:text-lipro-200/70">Manage your profile and preferences</p></div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardDescription>Account</CardDescription><CardTitle className="text-base">{u.email}</CardTitle></CardHeader><CardContent><div className="text-xs text-lipro-600/70">Role: <Badge tone="purple">{u.role}</Badge></div><div className="mt-2 text-xs text-lipro-600/60">Joined {formatDate(u.createdAt)}</div></CardContent></Card>
        <Card><CardHeader><CardDescription>Plan & balance</CardDescription><CardTitle className="text-base">{u.subscriptionTier}</CardTitle></CardHeader><CardContent><div className="text-xs text-lipro-600/70">Wallet: ₦{u.walletBalance.toLocaleString()}</div><a href="/subscription" className="text-xs text-lipro-600 hover:underline">Change subscription</a></CardContent></Card>
        <Card><CardHeader><CardDescription>Appearance</CardDescription><CardTitle className="text-base">Theme</CardTitle></CardHeader><CardContent><ThemeToggle /></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Profile</CardTitle><CardDescription>Update your personal information</CardDescription></CardHeader><CardContent><ProfileEditor user={u} /></CardContent></Card>
      <Card><CardHeader><CardTitle>AI API Key — NVIDIA NIM</CardTitle><CardDescription>Add your own free NVIDIA NIM key to power LIPRO AI, CBT question generation, and PDF Intelligence — using your own key keeps your usage separate from every other student&apos;s</CardDescription></CardHeader><CardContent><ApiKeyEditor hasKey={!!u.nvidiaApiKey} masked={u.nvidiaApiKey ? maskApiKey(u.nvidiaApiKey) : null} /></CardContent></Card>
      <Card className="border-rose-200/60 dark:border-rose-500/20"><CardHeader><CardTitle>Sign out</CardTitle><CardDescription>End your session and return to the sign-in page</CardDescription></CardHeader><CardContent><SignOutButton /></CardContent></Card>
      </div>
    </div>
  );
}