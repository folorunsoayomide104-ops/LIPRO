import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { chatSchema } from '@/lib/validators';
import { resolveAiProvider } from '@/lib/ai';
import { nvidiaChatCompletion, openNvidiaStream } from '@/lib/nvidia';
import { extractText, MAX_UPLOAD_BYTES } from '@/lib/pdf';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `You are LIPRO AI, an advanced university tutoring assistant for Nigerian students. You are patient, encouraging, and use clear examples. When a student asks about a concept, explain it simply, provide a worked example, and end with a short practice question they can attempt. You reference their faculty and level where useful. Always be accurate. If a question is about CBT material, format answers concisely.

A document may be attached (shown as "[Attached document: ...]" or "[Document: ...]" blocks). IMPORTANT — behave like ChatGPT with an uploaded file:
- You always know the document is attached. NEVER say "no document is attached" when a "[Document:" block is present.
- Do NOT start teaching, summarizing, or explaining the document content unprompted. If the user is just chatting or greeting, respond normally without referencing the document.
- Only read into / teach from the document when the user actually asks about it or refers to it (e.g. "summarize this", "what does it say", "teach me from this", "answer from the document"). Then use the document's content and quote from it where helpful.`;

type HistoryMsg = { role: string; content: string };
type DocContext = { name: string; text: string };

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
  let budget = 30000;
  for (const d of teachingDocs) {
    if (budget <= 0) break;
    const slice = d.text.slice(0, budget);
    docs.push({ name: d.name, text: slice });
    budget -= slice.length;
  }

  const shouldStream = wantStream && apiKey.trim().length > 0;

  if (shouldStream) {
    return handleStream(user.userId, conversation, history, message, apiKey, baseURL, model, provider.provider, docs, materialId);
  }
  let replyText: string;
  let usedFallback = false;

  if (apiKey && apiKey.trim().length > 0) {
    try {
      replyText = await nvidiaChatCompletion({
        apiKey,
        baseURL,
        model,
        label: provider.provider === 'groq' ? 'Groq' : 'NVIDIA NIM',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...buildModelMessages(history, docs),
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
  materialId?: string | null
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

  const upstreamRes = await openNvidiaStream({
    apiKey,
    baseURL,
    model,
    label: providerName === 'groq' ? 'Groq' : 'NVIDIA NIM',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...buildModelMessages(history, docs),
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
  return `**LIPRO AI — model server is temporarily unavailable**

You asked: "${message}"${fileName ? `\n\nI also received your attached document "${fileName}".` : ''}

The AI model server didn't respond in time (it's often busy during peak hours). Try again in a moment, and if it keeps failing, you can:

- Double-check your API key in **Settings → AI API Key**
- Wait a few minutes and retry

Your conversation is saved, so you can continue where you left off.`;
}

function fallbackReply(message: string, fileName?: string): string {
  if (fileName) {
    return `**LIPRO AI (demo mode — add your Groq or NVIDIA API key in Settings > AI API Key for full AI tutoring)**

You attached "${fileName}" and asked: "${message}"

In demo mode I can't read the document contents. Add your Groq or NVIDIA NIM API key in **Settings → AI API Key** and I'll analyze the attached PDF and answer from it — summarise, explain concepts, and generate practice questions from the material.`;
  }
  return `**LIPRO AI (demo mode — add your Groq or NVIDIA API key in Settings > AI API Key for full AI tutoring)**

You asked: "${message}"

Here's a sample response to demonstrate the wiring:

Great question! Let me break this down step by step.

First, identify the key concept. Then work through a concrete example. Finally, try a small practice question on your own.

> Tip: Go to **Settings → AI API Key** and paste your free key from build.nvidia.com to enable real AI tutoring.`;
}
