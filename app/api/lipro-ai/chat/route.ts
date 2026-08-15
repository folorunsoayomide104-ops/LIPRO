import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';
import { chatSchema } from '@/lib/validators';
import { resolveAiProvider } from '@/lib/ai';
import { extractText, isDocxName, DOCX_MIME, MAX_UPLOAD_BYTES } from '@/lib/pdf';
import { extractTextFromImage } from '@/lib/ocr';
import { fetchRelevantChunks, buildRagContext } from '@/lib/rag';
import { runLiproAiPipeline } from '@/lib/lipro/pipeline';
import type { PipelineInput } from '@/lib/lipro/types';

export const maxDuration = 120;
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
  const failedFiles: Array<{ name: string; reason: string }> = [];

  // Handle multiple files from the new format
  if (files && files.length > 0) {
    const validFiles = files.filter((f): f is { url: string; name: string } => !!f.url && !!f.name);
    for (const fileInfo of validFiles) {
      const name = fileInfo.name || 'document.pdf';
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
        if (buffer.length === 0) {
          failedFiles.push({ name, reason: 'The file is empty.' });
          continue;
        }

        const looksLikePdf = name.toLowerCase().endsWith('.pdf');
        const looksLikeImage = /^image\//.test(head?.headers.get('content-type') || '') || /\.(jpg|jpeg|png|gif|webp|bmp|tiff|svg)$/i.test(name);
        const looksLikeDocx = isDocxName(name);
        const mimeType = looksLikePdf ? 'application/pdf' : looksLikeDocx ? DOCX_MIME : looksLikeImage ? (head?.headers.get('content-type') || 'image/jpeg') : 'text/plain';

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
          failedFiles.push({ name, reason: 'No readable text found in this file.' });
        }
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
    const looksLikeDocx = isDocxName(name);
    const mimeType = looksLikePdf ? 'application/pdf' : looksLikeDocx ? DOCX_MIME : looksLikeImage ? 'image/jpeg' : 'text/plain';
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
    const looksLikeDocx = isDocxName(file.name) || file.type === DOCX_MIME;
    const allowedTypes = ['application/pdf', 'text/plain', 'text/markdown', 'text/csv'];
    if (!looksLikePdf && !looksLikeImage && !looksLikeDocx && !allowedTypes.includes(file.type) && !/\.(txt|md|markdown|csv)$/.test(file.name.toLowerCase())) {
      return NextResponse.json({ error: 'Unsupported file type. Upload a PDF, Word (.docx), image (JPG, PNG, etc.), TXT or MD file.' }, { status: 415 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = looksLikePdf ? 'application/pdf' : looksLikeDocx ? DOCX_MIME : looksLikeImage ? file.type : (file.type || 'text/plain');
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

  const profile = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { fullName: true, university: true, department: true, level: true, role: true },
  });

  let conversation: any = null;
  if (conversationId) {
    conversation = await prisma.aiConversation.findUnique({
      where: { id: conversationId },
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
    return handleStream(user.userId, conversation, history, message, docs, materialIds, failedFiles, pipelineInput);
  }
  let replyText: string;
  let usedFallback = false;

  if (apiKey && apiKey.trim().length > 0) {
    try {
      const result = await runLiproAiPipeline(pipelineInput);
      replyText = result.reply;
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
  pipelineInput: PipelineInput
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
      let usedFallback = false;
      try {
        const result = await runLiproAiPipeline({
          ...pipelineInput,
          onDelta: (text) => {
            finalText += text;
            controller.enqueue(encoder2.encode(`data: ${JSON.stringify({ text })}\n\n`));
          },
        });
        // The reasoning stage streamed the draft above; if self-eval didn't
        // touch it (streaming replies aren't corrected retroactively, see
        // runLiproAiPipeline), result.reply already equals finalText.
        finalText = result.reply || finalText;
      } catch (err: any) {
        console.error('LIPRO AI stream error:', err?.message || err);
        finalText = nvidiaDownReply(firstUserMsg, docs[0]?.name);
        usedFallback = true;
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
