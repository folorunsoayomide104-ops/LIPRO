'use client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useState } from 'react';

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const logout = async () => {
    setLoading(true);
    await fetch('/api/auth/login', { method: 'DELETE' });
    router.push('/login');
  };

  return (
    <Button type="button" variant="danger" onClick={logout} disabled={loading} className="w-full sm:w-auto">
      <LogOut className="h-4 w-4" /> {loading ? 'Signing out…' : 'Sign out'}
    </Button>
  );
}
