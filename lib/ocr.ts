import { resolveAiProvider } from './ai';

const VISION_MODELS: Record<string, string> = {
  groq: process.env.GROQ_VISION_MODEL || 'llama-3.2-11b-vision-preview',
  nvidia: process.env.NVIDIA_VISION_MODEL || 'meta/llama-3.2-11b-vision-instruct',
};

export async function extractTextFromImage(buffer: Buffer, userId: string): Promise<string> {
  const provider = await resolveAiProvider(userId);
  if (provider.provider === 'none' || !provider.apiKey) {
    throw new Error('No AI provider configured. Add a Groq or NVIDIA API key in Settings to read images.');
  }

  const mimeType = sniffMimeType(buffer);
  const base64 = buffer.toString('base64');
  const model = VISION_MODELS[provider.provider] || VISION_MODELS.nvidia;

  const res = await fetch(`${provider.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model,
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
