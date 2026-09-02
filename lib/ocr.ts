import { resolveNvidiaApiKey, NVIDIA_BASE_URL } from './ai';

const VISION_MODEL = process.env.NVIDIA_VISION_MODEL || 'meta/llama-3.2-11b-vision-instruct';

/**
 * Vision/OCR is resolved independently of the chat provider — same
 * reasoning as embeddings (lib/embeddings.ts). Confirmed directly against
 * Groq's live model catalog: it currently offers no vision-capable model
 * at all (the previous default, llama-3.2-11b-vision-preview, no longer
 * exists there), so routing through whichever provider is configured for
 * chat silently broke every image/scanned-PDF read for a Groq-configured
 * account — including this app's own server-level key. NVIDIA NIM is the
 * only provider integrated here that actually hosts a working vision
 * model, so this always uses an NVIDIA key regardless of what's set for
 * chat, and fails with a clear message when no NVIDIA key exists.
 */
export async function extractTextFromImage(buffer: Buffer, userId: string): Promise<string> {
  const apiKey = await resolveNvidiaApiKey(userId);
  if (!apiKey) {
    throw new Error('Reading images/scanned documents needs an NVIDIA API key. Add one in Settings.');
  }

  const mimeType = sniffMimeType(buffer);
  const base64 = buffer.toString('base64');

  const res = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      temperature: 0.1,
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract ALL text from this image verbatim. Preserve the original wording exactly. Output only the extracted text, with no commentary or preamble.',
            },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Vision model request failed: ${res.status}`);
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content || '';
  const text = content.trim();
  if (!text) {
    throw new Error('Could not read any text from this image. Try uploading a clearer image.');
  }
  return text;
}

function sniffMimeType(buffer: Buffer): string {
  if (buffer.length < 4) return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG') return 'image/png';
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'image/gif';
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return 'image/webp';
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) return 'image/bmp';
  return 'image/png';
}
