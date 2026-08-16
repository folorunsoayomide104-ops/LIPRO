'use client';
import { MessageSquare, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ConversationListEntry = { id: string; title: string; updatedAt: string };

export function formatConversationTimestamp(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/**
 * Shared between the desktop sidebar and the mobile drawer — previously this
 * markup was copy-pasted verbatim in both places in chat-ui.tsx.
 */
export function ConversationList({
  conversations, activeId, onOpen, onDelete,
}: {
  conversations: ConversationListEntry[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (conversations.length === 0) {
    return <p className="px-2 py-4 text-center text-xs text-lipro-600/60">No chats yet. Start a new one.</p>;
  }
  return (
    <>
      {conversations.map((c) => (
        <div key={c.id} className={cn('group flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition-all', activeId === c.id ? 'glass font-medium text-lipro-700 dark:text-white' : 'text-lipro-600/70 hover:bg-lipro-50 dark:text-lipro-200/70 dark:hover:bg-lipro-950/40')}>
          <button onClick={() => onOpen(c.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
            <span className="truncate">{c.title}</span>
          </button>
          <span className="shrink-0 text-[10px] opacity-60">{formatConversationTimestamp(c.updatedAt)}</span>
          <button onClick={() => onDelete(c.id)} className="shrink-0 rounded p-1 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 dark:hover:bg-rose-950/30" title="Delete chat">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </>
  );
}
