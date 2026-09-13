'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { upload as blobUpload } from '@vercel/blob/client';
import { FileUp, FileText, Loader2 } from 'lucide-react';

export interface CourseMaterial {
  id: string;
  originalName: string;
  sizeBytes: number;
  createdAt: string;
}

function fmtBytes(b: number) {
  return b > 1024 * 1024 ? `${(b / (1024 * 1024)).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;
}

export function CourseMaterialsManager({ courseId, materials, canManage }: { courseId: string; materials: CourseMaterial[]; canManage: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file: File) => {
    setUploading(true); setError('');
    try {
      const blob = await blobUpload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/materials/upload',
        clientPayload: JSON.stringify({ sizeBytes: file.size }),
        multipart: file.size > 50 * 1024 * 1024,
      });
      const res = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blobUrl: blob.url,
          originalName: file.name,
          sizeBytes: file.size,
          mimeType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/plain'),
          courseId,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Upload failed');
      router.refresh();
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {materials.map((m) => (
        <div key={m.id} className="flex items-center gap-3 rounded-lg bg-studio-elevated p-3">
          <FileText className="h-4 w-4 shrink-0 text-studio-primary" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-studio-fg">{m.originalName}</div>
            <div className="text-xs text-studio-subtle">{fmtBytes(m.sizeBytes)} · Added {new Date(m.createdAt).toLocaleDateString()}</div>
          </div>
        </div>
      ))}
      {materials.length === 0 && <p className="text-sm text-studio-subtle">No materials uploaded yet.</p>}

      {canManage && (
        <div className="mt-2">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.docx,text/plain,text/markdown"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-studio-elevated px-3 text-xs font-medium text-studio-muted shadow-studio-border hover:text-studio-fg disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            {uploading ? 'Uploading…' : 'Upload a PDF or file'}
          </button>
          {error && <p className="mt-1 text-sm text-studio-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
