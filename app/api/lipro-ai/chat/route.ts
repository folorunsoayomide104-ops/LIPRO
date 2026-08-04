import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { chatSchema } from '@/lib/validators';
import { resolveAiProvider } from '@/lib/ai';
import { nvidiaChatCompletion, openNvidiaStream } from '@/lib/nvidia';
import { extractText, MAX_UPLOAD_BYTES } from '@/lib/pdf';
import { generateEmbedding } from '@/lib/embeddings';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `You are LIPRO AI, a friendly and helpful study companion for Nigerian university students. You can chat naturally like ChatGPT while staying focused on tutoring.

Guidelines:
- Be conversational and warm. You can chat about non-academic topics too, but politely guide back to studies when appropriate.
- Keep answers concise but not robotic. You don't need to rigidly count sentences.
- For acknowledgments ("ok", "thanks", "wait"), respond naturally — a simple "Sure!" or "Of course!" is fine, but feel free to add a brief follow-up if it fits the conversation.
- For small talk, be friendly and human. E.g., "Hi! How's your day going?" is a perfectly fine response.
- If the user corrects you, apologize briefly and move on.
- Documents in context (shown as "[Document: ...]"): Use them to answer questions about the material. Don't mention you have documents unless the user asks about them.
- Avoid repeating the exact same phrase in every message. Vary your responses.
- Use light formatting (bold, short lists) when it helps readability.`;

type HistoryMsg = { role: string; content: string };
type DocContext = { name: string; text: string };
type ChunkResult = { id: string; content: string; chunkIndex: number };

function buildModelMessages(history: HistoryMsg[], docs: DocContext[]): Array<{ role: string; content: string }> {
  const msgs = history.slice(-10).map((h) => ({ role: h.role, content: h.content }));
  if (docs.length > 0) {
    const docBlock = docs.map((d) => `[Document: ${d.name}]\n${d.text}`).join('\n\n---\n\n');
    const last = msgs[msgs.length - 1];
    if (last && last.role === 'user') {
      last.content = `${last.content}\n\n---\n${docBlock}`;
    } else {
      msgs.push({ role: 'user', content: `${docBlock}` });
    }
  }
  return msgs;
}

async function fetchRelevantChunks(userId: string, queryEmbedding: number[], limit: number = 5): Promise<ChunkResult[]> {
  try {
    const embeddingArray = queryEmbedding.map((v) => v.toFixed(6));
    const rows = await prisma.$queryRaw<
      Array<{ id: string; content: string; chunkIndex: number; materialId: string }>
    >`
      SELECT id, content, "chunkIndex", "materialId"
      FROM "DocumentChunk"
      WHERE "userId" = ${userId}
      ORDER BY "embedding" <=> ARRAY[${embeddingArray.join(',')}]::vector
      LIMIT ${limit}
    `;
    return rows.map((r) => ({ id: r.id, content: r.content, chunkIndex: r.chunkIndex }));
  } catch (err: any) {
    console.error('Semantic retrieval failed:', err?.message || err);
    return [];
  }
}

function buildRagContext(chunks: ChunkResult[]): string {
  if (chunks.length === 0) return '';
  return chunks.map((c) => `[Chunk ${c.chunkIndex}]\n${c.content}`).join('\n\n---\n\n');
}

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

  const contentType = req.headers.get('content-type') || '';
  let message = '';
  let conversationId: string | undefined;
  let wantStream = false;
  let file: File | undefined;
  let blobUrl: string | undefined;
  let originalName: string | undefined;

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
    message = String(form.get('message') || '');
    const conv = String(form.get('conversationId') || '');
    if (conv) conversationId = conv;
    wantStream = form.get('stream') === 'true';
    const f = form.get('file');
    if (f instanceof File) file = f;
  } else {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 });
    message = parsed.data.message;
    conversationId = parsed.data.conversationId;
    wantStream = parsed.data.stream === true;
    blobUrl = parsed.data.blobUrl;
    originalName = parsed.data.originalName;
  }

  if (!message.trim()) return NextResponse.json({ error: 'Message is required' }, { status: 422 });

  let docContext: DocContext | null = null;
  let materialId: string | null = null;
  if (blobUrl) {
    const sizeCheck = await (async () => {
      const head = await fetch(blobUrl!, { method: 'HEAD' }).catch(() => null);
      const len = Number(head?.headers.get('content-length') || 0);
      return len;
    })();
    if (sizeCheck > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File is too large. Max size is 100MB.' }, { status: 413 });
    }
    const blobRes = await fetch(blobUrl).catch(() => null);
    if (!blobRes || !blobRes.ok) {
      return NextResponse.json({ error: 'Could not download the uploaded file' }, { status: 422 });
    }
    const buffer = Buffer.from(await blobRes.arrayBuffer());
    if (buffer.length === 0) {
      return NextResponse.json({ error: 'The file is empty.' }, { status: 422 });
    }
    const name = originalName || 'document.pdf';
    const looksLikePdf = name.toLowerCase().endsWith('.pdf');
    const mimeType = looksLikePdf ? 'application/pdf' : 'text/plain';
    let text = '';
    try {
      const result = await extractText(buffer, mimeType);
      text = result.text;
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || 'Failed to read the document' }, { status: 422 });
    }
    docContext = { name, text: text.slice(0, 24000) };
    const material = await prisma.material.create({
      data: { userId: user.userId, originalName: name, mimeType, sizeBytes: buffer.length, status: 'ready', text },
      select: { id: true },
    });
    materialId = material.id;
  } else if (file) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File is too large. Max size is 100MB.' }, { status: 413 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: 'The file is empty.' }, { status: 422 });
    }
    const looksLikePdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
    const allowedTypes = ['application/pdf', 'text/plain', 'text/markdown', 'text/csv'];
    if (!looksLikePdf && !allowedTypes.includes(file.type) && !/\.(txt|md|markdown|csv)$/.test(file.name.toLowerCase())) {
      return NextResponse.json({ error: 'Unsupported file type. Upload a PDF, TXT or MD file.' }, { status: 415 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = looksLikePdf ? 'application/pdf' : (file.type || 'text/plain');
    let text = '';
    try {
      const result = await extractText(buffer, mimeType);
      text = result.text;
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || 'Failed to read the document' }, { status: 422 });
    }
    docContext = { name: file.name, text: text.slice(0, 24000) };
    const material = await prisma.material.create({
      data: { userId: user.userId, originalName: file.name, mimeType, sizeBytes: file.size, status: 'ready', text },
      select: { id: true },
    });
    materialId = material.id;
  }

  const provider = await resolveAiProvider(user.userId);
  const apiKey = provider.apiKey;
  const baseURL = provider.baseURL;
  const model = provider.model;

  let conversation: any = null;
  if (conversationId) {
    conversation = await prisma.aiConversation.findUnique({
      where: { id: conversationId },
      include: { materials: { include: { material: { select: { originalName: true, text: true } } } } },
    });
  }
  const history: HistoryMsg[] = conversation ? JSON.parse(conversation.messages) : [];
  history.push({ role: 'user', content: message });

  let ragChunks: ChunkResult[] = [];
  let queryEmbedding: number[] | null = null;
  if (apiKey && apiKey.trim().length > 0) {
    try {
      const embedding = await generateEmbedding(message, user.userId);
      queryEmbedding = Array.from(embedding);
      ragChunks = await fetchRelevantChunks(user.userId, queryEmbedding, 5);
    } catch (err: any) {
      console.error('RAG embedding failed:', err?.message || err);
    }
  }

  // All documents saved to this conversation (+ the one just attached) are
  // always available in context so the AI knows they're attached — but the
  // system prompt tells it not to teach from them until the user asks.
  const persistedDocs: DocContext[] = (conversation?.materials ?? []).map((m: any) => ({
    name: m.material.originalName,
    text: m.material.text ?? '',
  }));
  const teachingDocs: DocContext[] = [...persistedDocs];
  if (docContext && !persistedDocs.some((d) => d.name === docContext!.name && d.text === docContext!.text)) {
    teachingDocs.push(docContext);
  }
  const docs: DocContext[] = [];
  let budget = 12000;
  for (const d of teachingDocs) {
    if (budget <= 0) break;
    const slice = d.text.slice(0, budget);
    docs.push({ name: d.name, text: slice });
    budget -= slice.length;
  }

  const shouldStream = wantStream && apiKey.trim().length > 0;

  if (shouldStream) {
    return handleStream(user.userId, conversation, history, message, apiKey, baseURL, model, provider.provider, docs, materialId, queryEmbedding ?? null, ragChunks);
  }
  let replyText: string;
  let usedFallback = false;

  if (apiKey && apiKey.trim().length > 0) {
    try {
      const ragContext = buildRagContext(ragChunks);
      const ragDocs = ragContext ? [{ name: 'Relevant Document Chunks', text: ragContext }] : [];
      replyText = await nvidiaChatCompletion({
        apiKey,
        baseURL,
        model,
        label: provider.provider === 'groq' ? 'Groq' : 'NVIDIA NIM',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...buildModelMessages(history, [...docs, ...ragDocs]),
        ],
        temperature: 0.7,
        maxTokens: 800,
        timeoutMs: 55000,
      });
    } catch (err: any) {
      console.error('LIPRO AI error:', err?.message || err);
      replyText = nvidiaDownReply(message, docs[0]?.name);
      usedFallback = true;
    }
  } else {
    replyText = fallbackReply(message, docs[0]?.name);
    usedFallback = true;
  }

  history.push({ role: 'assistant', content: replyText });
  const convId = await persistConversation(user.userId, conversationId, conversation, history, message);
  if (materialId) await linkMaterialToConversation(convId, materialId);

  return NextResponse.json({ reply: replyText, conversationId: convId, fallback: usedFallback, materialId });
}

async function handleStream(
  userId: string,
  conversation: any,
  history: HistoryMsg[],
  firstUserMsg: string,
  apiKey: string,
  baseURL: string,
  model: string,
  providerName: 'groq' | 'nvidia' | 'none',
  docs: DocContext[] = [],
  materialId?: string | null,
  queryEmbedding: number[] | null = null,
  ragChunks: ChunkResult[] = []
): Promise<Response> {
  const encoder = new TextEncoder();

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

  if (materialId) await linkMaterialToConversation(convId, materialId);

  const ragContext = buildRagContext(ragChunks);
  const ragDocs = ragContext ? [{ name: 'Relevant Document Chunks', text: ragContext }] : [];

  const upstreamRes = await openNvidiaStream({
    apiKey,
    baseURL,
    model,
    label: providerName === 'groq' ? 'Groq' : 'NVIDIA NIM',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...buildModelMessages(history, [...docs, ...ragDocs]),
    ],
    temperature: 0.7,
    maxTokens: 800,
  });

  const decoder = new TextDecoder();

  if (!upstreamRes.ok) {
    const replyText = nvidiaDownReply(firstUserMsg, docs[0]?.name);
    history.push({ role: 'assistant', content: replyText });
    await prisma.aiConversation.update({ where: { id: convId }, data: { messages: JSON.stringify(history) } }).catch(() => undefined);
    return jsonStream(encoder, [{ conversationId: convId }, { text: replyText }, { fallback: true }]);
  }

  if (!upstreamRes.body) {
    return NextResponse.json({ error: 'Upstream stream unavailable' }, { status: 502 });
  }

  const reader = upstreamRes.body.getReader();
  const stream = new ReadableStream({
    async start(controller) {
      let buffer = '';
      let fullText = '';
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ conversationId: convId })}\n\n`));

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            let json: any;
            try { json = JSON.parse(payload); } catch { continue; }
            const delta = json.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta.length > 0) {
              fullText += delta;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: delta })}\n\n`));
            }
          }
        }
      } catch (err: any) {
        console.error('Stream error:', err?.message || err);
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }

      try {
        const finalText = fullText.trim().length > 0 ? fullText : nvidiaDownReply(firstUserMsg, docs[0]?.name);
        history.push({ role: 'assistant', content: finalText });
        await prisma.aiConversation.update({ where: { id: convId }, data: { messages: JSON.stringify(history) } });
      } catch (err: any) {
        console.error('Persist conversation (post) failed:', err?.message || err);
      }
    },
    cancel() {
      reader.cancel().catch(() => undefined);
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

function jsonStream(encoder: TextEncoder, events: Array<Record<string, any>>): Response {
  const body = new ReadableStream({
    start(controller) {
      for (const ev of events) controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(body, {
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' },
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
