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
              className="hidden h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-studio-muted shadow-studio-border hover:text-studio-fg md:inline-flex"
              onClick={() => setFullscreen((f) => !f)}
              title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
              aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {showConvoDrawer && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-studio-bg/70" onClick={() => setShowConvoDrawer(false)} />
            <div className="absolute inset-y-0 left-0 flex w-full max-w-sm flex-col bg-studio-surface shadow-studio-float">
              <div className="flex items-center justify-between gap-2 border-b border-studio-border p-3">
                <button onClick={() => setShowConvoDrawer(false)} className="grid h-10 w-10 place-items-center rounded-full text-studio-muted hover:text-studio-fg">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="flex-1 text-center text-sm font-medium text-studio-fg">Threads</h2>
                <button onClick={newChat} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-studio-primary px-3 text-xs font-medium text-studio-primary-fg">
                  <Plus className="h-4 w-4" /> New
                </button>
              </div>
              <div className="flex-1 space-y-1 overflow-y-auto p-2">
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

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:px-8">
            {loadingConversation && (
              <div className="flex items-center gap-2 text-sm text-studio-subtle">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            )}
            {messages.map((m, i) => (
              <article key={i} className={cn('group flex w-full gap-3', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                {m.role === 'assistant' && (
                  <div className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-studio-elevated text-studio-primary">
                    <Bot className="h-4 w-4" />
                    {editingIndex !== i && (
                      <button
                        onClick={regenerate}
                        disabled={loading || loadingConversation}
                        className="absolute -right-1 -top-1 rounded-full bg-studio-surface p-0.5 text-studio-subtle opacity-0 shadow-studio-border transition-opacity hover:text-studio-fg group-hover:opacity-100 disabled:pointer-events-none"
                        title="Regenerate response"
                        aria-label="Regenerate response"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
                <div className={cn('max-w-[min(40rem,100%)]', m.role === 'user' ? '' : 'w-full min-w-0')}>
                  {editingIndex === i && m.role === 'user' ? (
                    <div className="flex w-full gap-2">
                      <textarea
                        ref={textareaRef}
                        value={editInput}
                        onChange={(e) => { setEditInput(e.target.value); autoResize(); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); } }}
                        rows={1}
                        className="max-h-[200px] min-h-11 flex-1 resize-none rounded-lg bg-studio-elevated px-4 py-2.5 text-sm text-studio-fg shadow-studio-border outline-none placeholder:text-studio-subtle"
                        placeholder="Edit your message…"
                        autoFocus
                      />
                      <div className="flex items-center gap-1">
                        <button onClick={saveEdit} disabled={!editInput.trim()} className="grid h-9 w-9 place-items-center rounded-full bg-studio-primary text-studio-primary-fg disabled:opacity-50">
                          <Check className="h-4 w-4" />
                        </button>
                        <button onClick={cancelEdit} className="grid h-9 w-9 place-items-center rounded-full text-studio-subtle hover:text-studio-fg">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : m.role === 'user' ? (
                    <div className="relative rounded-xl rounded-br-sm bg-studio-elevated px-4 py-3 text-sm leading-normal text-studio-fg shadow-studio-border">
                      {m.content}
                      <button
                        onClick={() => startEdit(i)}
                        className="absolute -top-2 -right-2 rounded-full bg-studio-surface p-1 text-studio-subtle opacity-0 shadow-studio-border transition-opacity hover:text-studio-fg group-hover:opacity-100"
                        title="Edit message"
                        aria-label="Edit message"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-studio-subtle">LIPRO</p>
                      {m.isError ? (
                        <div className="flex items-center gap-1.5 rounded-lg bg-studio-danger/10 px-4 py-3 text-sm text-studio-danger">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {m.content || 'Something went wrong'}
                        </div>
                      ) : m.content ? (
                        <div className="text-sm leading-normal text-studio-fg">
                          <MarkdownMessage content={m.content} />
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-studio-primary" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-studio-primary" style={{ animationDelay: '0.15s' }} />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-studio-primary" style={{ animationDelay: '0.3s' }} />
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {m.role === 'user' && editingIndex !== i && (
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-studio-elevated text-studio-muted">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </article>
            ))}
            <div ref={endRef} />
          </div>
        </div>

        <div className="shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 md:px-6">
          <div className="mx-auto w-full max-w-3xl">
            {messages.length === 1 && !activeId && (
              <div className="mb-3 flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-lg bg-studio-surface px-4 py-2.5 text-left text-xs leading-normal text-studio-muted shadow-studio-border transition-colors hover:text-studio-fg hover:shadow-studio-border-hover"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {docs.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-studio-subtle">Attached documents</span>
                {docs.map((d) => (
                  <span key={d.id || d.name} className="group inline-flex max-w-[220px] items-center gap-1.5 rounded-full bg-studio-elevated py-1 pl-2.5 pr-1 text-xs font-medium text-studio-fg shadow-studio-border">
                    <FileText className="h-3 w-3 shrink-0 text-studio-primary" />
                    <span className="truncate">{d.name}</span>
                    <button
                      type="button"
                      onClick={() => removeDoc(d.id)}
                      className="shrink-0 rounded-full p-1 text-studio-subtle transition-colors hover:text-studio-danger"
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
              <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-studio-primary">
                <CheckCircle2 className="h-3.5 w-3.5" /> Document saved — ask LIPRO AI about it and it will teach from it.
              </p>
            )}
            {attached.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {attached.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-studio-elevated px-2.5 py-2 text-sm shadow-studio-border">
                    {a.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.preview} alt={a.name} className="h-10 w-10 shrink-0 rounded-md object-cover" />
                    ) : (
                      <FileText className="h-4 w-4 shrink-0 text-studio-primary" />
                    )}
                    <span className="max-w-[160px] min-w-0 flex-1 truncate font-medium text-studio-fg">{a.name}</span>
                    <button
                      type="button"
                      onClick={() => setAttached((prev) => prev.filter((_, idx) => idx !== i))}
                      className="shrink-0 rounded-full p-1 text-studio-subtle transition-colors hover:text-studio-fg"
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
              <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-studio-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {uploadProgress || 'Uploading…'}
              </p>
            )}
            {attachError && <p className="mb-2 text-xs font-medium text-studio-danger">{attachError}</p>}

            <form
              className="flex items-end gap-2 rounded-xl bg-studio-surface p-2 shadow-studio-border"
              onSubmit={(e) => { e.preventDefault(); send(input); }}
            >
              <input ref={fileInputRef} type="file" className="hidden" onChange={onPickFile} />
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
                value={input}
                onChange={(e) => { setInput(e.target.value); autoResize(); }}
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
                  disabled={loadingConversation || (!input.trim() && attached.length === 0)}
                  className={cn(
                    'grid h-9 w-9 shrink-0 place-items-center self-end rounded-full transition-transform active:scale-95',
                    input.trim() || attached.length > 0 ? 'bg-studio-primary text-studio-primary-fg' : 'bg-studio-elevated text-studio-subtle',
                  )}
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
    </div>
  );
}
