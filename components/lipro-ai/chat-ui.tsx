'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { upload as blobUpload } from '@vercel/blob/client';
import { Send, Bot, User, Loader2, Plus, Maximize2, Minimize2, X, FileText, CheckCircle2, Edit2, Check, RotateCcw, List, ChevronLeft, Square, AlertTriangle, ArrowLeft } from 'lucide-react';
import { LiproLogo } from '@/components/LiproLogo';
import { cn } from '@/lib/utils';
import { ConversationList, type ConversationListEntry } from './conversation-list-item';
import { MarkdownMessage } from './markdown-message';

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
      const val = textareaRef.current?.value ?? '';
      send(val);
    }
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) setFullscreen(true);
  }, []);

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

  const runRequest = async (text: string) => {
    const hasFiles = attached.length > 0;
    setLoading(true);
    setFallback(false);
    const fileNames = attached.map((a) => a.name);

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
    if (textareaRef.current) {
      textareaRef.current.value = '';
      textareaRef.current.style.height = 'auto';
    }
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
    <div className={cn('relative flex bg-studio-bg text-studio-fg', fullscreen ? 'fixed inset-0 z-[100] h-dvh' : '-mx-4 -mt-2 h-[calc(100dvh-4rem)] md:h-[calc(100dvh-4rem)]')}>
      {!fullscreen && (
        <aside className="hidden w-72 shrink-0 flex-col border-r border-studio-border bg-studio-surface md:flex">
          <div className="p-3">
            <button
              onClick={newChat}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-studio-elevated text-sm font-medium text-studio-muted shadow-studio-border hover:text-studio-fg"
            >
              <Plus className="h-4 w-4" /> New thread
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <p className="px-4 pb-1 pt-1 text-xs font-medium uppercase tracking-[0.16em] text-studio-subtle">Threads</p>
            <div className="flex flex-col gap-1 p-2">
              <ConversationList conversations={conversations} activeId={activeId} onOpen={openConversation} onDelete={deleteConversation} />
            </div>
          </div>
        </aside>
      )}

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-studio-border px-3 md:h-16 md:px-6">
          <Link
            href="/dashboard"
            onClick={() => { if (fullscreen) setFullscreen(false); }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-studio-elevated px-2.5 py-2 text-sm font-medium text-studio-muted shadow-studio-border hover:text-studio-fg"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="max-md:hidden">Back</span>
          </Link>
          <div className="ml-2 flex min-w-0 items-center gap-2">
            <LiproLogo className="h-5 w-5 shrink-0 text-studio-primary" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-studio-fg">LIPRO AI</p>
              <p className="text-xs text-studio-subtle max-md:hidden">Your AI tutor with conversation memory</p>
            </div>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {fallback && (
              <span className="hidden rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-400 md:inline-flex">
                Demo mode — add API key in Settings
              </span>
            )}
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full text-studio-muted shadow-studio-border hover:text-studio-fg md:hidden"
              onClick={() => setShowConvoDrawer(true)}
              aria-label="Open threads"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full text-studio-muted shadow-studio-border hover:text-studio-fg md:hidden"
              onClick={newChat}
              aria-label="New thread"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full text-studio-muted shadow-studio-border hover:text-studio-fg"
              onClick={() => setFullscreen((f) => !f)}
              aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-6">
            {loadingConversation ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-studio-primary" />
              </div>
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-4">
                {messages.map((m, i) => (
                  <div key={i} className={cn('group flex gap-3', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                    {m.role === 'assistant' && (
                      <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-studio-primary/15 text-studio-primary">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div className={cn('relative max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed', m.role === 'user' ? 'bg-studio-primary text-studio-primary-fg' : m.isError ? 'bg-studio-danger/10 text-studio-danger' : 'bg-studio-elevated text-studio-fg')}>
                      {m.role === 'assistant' ? (
                        m.content ? <MarkdownMessage content={m.content} /> : (
                          loading && i === messages.length - 1 ? (
                            <span className="inline-flex items-center gap-1.5 text-studio-subtle">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                            </span>
                          ) : null
                        )
                      ) : editingIndex === i ? (
                        <div className="flex flex-col gap-2">
                          <textarea
                            value={editInput}
                            onChange={(e) => setEditInput(e.target.value)}
                            className="min-h-[60px] w-full resize-y rounded-lg bg-black/20 p-2 text-sm outline-none"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button type="button" onClick={saveEdit} className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-medium">
                              <Check className="h-3 w-3" /> Save
                            </button>
                            <button type="button" onClick={cancelEdit} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="whitespace-pre-wrap">{m.content}</p>
                          {!loading && (
                            <button
                              type="button"
                              onClick={() => startEdit(i)}
                              className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100"
                              aria-label="Edit message"
                            >
                              <Edit2 className="h-3.5 w-3.5 text-studio-subtle" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    {m.role === 'user' && (
                      <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-studio-elevated text-studio-muted">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}
                {messages.length > 1 && !loading && messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.content && (
                  <div className="flex justify-start pl-11">
                    <button
                      type="button"
                      onClick={regenerate}
                      className="inline-flex items-center gap-1.5 rounded-full bg-studio-elevated px-3 py-1.5 text-xs font-medium text-studio-muted hover:text-studio-fg"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Regenerate
                    </button>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-studio-border bg-studio-bg px-3 py-3 md:px-6">
            {docs.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {docs.map((d) => (
                  <span key={d.id} className="inline-flex items-center gap-1.5 rounded-full bg-studio-elevated px-2.5 py-1 text-xs text-studio-muted">
                    <FileText className="h-3 w-3" />
                    <span className="max-w-[120px] truncate">{d.name}</span>
                    <button type="button" onClick={() => removeDoc(d.id)} className="ml-0.5 text-studio-subtle hover:text-studio-danger" aria-label="Remove">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {attached.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attached.map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-studio-primary/15 px-2.5 py-1 text-xs text-studio-primary">
                    {a.preview ? <img src={a.preview} alt="" className="h-4 w-4 rounded object-cover" /> : <FileText className="h-3 w-3" />}
                    <span className="max-w-[120px] truncate">{a.name}</span>
                    <button type="button" onClick={() => setAttached((prev) => prev.filter((_, j) => j !== i))} className="ml-0.5 hover:text-studio-danger" aria-label="Remove">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {savedNote && (
              <p className="mb-2 flex items-center gap-1.5 text-xs text-green-500">
                <CheckCircle2 className="h-3.5 w-3.5" /> Documents saved to this thread
              </p>
            )}
            {uploading && (
              <p className="mb-2 flex items-center gap-1.5 text-xs text-studio-subtle">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {uploadProgress || 'Uploading…'}
              </p>
            )}
            {attachError && <p className="mb-2 text-xs font-medium text-studio-danger">{attachError}</p>}

            <form
              className="flex items-end gap-2 rounded-xl bg-studio-surface p-2 shadow-studio-border"
              onSubmit={(e) => { e.preventDefault(); send(textareaRef.current?.value ?? ''); }}
            >
              <input ref={fileInputRef} type="file" className="hidden" onChange={onPickFile} multiple accept=".pdf,.docx,.txt,.md,.markdown,image/*" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="grid h-9 w-9 shrink-0 place-items-center self-end rounded-full text-studio-subtle transition-colors hover:bg-studio-elevated hover:text-studio-fg"
                title="Attach a PDF, Word, image, or text file"
                aria-label="Attach a file"
              >
                <Plus className="h-5 w-5" />
              </button>
              <textarea
                ref={textareaRef}
                defaultValue=""
                onInput={autoResize}
                onKeyDown={handleComposerKeyDown}
                placeholder="Ask LIPRO AI anything…"
                rows={1}
                autoCapitalize="sentences"
                autoCorrect="on"
                spellCheck={true}
                enterKeyHint="send"
                className="max-h-[200px] min-h-9 flex-1 resize-none self-center bg-transparent px-1.5 py-1.5 text-base leading-6 text-studio-fg outline-none placeholder:text-studio-subtle"
              />
              {loading ? (
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  className="grid h-9 w-9 shrink-0 place-items-center self-end rounded-full bg-studio-elevated text-studio-muted shadow-studio-border hover:text-studio-fg"
                  title="Stop generating"
                  aria-label="Stop generating"
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loadingConversation}
                  className="grid h-9 w-9 shrink-0 place-items-center self-end rounded-full bg-studio-primary text-studio-primary-fg transition-transform active:scale-95 disabled:opacity-50"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </form>
            <p className="mt-2 text-center text-xs text-studio-subtle">Enter to send · Shift+Enter for a new line</p>
          </div>
        </div>
      </div>

      {showConvoDrawer && (
        <div className="fixed inset-0 z-[110] flex md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowConvoDrawer(false)} />
          <div className="relative z-10 flex h-full w-72 flex-col bg-studio-surface">
            <div className="flex h-14 items-center gap-2 border-b border-studio-border px-3">
              <button type="button" onClick={() => setShowConvoDrawer(false)} className="grid h-9 w-9 place-items-center rounded-full text-studio-muted" aria-label="Close">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <p className="text-sm font-medium">Threads</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              <ConversationList conversations={conversations} activeId={activeId} onOpen={(id) => { openConversation(id); setShowConvoDrawer(false); }} onDelete={deleteConversation} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
