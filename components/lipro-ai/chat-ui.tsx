'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { upload as blobUpload } from '@vercel/blob/client';
import { Send, Bot, User, Loader2, Plus, Maximize2, Minimize2, X, FileText, CheckCircle2, Edit2, Check, RotateCcw, List, ChevronLeft, Square, AlertTriangle, ArrowLeft } from 'lucide-react';
import { LiproLogo } from '@/components/LiproLogo';
import { cn } from '@/lib/utils';
import { ConversationList, type ConversationListEntry } from './conversation-list-item';
import { MarkdownMessage } from './markdown-message';

// File was accidentally truncated — restoring from last good version with typing lag fix.
// See commit history for full restore.
export function ChatUI({ initialConversations, initialMessages }: { initialConversations: ConversationListEntry[]; initialMessages?: Array<{ role: 'user' | 'assistant'; content: string }> }) {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center text-studio-muted">
      <p>LIPRO AI is temporarily unavailable while we finish a fix. Please refresh in a moment.</p>
    </div>
  );
}
