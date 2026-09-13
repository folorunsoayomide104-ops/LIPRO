'use client';
import { useRef, useState } from 'react';
import { Camera, Loader2, ImageOff } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const inputCls = 'h-11 w-full rounded-lg bg-studio-elevated px-3 text-sm text-studio-fg shadow-studio-border outline-none placeholder:text-studio-subtle';
const labelCls = 'text-xs font-medium uppercase tracking-[0.14em] text-studio-subtle';

export function ProfileEditor({ user }: { user: any }) {
  const [form, setForm] = useState({ fullName: user.fullName, matricNumber: user.matricNumber, university: user.university, faculty: user.faculty, department: user.department, level: user.level, semester: user.semester });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl || null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/users/avatar', { method: 'POST', body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Upload failed');
      setAvatarUrl(data.avatarUrl);
      window.dispatchEvent(new CustomEvent('avatar-updated', { detail: data.avatarUrl }));
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/users/${user.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setLoading(false);
    if (res.ok) {
      toast.success('Profile updated');
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.error || 'Could not save your changes');
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-studio-primary text-2xl font-bold text-studio-primary-fg">
            {avatarUrl ? <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" /> : (form.fullName || 'U').charAt(0).toUpperCase()}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-studio-surface bg-studio-elevated text-studio-fg shadow-studio-border transition-transform hover:scale-110 disabled:opacity-50"
            aria-label="Change profile picture"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          </button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={uploadAvatar} />
        </div>
        <div>
          <div className="text-sm font-medium text-studio-fg">Profile picture</div>
          <p className="text-xs text-studio-subtle">PNG, JPG, WEBP or GIF · max 5MB</p>
          {avatarUrl && (
            <button type="button" onClick={() => fileRef.current?.click()} className="mt-1 flex items-center gap-1 text-xs font-medium text-studio-primary hover:underline">
              <ImageOff className="h-3 w-3" /> Change picture
            </button>
          )}
        </div>
      </div>

      <form onSubmit={save} className="grid gap-3 md:grid-cols-2">
        <div><label className={labelCls}>Full name</label><input className={cn(inputCls, 'mt-1')} value={form.fullName} onChange={set('fullName')} /></div>
        <div><label className={labelCls}>Matric number</label><input className={cn(inputCls, 'mt-1')} value={form.matricNumber} onChange={set('matricNumber')} /></div>
        <div><label className={labelCls}>University</label><input className={cn(inputCls, 'mt-1')} value={form.university} onChange={set('university')} /></div>
        <div><label className={labelCls}>Faculty</label><input className={cn(inputCls, 'mt-1')} value={form.faculty} onChange={set('faculty')} /></div>
        <div><label className={labelCls}>Department</label><input className={cn(inputCls, 'mt-1')} value={form.department} onChange={set('department')} /></div>
        <div><label className={labelCls}>Level</label><select className={cn(inputCls, 'mt-1')} value={form.level} onChange={set('level')}>{['100','200','300','400','500','600','Staff'].map(l => <option key={l}>{l}</option>)}</select></div>
        <div><label className={labelCls}>Semester</label><select className={cn(inputCls, 'mt-1')} value={form.semester} onChange={set('semester')}><option>First</option><option>Second</option></select></div>
        <div className="md:col-span-2">
          <button type="submit" disabled={loading} className="inline-flex h-10 items-center rounded-full bg-studio-primary px-5 text-sm font-medium text-studio-primary-fg disabled:opacity-60">
            {loading ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
