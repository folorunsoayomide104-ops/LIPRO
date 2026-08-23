import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { chatSchema } from '@/lib/validators';
import { resolveAiProviders, type AiProviderConfig } from '@/lib/ai';
import { MAX_UPLOAD_BYTES } from '@/lib/pdf';
import { ingestMaterial } from '@/lib/materials/ingest';
import { isTrustedBlobUrl } from '@/lib/blob-url';
import { fetchRelevantChunks, buildRagContext } from '@/lib/rag';
import { runLiproAiPipeline } from '@/lib/lipro/pipeline';
import type { PipelineInput } from '@/lib/lipro/types';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

// Matches app/api/materials/route.ts — a chat-attached scanned PDF goes
// through the same OCR ingestion path and needs the same higher ceiling.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

type HistoryMsg = { role: string; content: string };
type DocContext = { name: string; text: string };

async function linkMaterialToConversation(convId: string, materialId: string): Promise<void> {
  try {
    await prisma.aiConversationMaterial.create({ data: { conversationId: convId, materialId } });
  } catch {
    // Already linked or link failed — not fatal.
  }
}

async function persistConversation(userId: string, conversationId: string | undefined, existing: any, history: HistoryMsg[], firstUserMsg: string): Promise<string> {
  if (existing) {
    await prisma.aiConversation.update({
      where: { id: existing.id },
      data: { messages: JSON.stringify(history), title: existing.title === 'New Chat' ? firstUserMsg.slice(0, 60) : existing.title },
    });
    return existing.id;
  }
  const created = await prisma.aiConversation.create({
    data: { userId, title: firstUserMsg.slice(0, 60), messages: JSON.stringify(history) },
  });
  return created.id;
}

export async function POST(req: Request) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;

  // Each message can trigger a paid AI call (and, with attached files, OCR/
  // embedding calls too) — cap per-user volume so a runaway client loop or
  // deliberate abuse can't run up the AI bill unchecked.
  const chatLimit = await checkRateLimit(`ai-chat:${user.userId}`, 10 * 60 * 1000, 30);
  if (!chatLimit.ok) return rateLimitResponse(chatLimit);

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 });
  const { message, conversationId, files } = parsed.data;
  const wantStream = parsed.data.stream === true;

  if (!message.trim()) return NextResponse.json({ error: 'Message is required' }, { status: 422 });

  // Resolved once and reused both for ingestion (so uploads embed with the same
  // provider that will answer the message) and the pipeline call below.
  // `providers` is the full priority-ordered list — see generateQuestionsFromText
  // in lib/question-gen.ts for why the pipeline needs to try more than the
  // first one (Groq's free tier 429s persistently once its daily quota is
  // spent, and this account also has a working NVIDIA key configured).
  const providers = await resolveAiProviders(user.userId);
  const provider: AiProviderConfig = providers[0] ?? { provider: 'none', apiKey: '', baseURL: '', model: '' };

  const allDocContexts: DocContext[] = [];
  const materialIds: string[] = [];
  const failedFiles: Array<{ name: string; reason: string }> = [];

  if (files && files.length > 0) {
    const validFiles = files.filter((f): f is { url: string; name: string } => !!f.url && !!f.name);
    for (const fileInfo of validFiles) {
      const name = fileInfo.name || 'document.pdf';
      if (!isTrustedBlobUrl(fileInfo.url)) {
        failedFiles.push({ name, reason: 'Invalid file URL.' });
        continue;
      }
      try {
        const head = await fetch(fileInfo.url, { method: 'HEAD' }).catch(() => null);
        const len = Number(head?.headers.get('content-length') || 0);
        if (len > MAX_UPLOAD_BYTES) {
          failedFiles.push({ name, reason: 'File is too large (max 100MB).' });
          continue;
        }

        const blobRes = await fetch(fileInfo.url).catch(() => null);
        if (!blobRes || !blobRes.ok) {
          failedFiles.push({ name, reason: 'Could not download the uploaded file.' });
          continue;
        }

        const buffer = Buffer.from(await blobRes.arrayBuffer());
        // Chunked + embedded synchronously here — same request, before the AI
        // replies — so the document is RAG-searchable for the very message
        // that attached it, not just future turns.
        const result = await ingestMaterial({
          userId: user.userId,
          buffer,
          originalName: name,
          declaredMimeType: head?.headers.get('content-type') ?? undefined,
        });
        if ('error' in result) {
          failedFiles.push({ name, reason: result.error });
          continue;
        }

        allDocContexts.push({ name, text: result.material.text.slice(0, 24000) });
        materialIds.push(result.material.id);
      } catch (err: any) {
        console.error(`Failed to process file ${fileInfo.name}:`, err?.message || err);
        failedFiles.push({ name, reason: err?.message || 'Failed to read this file.' });
      }
    }
    if (validFiles.length > 0 && allDocContexts.length === 0) {
      return NextResponse.json({
        error: 'Could not read any text from your uploaded files. Make sure images are clear and documents contain text.',
        failedFiles,
      }, { status: 422 });
    }
  }

  const apiKey = provider.apiKey;

  const profile = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { fullName: true, university: true, department: true, level: true, role: true },
  });

  let conversation: any = null;
  if (conversationId) {
    // findFirst scoped by userId, not findUnique by id alone — otherwise
    // any authenticated user who obtains another user's conversationId
    // (a leaked link, a screenshot, browser history) could inject messages
    // into that conversation and have the server load its full prior
    // history and attached document text as context, then simply ask the
    // model to repeat it back. If the id doesn't belong to this user,
    // conversation stays null and the code below correctly starts a fresh
    // conversation instead of touching someone else's.
    conversation = await prisma.aiConversation.findFirst({
      where: { id: conversationId, userId: user.userId },
      include: { materials: { include: { material: { select: { originalName: true, text: true } } } } },
    });
  }
  const history: HistoryMsg[] = conversation ? JSON.parse(conversation.messages) : [];
  history.push({ role: 'user', content: message });

  let ragContext = '';
  if (apiKey && apiKey.trim().length > 0) {
    const chunks = await fetchRelevantChunks(user.userId, message, 5);
    ragContext = buildRagContext(chunks);
  }

  // All documents saved to this conversation (+ the one just attached) are
  // always available in context so the AI knows they're attached — but the
  // reasoning engine only teaches from them when the user asks.
  const persistedDocs: DocContext[] = (conversation?.materials ?? []).map((m: any) => ({
    name: m.material.originalName,
    text: m.material.text ?? '',
  }));
  const teachingDocs: DocContext[] = [...persistedDocs];
  for (const ctx of allDocContexts) {
    if (!persistedDocs.some((d) => d.name === ctx.name && d.text === ctx.text)) {
      teachingDocs.push(ctx);
    }
  }
  const docs: DocContext[] = [];
  let budget = 12000;
  for (const d of teachingDocs) {
    if (budget <= 0) break;
    const slice = d.text.slice(0, budget);
    docs.push({ name: d.name, text: slice });
    budget -= slice.length;
  }

  const pipelineInput: PipelineInput = {
    userId: user.userId,
    user: {
      fullName: profile?.fullName || '',
      university: profile?.university || '',
      department: profile?.department || '',
      level: profile?.level || '',
      role: profile?.role || user.role,
    },
    provider,
    messages: history,
    docs,
    ragContext,
    runtimeRagSearch: async (query: string) => {
      const chunks = await fetchRelevantChunks(user.userId, query, 5);
      return buildRagContext(chunks);
    },
  };

  const shouldStream = wantStream && apiKey.trim().length > 0;

  if (shouldStream) {
    return handleStream(user.userId, conversation, history, message, docs, materialIds, failedFiles, pipelineInput, providers);
  }
  let replyText: string;
  let usedFallback = false;

  if (apiKey && apiKey.trim().length > 0) {
    replyText = nvidiaDownReply(message, docs[0]?.name);
    usedFallback = true;
    // Try every configured provider in order — see generateQuestionsFromText
    // in lib/question-gen.ts for the same pattern and why it's needed.
    for (const cfg of providers) {
      try {
        const result = await runLiproAiPipeline({ ...pipelineInput, provider: cfg });
        replyText = result.reply;
        usedFallback = false;
        break;
      } catch (err: any) {
        console.error(`LIPRO AI error on ${cfg.provider}:`, err?.message || err);
      }
    }
  } else {
    replyText = fallbackReply(message, docs[0]?.name);
    usedFallback = true;
  }

  history.push({ role: 'assistant', content: replyText });
  const convId = await persistConversation(user.userId, conversationId, conversation, history, message);
  for (const mid of materialIds) {
    await linkMaterialToConversation(convId, mid);
  }

  return NextResponse.json({ reply: replyText, conversationId: convId, fallback: usedFallback, materialIds, failedFiles });
}

async function handleStream(
  userId: string,
  conversation: any,
  history: HistoryMsg[],
  firstUserMsg: string,
  docs: DocContext[] = [],
  materialIds: string[] = [],
  failedFiles: Array<{ name: string; reason: string }> = [],
  pipelineInput: PipelineInput,
  providers: AiProviderConfig[]
): Promise<Response> {
  // Persist the thread up-front (user message only) so we have a conversationId for the client.
  let convId: string;
  try {
    if (conversation) {
      await prisma.aiConversation.update({
        where: { id: conversation.id },
        data: {
          messages: JSON.stringify(history),
          title: conversation.title === 'New Chat' ? firstUserMsg.slice(0, 60) : conversation.title,
        },
      });
      convId = conversation.id;
    } else {
      const created = await prisma.aiConversation.create({
        data: { userId, title: firstUserMsg.slice(0, 60), messages: JSON.stringify(history) },
      });
      convId = created.id;
    }
  } catch (err: any) {
    console.error('Persist conversation (pre) failed:', err?.message || err);
    return NextResponse.json({ error: 'Could not start conversation' }, { status: 500 });
  }

  for (const mid of materialIds) {
    await linkMaterialToConversation(convId, mid);
  }

  // Run the pipeline (planner → reasoning → self-eval) with the reasoning
  // stage's tokens streamed live to the client as they're generated, instead
  // of waiting for the full pipeline and fake-chunking the result after.
  const encoder2 = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder2.encode(`data: ${JSON.stringify({ conversationId: convId, materialIds, failedFiles })}\n\n`));

      let finalText = '';
      // 'success' = a provider completed cleanly. 'partial' = a provider
      // streamed real content but then errored — keep what already reached
      // the client rather than appending a fallback message on top of it.
      // 'none' = nothing usable came back from any provider.
      let outcome: 'success' | 'partial' | 'none' = 'none';
      // Try every configured provider in order — see generateQuestionsFromText
      // in lib/question-gen.ts for the same pattern. Only move on to the next
      // candidate if THIS attempt failed before streaming anything to the
      // client — once tokens have gone out, a silent retry would duplicate
      // or garble what the user already sees, so a mid-stream failure keeps
      // the partial text instead of trying another provider.
      for (const cfg of providers) {
        let streamedAny = false;
        let attemptText = '';
        try {
          const result = await runLiproAiPipeline({
            ...pipelineInput,
            provider: cfg,
            onDelta: (text) => {
              streamedAny = true;
              attemptText += text;
              controller.enqueue(encoder2.encode(`data: ${JSON.stringify({ text })}\n\n`));
            },
          });
          // The reasoning stage streamed the draft above; if self-eval didn't
          // touch it (streaming replies aren't corrected retroactively, see
          // runLiproAiPipeline), result.reply already equals attemptText.
          finalText = result.reply || attemptText;
          outcome = 'success';
          break;
        } catch (err: any) {
          console.error(`LIPRO AI stream error on ${cfg.provider}:`, err?.message || err);
          if (streamedAny) {
            finalText = attemptText;
            outcome = 'partial';
            break;
          }
        }
      }
      const usedFallback = outcome === 'none';
      if (usedFallback) {
        finalText = nvidiaDownReply(firstUserMsg, docs[0]?.name);
        controller.enqueue(encoder2.encode(`data: ${JSON.stringify({ text: finalText })}\n\n`));
      }

      history.push({ role: 'assistant', content: finalText });
      try {
        await prisma.aiConversation.update({ where: { id: convId }, data: { messages: JSON.stringify(history) } });
      } catch (err: any) {
        console.error('Persist conversation (post) failed:', err?.message || err);
      }

      if (usedFallback) {
        controller.enqueue(encoder2.encode(`data: ${JSON.stringify({ fallback: true })}\n\n`));
      }
      controller.enqueue(encoder2.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

function nvidiaDownReply(message: string, fileName?: string): string {
  const extra = fileName ? ` I also have your document "${fileName}" attached.` : '';
  return `Looks like the AI service is a bit busy right now.${extra} Could you try sending your message again in a moment? If this keeps happening, you may want to check your API key in Settings.`;
}

function fallbackReply(message: string, fileName?: string): string {
  if (fileName) {
    return `I'm currently in demo mode. You can unlock the full AI by adding a Groq or NVIDIA API key in Settings. In the meantime, I saw you asked: "${message}" — feel free to share more details and I'll guide you based on general knowledge!`;
  }
  return `I'm in demo mode right now! Add a Groq or NVIDIA API key in Settings to unlock full AI tutoring. You asked: "${message}" — happy to help with general study tips until then!`;
}
