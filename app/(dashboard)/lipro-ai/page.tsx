import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ChatUI } from '@/components/lipro-ai/chat-ui';

export default async function LiproAiPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const conversations = await prisma.aiConversation.findMany({
    where: { userId: session.userId },
    select: { id: true, title: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  let initialMessages: Array<{ role: 'user' | 'assistant'; content: string }> | undefined;
  if (conversations.length > 0) {
    const latest = await prisma.aiConversation.findUnique({ where: { id: conversations[0].id }, select: { messages: true } });
    if (latest) {
      const parsed = JSON.parse(latest.messages);
      if (Array.isArray(parsed) && parsed.length > 0) initialMessages = parsed;
    }
  }

  return (
    <ChatUI
      initialConversations={conversations.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt.toISOString() }))}
      initialMessages={initialMessages}
    />
  );
}
