'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { KeyRound, CheckCircle2, Loader2, Trash2, ExternalLink } from 'lucide-react';

export function ApiKeyEditor({
  hasKey,
  masked,
}: {
  hasKey: boolean;
  masked?: string | null;
}) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saved' | 'cleared'>('idle');
  const [error, setError] = useState('');

  const save = async (action: 'save' | 'clear') => {
    setSaving(true); setError(''); setStatus('idle');
    try {
      const body = action === 'clear' ? { action: 'clear' } : { apiKey: value };
      const res = await fetch('/api/settings/api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to save API key');
      setValue('');
      setStatus(action === 'clear' ? 'cleared' : 'saved');
    } catch (e: any) {
      setError(e?.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-lipro-500/20 to-lipro-700/20 text-lipro-600 dark:text-lipro-300">
          <KeyRound className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">NVIDIA NIM API key</span>
            {hasKey ? <Badge tone="green">Configured{masked ? ` · ${masked}` : ''}</Badge> : <Badge tone="amber">Not configured</Badge>}
          </div>
          <p className="mt-1 text-xs text-lipro-600/70 dark:text-lipro-200/70">
            Powers LIPRO AI chat, CBT question generation, and PDF Intelligence. Your key is stored on your account and used for your own requests only — it isn&apos;t shared with other students.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          type="password"
          placeholder={hasKey ? 'Paste a new key to replace the current one' : 'Paste your NVIDIA NIM API key…'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
        />
        <Button onClick={() => save('save')} disabled={saving || value.trim().length === 0} className="sm:shrink-0">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save key
        </Button>
        {hasKey && (
          <Button variant="outline" onClick={() => save('clear')} disabled={saving} className="sm:shrink-0 text-rose-500 hover:text-rose-600">
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
        )}
      </div>

      {status === 'saved' && <p className="text-sm text-green-600 dark:text-green-400">NVIDIA NIM API key saved.</p>}
      {status === 'cleared' && <p className="text-sm text-lipro-600/70">NVIDIA NIM API key removed. Falling back to server key or demo mode.</p>}
      {error && <p className="text-sm text-rose-500">{error}</p>}

      <p className="flex items-center gap-1.5 text-xs text-lipro-600/60 dark:text-lipro-200/50">
        No key yet? Get a free one at
        <a href="https://build.nvidia.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-lipro-600 hover:underline dark:text-lipro-300">
          build.nvidia.com <ExternalLink className="h-3 w-3" />
        </a>
      </p>
    </div>
  );
}
