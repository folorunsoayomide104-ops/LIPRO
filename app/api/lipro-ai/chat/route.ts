import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { chatSchema } from '@/lib/validators';
import { resolveAiProvider } from '@/lib/ai';
import { runAgenticLoop, type ToolDefinition, type ToolExecutor } from '@/lib/nvidia';
import { extractText, MAX_UPLOAD_BYTES } from '@/lib/pdf';
import { generateEmbedding } from '@/lib/embeddings';
import { extractTextFromImage } from '@/lib/ocr';
import { webSearch, formatSearchResults } from '@/lib/websearch';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `You are LIPRO AI, a friendly study companion for Nigerian university students. Chat naturally and concisely, like ChatGPT.

Guidelines:
- Be direct and to the point. Short, natural responses — no preamble, no filler, no repetition.
- Chat like a real human: casual greetings ("Hey! What's up?"), brief acknowledgments, quick answers.
- For small talk, keep it light and brief, then nudge back to studying.
- When explaining concepts, use short, clear sentences and only include details that help. Use light formatting (bold, short lists) sparingly.
- Documents in context: answer from them when asked; don't mention them otherwise.
- You can search the web in real time using the web_search tool whenever you need current, up-to-date information, recent news, or facts you're unsure about. Reason through the question, decide if a search would help, and use it.
- If the user corrects you, acknowledge simply and move on.`;

const WEB_SEARCH_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'web_search',
    description:
      'Search the web in real time. Use this to get current, up-to-date information, recent news, facts, or anything you are unsure about. Provide a concise query.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query, e.g. "JAMB 2026 date"' },
      },
      required: ['query'],
    },
  },
};

async function executeWebSearch(name: string, args: any): Promise<string> {
  if (name !== 'web_search') return 'Unknown tool';
  const query = String(args?.query || '').trim();
  if (!query) return 'No query provided';
  const results = await webSearch(query, 5);
  return formatSearchResults(results);
}

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
  let files: Array<{ url: string; name: string }> | undefined;

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
    files = parsed.data.files as Array<{ url: string; name: string }> | undefined;
  }

  if (!message.trim()) return NextResponse.json({ error: 'Message is required' }, { status: 422 });

  const allDocContexts: DocContext[] = [];
  const materialIds: string[] = [];

  // Handle multiple files from the new format
  if (files && files.length > 0) {
    const validFiles = files.filter((f): f is { url: string; name: string } => !!f.url && !!f.name);
    for (const fileInfo of validFiles) {
      try {
        const head = await fetch(fileInfo.url, { method: 'HEAD' }).catch(() => null);
        const len = Number(head?.headers.get('content-length') || 0);
        if (len > MAX_UPLOAD_BYTES) continue;

        const blobRes = await fetch(fileInfo.url).catch(() => null);
        if (!blobRes || !blobRes.ok) continue;

        const buffer = Buffer.from(await blobRes.arrayBuffer());
        if (buffer.length === 0) continue;

        const name = fileInfo.name || 'document.pdf';
        const looksLikePdf = name.toLowerCase().endsWith('.pdf');
        const looksLikeImage = /^image\//.test(head?.headers.get('content-type') || '') || /\.(jpg|jpeg|png|gif|webp|bmp|tiff|svg)$/i.test(name);
        const mimeType = looksLikePdf ? 'application/pdf' : looksLikeImage ? (head?.headers.get('content-type') || 'image/jpeg') : 'text/plain';

        let text = '';
        if (looksLikeImage) {
          text = await extractTextFromImage(buffer, user.userId);
        } else {
          const result = await extractText(buffer, mimeType);
          text = result.text;
        }

        if (text) {
          allDocContexts.push({ name, text: text.slice(0, 24000) });
          const material = await prisma.material.create({
            data: { userId: user.userId, originalName: name, mimeType, sizeBytes: buffer.length, status: 'ready', text },
            select: { id: true },
          });
          materialIds.push(material.id);
        } else {
          console.error(`No text extracted from file ${fileInfo.name}`);
        }
      } catch (err: any) {
        console.error(`Failed to process file ${fileInfo.name}:`, err?.message || err);
      }
    }
    if (validFiles.length > 0 && allDocContexts.length === 0) {
      return NextResponse.json({ error: 'Could not read any text from your uploaded files. Make sure images are clear and documents contain text.' }, { status: 422 });
    }
  }
  // Handle single blobUrl (legacy format)
  else if (blobUrl) {
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
    const looksLikeImage = /\.(jpg|jpeg|png|gif|webp|bmp|tiff|svg)$/i.test(name);
    const mimeType = looksLikePdf ? 'application/pdf' : looksLikeImage ? 'image/jpeg' : 'text/plain';
    let text = '';
    try {
      if (looksLikeImage) {
        text = await extractTextFromImage(buffer, user.userId);
        if (!text) {
          return NextResponse.json({ error: 'Could not read any text from this image. Try uploading a clearer image.' }, { status: 422 });
        }
      } else {
        const result = await extractText(buffer, mimeType);
        text = result.text;
      }
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || 'Failed to read the document' }, { status: 422 });
    }
    allDocContexts.push({ name, text: text.slice(0, 24000) });
    const material = await prisma.material.create({
      data: { userId: user.userId, originalName: name, mimeType, sizeBytes: buffer.length, status: 'ready', text },
      select: { id: true },
    });
    materialIds.push(material.id);
  } else if (file) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File is too large. Max size is 100MB.' }, { status: 413 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: 'The file is empty.' }, { status: 422 });
    }
    const looksLikePdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
    const looksLikeImage = /^image\/(jpeg|png|gif|webp|bmp|tiff|svg\+xml)$/.test(file.type) || /\.(jpg|jpeg|png|gif|webp|bmp|tiff|svg)$/.test(file.name.toLowerCase());
    const allowedTypes = ['application/pdf', 'text/plain', 'text/markdown', 'text/csv'];
    if (!looksLikePdf && !looksLikeImage && !allowedTypes.includes(file.type) && !/\.(txt|md|markdown|csv)$/.test(file.name.toLowerCase())) {
      return NextResponse.json({ error: 'Unsupported file type. Upload a PDF, image (JPG, PNG, etc.), TXT or MD file.' }, { status: 415 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = looksLikePdf ? 'application/pdf' : looksLikeImage ? file.type : (file.type || 'text/plain');
    let text = '';
    try {
      if (looksLikeImage) {
        text = await extractTextFromImage(buffer, user.userId);
        if (!text) {
          return NextResponse.json({ error: 'Could not read any text from this image. Try uploading a clearer image.' }, { status: 422 });
        }
      } else {
        const result = await extractText(buffer, mimeType);
        text = result.text;
      }
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || 'Failed to read the file' }, { status: 422 });
    }
    allDocContexts.push({ name: file.name, text: text.slice(0, 24000) });
    const material = await prisma.material.create({
      data: { userId: user.userId, originalName: file.name, mimeType, sizeBytes: file.size, status: 'ready', text },
      select: { id: true },
    });
    materialIds.push(material.id);
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

  const shouldStream = wantStream && apiKey.trim().length > 0;

  if (shouldStream) {
    return handleStream(user.userId, conversation, history, message, apiKey, baseURL, model, provider.provider, docs, materialIds, ragChunks);
  }
  let replyText: string;
  let usedFallback = false;

  if (apiKey && apiKey.trim().length > 0) {
    try {
      const ragContext = buildRagContext(ragChunks);
      const ragDocs = ragContext ? [{ name: 'Relevant Document Chunks', text: ragContext }] : [];
      const result = await runAgenticLoop({
        apiKey,
        baseURL,
        model,
        label: provider.provider === 'groq' ? 'Groq' : 'NVIDIA NIM',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...buildModelMessages(history, [...docs, ...ragDocs]),
        ],
        tools: [WEB_SEARCH_TOOL],
        executeTool: executeWebSearch as ToolExecutor,
        temperature: 0.7,
        maxTokens: 900,
      });
      replyText = result.content;
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
  for (const mid of materialIds) {
    await linkMaterialToConversation(convId, mid);
  }

  return NextResponse.json({ reply: replyText, conversationId: convId, fallback: usedFallback, materialIds });
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
  materialIds: string[] = [],
  ragChunks: ChunkResult[] = []
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

  const ragContext = buildRagContext(ragChunks);
  const ragDocs = ragContext ? [{ name: 'Relevant Document Chunks', text: ragContext }] : [];

  // Run the reasoning loop (may invoke web_search) to get the full answer,
  // then stream it back to the client chunk-by-chunk to preserve streaming UX.
  let finalText: string;
  let usedFallback = false;
  try {
    const result = await runAgenticLoop({
      apiKey,
      baseURL,
      model,
      label: providerName === 'groq' ? 'Groq' : 'NVIDIA NIM',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...buildModelMessages(history, [...docs, ...ragDocs]),
      ],
      tools: [WEB_SEARCH_TOOL],
      executeTool: executeWebSearch as ToolExecutor,
      temperature: 0.7,
      maxTokens: 900,
    });
    finalText = result.content;
  } catch (err: any) {
    console.error('LIPRO AI stream error:', err?.message || err);
    finalText = nvidiaDownReply(firstUserMsg, docs[0]?.name);
    usedFallback = true;
  }

  history.push({ role: 'assistant', content: finalText });
  try {
    await prisma.aiConversation.update({ where: { id: convId }, data: { messages: JSON.stringify(history) } });
  } catch (err: any) {
    console.error('Persist conversation (post) failed:', err?.message || err);
  }

  const encoder2 = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder2.encode(`data: ${JSON.stringify({ conversationId: convId })}\n\n`));
      const chunks = finalText.length > 0 ? finalText.match(/.{1,24}/g) || [finalText] : [finalText];
      for (const chunk of chunks) {
        controller.enqueue(encoder2.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
        await new Promise((r) => setTimeout(r, 18));
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
