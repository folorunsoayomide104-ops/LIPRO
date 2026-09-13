'use client';
import { useState } from 'react';
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-studio-elevated text-studio-primary shadow-studio-border">
          <KeyRound className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-studio-fg">NVIDIA NIM API key</span>
            {hasKey ? (
              <span className="rounded-full bg-studio-primary/15 px-2.5 py-0.5 text-xs font-medium text-studio-primary">Configured{masked ? ` · ${masked}` : ''}</span>
            ) : (
              <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-400">Not configured</span>
            )}
          </div>
          <p className="mt-1 text-xs text-studio-subtle">
            Powers LIPRO AI chat, CBT question generation, and PDF Intelligence. Your key is stored on your account and used for your own requests only — it isn&apos;t shared with other students.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="password"
          placeholder={hasKey ? 'Paste a new key to replace the current one' : 'Paste your NVIDIA NIM API key…'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          className="h-11 flex-1 rounded-lg bg-studio-elevated px-3 text-sm text-studio-fg shadow-studio-border outline-none placeholder:text-studio-subtle"
        />
        <button
          type="button"
          onClick={() => save('save')}
          disabled={saving || value.trim().length === 0}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-studio-primary px-4 text-sm font-medium text-studio-primary-fg disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save key
        </button>
        {hasKey && (
          <button
            type="button"
            onClick={() => save('clear')}
            disabled={saving}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-studio-elevated px-4 text-sm font-medium text-studio-danger shadow-studio-border disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" /> Remove
          </button>
        )}
      </div>

      {status === 'saved' && <p className="text-sm text-studio-primary">NVIDIA NIM API key saved.</p>}
      {status === 'cleared' && <p className="text-sm text-studio-muted">NVIDIA NIM API key removed. Falling back to server key or demo mode.</p>}
      {error && <p className="text-sm text-studio-danger">{error}</p>}

      <p className="flex items-center gap-1.5 text-xs text-studio-subtle">
        No key yet? Get a free one at
        <a href="https://build.nvidia.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-studio-primary hover:underline">
          build.nvidia.com <ExternalLink className="h-3 w-3" />
        </a>
      </p>
    </div>
  );
}
