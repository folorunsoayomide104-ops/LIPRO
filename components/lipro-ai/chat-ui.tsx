'use client';
import { useState, useRef, useEffect } from 'react';
import { upload as blobUpload } from '@vercel/blob/client';
import { Button } from '@/components/ui/button';
import { Send, Bot, User, Loader2, Plus, Maximize2, Minimize2, Paperclip, X, FileText, CheckCircle2, Edit2, Check, RotateCcw, List, ChevronLeft, Square, AlertTriangle } from 'lucide-react';
import { LiproLogo } from '@/components/LiproLogo';
import AmbientBackground from '@/components/dashboard/ambient-bg';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ConversationList, type ConversationListEntry } from './conversation-list-item';

type Msg = { role: 'user' | 'assistant'; content: string; isError?: boolean };
type Conversation = ConversationListEntry;

const SUGGESTIONS = [
  'Explain Big-O notation with an example',
  'Generate 5 MCQs on operating systems',
  'Summarize the concept of recursion',
  'Write a revision checklist for data structures',
];

const GREETING: Msg = { role: 'assistant', content: "Hi! I'm LIPRO AI, your personal tutoring assistant. Ask me anything about your courses, request revision guides, MCQs, summaries, or explanations." };

const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i;

function isImageFile(f: File): boolean {
  return /^image\//.test(f.type) || IMAGE_EXT.test(f.name);
}

async function compressImage(file: File): Promise<File> {
  if (!isImageFile(file) || file.type === 'image/svg+xml') return file;

  const isLarge = file.size > 1.5 * 1024 * 1024;
  if (!isLarge) return file;

  try {
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) return file;

    const maxDim = 1600;
    let { width, height } = bitmap;
    if (Math.max(width, height) > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close(); return file; }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.82)
    );
    if (!blob) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '');
    const outFile = new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
    if (outFile.size >= file.size) return file;
    return outFile;
  } catch {
    return file;
  }
}

function objectUrlFor(file: File): string {
  try {
    return URL.createObjectURL(file);
  } catch {
    return '';
  }
}

export function ChatUI({ initialConversations, initialMessages }: { initialConversations: Conversation[]; initialMessages?: Msg[] }) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(initialConversations[0]?.id ?? null);
  const [messages, setMessages] = useState<Msg[]>(initialMessages ?? [GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(activeId ?? undefined);
  const [fallback, setFallback] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showConvoDrawer, setShowConvoDrawer] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [attached, setAttached] = useState<Array<{ name: string; file: File; preview?: string }>>([]);
  const [attachError, setAttachError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [docs, setDocs] = useState<{ id: string; name: string }[]>([]);
  const [savedNote, setSavedNote] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editInput, setEditInput] = useState('');

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // FileList is a live view of the input's current selection — resetting
    // e.target.value below (done so the same file can be re-picked later)
    // empties this array retroactively even though we already have a
    // reference to it. Snapshot into a plain array first, confirmed via a
    // minimal repro (before=1 after=0 on the exact same pattern), so the
    // reset can't wipe out the files before they're processed.
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    setAttachError('');
    if (files.length === 0) return;

    const newFiles: Array<{ name: string; file: File; preview?: string }> = [];
    const errors: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.size > 100 * 1024 * 1024) {
        errors.push(`${f.name} is too large — max 100MB.`);
        continue;
      }
      const looksPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
      const looksDocx = f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || /\.docx$/i.test(f.name);
      const looksText = f.type.startsWith('text/') || /\.(txt|md|markdown)$/i.test(f.name);
      const looksImage = /^image\//.test(f.type) || /\.(jpg|jpeg|png|gif|webp|bmp|tiff|svg)$/i.test(f.name);
      if (!looksPdf && !looksDocx && !looksText && !looksImage) {
        errors.push(`${f.name} is unsupported. Upload a PDF, Word (.docx), image (JPG, PNG, etc.), TXT or Markdown file.`);
        continue;
      }
      const file = looksImage ? await compressImage(f) : f;
      newFiles.push({ name: file.name, file, preview: looksImage ? objectUrlFor(file) : undefined });
    }
    if (newFiles.length > 0) setAttached((prev) => [...prev, ...newFiles]);
    if (errors.length > 0) setAttachError(errors.join(' · '));
  };

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loadingConversation]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const refreshList = async () => {
    try {
      const res = await fetch('/api/lipro-ai/conversations');
      const data = await res.json();
      if (data.conversations) setConversations(data.conversations);
    } catch { /* noop */ }
  };

  const openConversation = async (id: string) => {
    if (id === activeId) return;
    setActiveId(id);
    setLoadingConversation(true);
    setFallback(false);
    setEditingIndex(null);
    setEditInput('');
    try {
      const res = await fetch(`/api/lipro-ai/conversations/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages(data.messages?.length ? data.messages : [GREETING]);
      setDocs(data.materials ?? []);
      setConversationId(data.id);
    } catch {
      setMessages([{ role: 'assistant', content: 'Could not load this conversation.', isError: true }]);
    } finally {
      setLoadingConversation(false);
    }
  };

  const newChat = () => {
    setActiveId(null);
    setConversationId(undefined);
    setMessages([GREETING]);
    setFallback(false);
    setDocs([]);
    setEditingIndex(null);
    setEditInput('');
  };

  const deleteConversation = async (id: string) => {
    await fetch(`/api/lipro-ai/conversations/${id}`, { method: 'DELETE' });
    setConversations((c) => c.filter((x) => x.id !== id));
    if (id === activeId) newChat();
  };

  const startEdit = (index: number) => {
    if (messages[index].role !== 'user') return;
    setEditingIndex(index);
    setEditInput(messages[index].content);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditInput('');
  };

  const saveEdit = async () => {
    if (editingIndex === null || !editInput.trim() || loading) return;
    const newContent = editInput.trim();
    const idx = editingIndex;
    setMessages((prev) => {
      const next = prev.slice(0, idx + 1);
      next[idx] = { role: 'user', content: newContent };
      next.push({ role: 'assistant', content: '' });
      return next;
    });
    setEditingIndex(null);
    setEditInput('');
    await runRequest(newContent);
  };

  const removeDoc = async (id: string) => {
    const prevDocs = docs;
    setDocs((d) => d.filter((x) => x.id !== id));
    if (!id || !conversationId) return;
    try {
      const res = await fetch(`/api/lipro-ai/conversations/${conversationId}/materials/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch {
      setDocs(prevDocs);
      setAttachError('Could not remove that document. Please try again.');
    }
  };

  // Shared by a fresh send, an edit-and-resubmit, and a regenerate — all three
  // just need to run the request against whatever's already in `messages`
  // (an empty assistant placeholder at the end) and fill it in.
  const runRequest = async (text: string) => {
    const hasFiles = attached.length > 0;
    setLoading(true);
    setFallback(false);
    const fileNames = attached.map((a) => a.name);

    // Docs are only marked "attached" once the server confirms it actually
    // extracted text and saved a Material — never optimistically, so this
    // stays a trustworthy signal instead of a fake checkmark that shows
    // even when the upload or extraction silently failed.
    const confirmAttached = (materialIds: string[], failedFiles?: Array<{ name: string; reason: string }>) => {
      if (materialIds.length > 0) {
        setDocs((d) => [
          ...d.filter((x) => !fileNames.includes(x.name)),
          ...materialIds.map((id, i) => ({ id, name: fileNames[i] || `document ${i + 1}` })),
        ]);
        setSavedNote(true);
        window.setTimeout(() => setSavedNote(false), 5000);
      }
      if (failedFiles && failedFiles.length > 0) {
        setAttachError(failedFiles.map((f) => `${f.name}: ${f.reason}`).join(' · '));
      }
    };

    const appendReply = (content: string, isError = false) => {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === 'assistant' && last.content === '') {
          next[next.length - 1] = { role: 'assistant', content, isError };
        } else {
          next.push({ role: 'assistant', content, isError });
        }
        return next;
      });
    };

    const attachedSnapshot = attached;
    let clearedAttachments = false;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      let body;
      if (attached.length > 0) {
        const blobUrls: Array<{ url: string; name: string }> = [];
        setUploading(true);
        for (let i = 0; i < attached.length; i++) {
          const a = attached[i];
          setUploadProgress(`Uploading ${i + 1} of ${attached.length} — ${a.name}…`);
          const blob = await blobUpload(a.file.name, a.file, {
            access: 'public',
            handleUploadUrl: '/api/materials/upload',
            clientPayload: JSON.stringify({ sizeBytes: a.file.size }),
            multipart: a.file.size > 50 * 1024 * 1024,
          });
          blobUrls.push({ url: blob.url, name: a.file.name });
        }
        setUploadProgress('');
        setUploading(false);
        body = JSON.stringify({
          message: text,
          conversationId,
          stream: true,
          files: blobUrls,
        });
      } else {
        body = JSON.stringify({ message: text, conversationId, stream: true });
      }
      setAttached([]);
      clearedAttachments = true;
      const res = await fetch('/api/lipro-ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Request failed');
      }

      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const data = await res.json();
        appendReply(data.reply || 'Sorry, something went wrong. Try again.', !data.reply);
        if (data.conversationId) {
          setConversationId(data.conversationId);
          setActiveId(data.conversationId);
        }
        confirmAttached(data.materialIds || [], data.failedFiles);
        setFallback(!!data.fallback);
        refreshList();
        return;
      }

      if (!res.body) throw new Error('No stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistant = '';
      let streamConversationId = conversationId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const ev of events) {
          const line = ev.trim();
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          let json: any;
          try { json = JSON.parse(payload); } catch { continue; }
          if (typeof json.text === 'string' && json.text) {
            assistant += json.text;
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = { role: 'assistant', content: assistant };
              return next;
            });
          }
          if (json.conversationId) streamConversationId = json.conversationId;
          if (Array.isArray(json.materialIds)) confirmAttached(json.materialIds, json.failedFiles);
          if (json.fallback === true) setFallback(true);
        }
      }

      if (assistant.trim().length === 0) {
        appendReply('Sorry, something went wrong. Try again.', true);
      }
      if (streamConversationId && streamConversationId !== conversationId) {
        setConversationId(streamConversationId);
        setActiveId(streamConversationId);
      }
      refreshList();
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // Stopped by the user — leave whatever partial text already streamed in place.
        return;
      }
      setUploading(false);
      setUploadProgress('');
      if (hasFiles) {
        setAttachError(err?.message || 'Could not upload your file(s). Please try again.');
        if (clearedAttachments) setAttached(attachedSnapshot);
      }
      appendReply('Sorry, something went wrong. Try again.', true);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const send = async (rawText: string) => {
    const hasFiles = attached.length > 0;
    if ((!rawText.trim() && !hasFiles) || loading || loadingConversation) return;
    const text = rawText.trim() || `Please review ${attached.length === 1 ? 'this document' : 'these documents'} and summarize the key points.`;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setMessages((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: '' }]);
    await runRequest(text);
  };

  const regenerate = async () => {
    if (loading || loadingConversation) return;
    let idx: number | undefined;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { idx = i; break; }
    }
    if (idx === undefined) return;
    const text = messages[idx].content;
    setMessages((prev) => [...prev.slice(0, idx + 1), { role: 'assistant', content: '' }]);
    await runRequest(text);
  };

  return (
    <div className={cn('relative flex gap-4 overflow-hidden', fullscreen ? 'fixed inset-0 z-[100] h-screen bg-[rgb(var(--bg))] p-4 sm:p-6' : 'h-[calc(100dvh-13.5rem)] md:h-[calc(100vh-9rem)]')}>
      <AmbientBackground variant="aurora" />
      {!fullscreen && (
        <aside className="glass relative hidden w-64 shrink-0 flex-col rounded-2xl p-3 md:flex">
          <Button onClick={newChat} className="mb-3 w-full" size="sm"><Plus className="h-4 w-4" /> New chat</Button>
          <div className="flex-1 space-y-1 overflow-y-auto">
            <ConversationList conversations={conversations} activeId={activeId} onOpen={openConversation} onDelete={deleteConversation} />
          </div>
        </aside>
      )}

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><LiproLogo className="h-6 w-6" /> LIPRO AI</h1>
            <p className="text-sm text-lipro-600/70 dark:text-lipro-200/70">Your AI tutor with conversation memory</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {fallback && <Badge tone="amber">Demo mode — add API key in Settings</Badge>}
            <Button variant="outline" size="sm" className="md:hidden" onClick={() => setShowConvoDrawer(true)}><List className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" className="md:hidden" onClick={newChat}><Plus className="h-4 w-4" /> New</Button>
            <Button variant="outline" size="sm" onClick={() => setFullscreen((f) => !f)} title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'} aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Mobile conversation drawer */}
        {showConvoDrawer && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowConvoDrawer(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-full max-w-sm bg-white dark:bg-gray-900 shadow-xl flex flex-col">
              <div className="flex items-center justify-between gap-2 border-b border-lipro-200/60 p-3">
                <button onClick={() => setShowConvoDrawer(false)} className="tap grid h-10 w-10 place-items-center rounded-xl text-lipro-600 hover:bg-lipro-100 dark:hover:bg-lipro-900/50">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-lg font-semibold flex-1 text-center">Conversations</h2>
                <Button onClick={newChat} size="sm" className="shrink-0"><Plus className="h-4 w-4" /> New</Button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                <ConversationList
                  conversations={conversations}
                  activeId={activeId}
                  onOpen={(id) => { openConversation(id); setShowConvoDrawer(false); }}
                  onDelete={deleteConversation}
                />
              </div>
            </div>
          </div>
        )}

        <div className="glass flex-1 overflow-y-auto rounded-2xl p-4 space-y-4">
          {loadingConversation && (
            <div className="flex gap-3"><div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-lipro-500 to-lipro-700 text-white"><Bot className="h-4 w-4" /></div><div className="glass rounded-2xl p-3"><Loader2 className="h-4 w-4 animate-spin" /></div></div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
              {m.role === 'assistant' && <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-lipro-500 to-lipro-700 text-white"><Bot className="h-4 w-4" /></div>}
              {editingIndex === i && m.role === 'user' ? (
                <div className="max-w-[80%] w-full flex gap-2">
                  <textarea
                    ref={textareaRef}
                    value={editInput}
                    onChange={(e) => { setEditInput(e.target.value); autoResize(); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); } }}
                    rows={1}
                    className="max-h-[200px] min-h-11 flex-1 resize-none rounded-xl border border-lipro-300/50 bg-white/70 px-4 py-2.5 text-base outline-none placeholder:text-lipro-300/70 focus:border-lipro-400 focus:ring-4 focus:ring-lipro-400/15 dark:border-lipro-700/40 dark:bg-surface-dark/60"
                    placeholder="Edit your message…"
                    autoFocus
                  />
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="primary" onClick={saveEdit} disabled={!editInput.trim()}><Check className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit}><X className="h-4 w-4" /></Button>
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    'max-w-[80%] whitespace-pre-wrap rounded-2xl p-3 text-sm',
                    m.role === 'user'
                      ? 'bg-gradient-to-r from-lipro-600 to-lipro-500 text-white'
                      : m.isError
                        ? 'glass border border-rose-300/50 bg-rose-50/40 text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-200'
                        : 'glass'
                  )}
                >
                  {m.role === 'assistant' && m.isError && (
                    <span className="mb-1 flex items-center gap-1 text-xs font-medium opacity-80"><AlertTriangle className="h-3.5 w-3.5" /> Something went wrong</span>
                  )}
                  {m.content || (
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-lipro-500" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-lipro-500" style={{ animationDelay: '0.15s' }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-lipro-500" style={{ animationDelay: '0.3s' }} />
                    </span>
                  )}
                </div>
              )}
              {m.role === 'user' && editingIndex !== i && (
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-lipro-200 text-lipro-700 relative">
                  <User className="h-4 w-4" />
                  <button
                    onClick={() => startEdit(i)}
                    className="absolute -top-1 -right-1 rounded-full p-0.5 text-lipro-400 opacity-0 transition-opacity hover:text-lipro-600 group-hover:opacity-100"
                    title="Edit message"
                    aria-label="Edit message"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {m.role === 'assistant' && editingIndex !== i && (
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-lipro-200 text-lipro-700 relative">
                  <Bot className="h-4 w-4" />
                  <button
                    onClick={regenerate}
                    disabled={loading || loadingConversation}
                    className="absolute -top-1 -right-1 rounded-full p-0.5 text-lipro-400 opacity-0 transition-opacity hover:text-lipro-600 group-hover:opacity-100 disabled:pointer-events-none"
                    title="Regenerate response"
                    aria-label="Regenerate response"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {messages.length === 1 && !activeId && (
          <div className="my-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => <Button key={s} variant="outline" size="sm" onClick={() => send(s)}>{s}</Button>)}
          </div>
        )}
        {docs.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-lipro-500">Attached documents</span>
            {docs.map((d) => (
              <span key={d.id || d.name} className="group inline-flex max-w-[220px] items-center gap-1.5 rounded-full border border-lipro-300/50 bg-white/60 py-1 pl-2.5 pr-1 text-xs font-medium text-lipro-700 dark:border-lipro-700/40 dark:bg-surface-dark/60 dark:text-lipro-200">
                <FileText className="h-3 w-3 shrink-0 text-lipro-500" />
                <span className="truncate">{d.name}</span>
                <button
                  type="button"
                  onClick={() => removeDoc(d.id)}
                  className="shrink-0 rounded-full p-1 text-lipro-500 transition-colors hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/40"
                  title="Delete attached file"
                  aria-label={`Delete attached file ${d.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        {savedNote && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Document saved — ask LIPRO AI about it and it will teach from it.
          </p>
        )}
        {attached.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {attached.map((a, i) => (
              <div key={i} className="relative flex items-center gap-2 rounded-xl border border-lipro-300/50 bg-white/60 px-2.5 py-2 text-sm dark:border-lipro-700/40 dark:bg-surface-dark/60">
                {a.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.preview} alt={a.name} className="h-10 w-10 shrink-0 rounded-md object-cover" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-lipro-500" />
                )}
                <span className="max-w-[160px] min-w-0 flex-1 truncate font-medium">{a.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setAttached((prev) => prev.filter((_, idx) => idx !== i));
                  }}
                  className="shrink-0 rounded-full p-1 text-lipro-500 transition-colors hover:bg-lipro-100 hover:text-lipro-700 dark:hover:bg-lipro-950/40"
                  title="Remove file"
                  aria-label={`Remove attached file ${a.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {uploading && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-lipro-600 dark:text-lipro-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {uploadProgress || 'Uploading…'}
          </p>
        )}
        {attachError && <p className="mt-2 text-xs font-medium text-rose-500">{attachError}</p>}
        <form className="mt-3 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={onPickFile}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-lipro-200/60 bg-white/50 text-lipro-500 transition-colors hover:border-lipro-400 hover:text-lipro-600 dark:border-lipro-700/40 dark:bg-surface-dark/60 dark:text-lipro-300"
            title="Attach a PDF, Word, image, or text file"
            aria-label="Attach a file"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); autoResize(); }}
            onKeyDown={handleComposerKeyDown}
            placeholder="Ask LIPRO AI anything…"
            rows={1}
            autoCapitalize="sentences"
            autoCorrect="on"
            spellCheck={true}
            enterKeyHint="send"
            className="max-h-[200px] min-h-11 flex-1 resize-none rounded-xl border border-lipro-200/60 bg-white/70 px-4 py-2.5 text-base leading-6 outline-none transition-all placeholder:text-lipro-300/70 focus:border-lipro-400 focus:ring-4 focus:ring-lipro-400/15 dark:border-lipro-700/40 dark:bg-surface-dark/60 dark:placeholder:text-lipro-300/40"
          />
          {loading ? (
            <Button type="button" variant="outline" onClick={() => abortRef.current?.abort()} title="Stop generating" aria-label="Stop generating">
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" disabled={loadingConversation}><Send className="h-4 w-4" /></Button>
          )}
        </form>
        <div className="h-2" style={{ height: 'max(env(safe-area-inset-bottom), 0.5rem)' }} />
      </div>
    </div>
  );
}
