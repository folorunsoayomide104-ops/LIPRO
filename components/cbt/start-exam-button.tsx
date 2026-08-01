'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Brain } from 'lucide-react';

export function StartExamButton({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const start = async (mode: 'practice' | 'exam') => {
    setLoading(true);
    const res = await fetch('/api/cbt/exam', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId, mode, count: 10 }) });
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok) { alert(data?.error || 'Could not start'); return; }
    sessionStorage.setItem('cbt_session', JSON.stringify(data));
    router.push(`/cbt/${data.sessionId}?mode=${mode}`);
  };

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={() => start('practice')} disabled={loading}><Brain className="h-4 w-4" /> Practice</Button>
      <Button size="sm" variant="outline" onClick={() => start('exam')} disabled={loading}><Brain className="h-4 w-4" /> Exam mode</Button>
    </div>
  );
}
