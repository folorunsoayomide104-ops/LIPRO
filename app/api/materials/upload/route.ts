import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { guard } from '@/lib/api-guard';
import { MAX_UPLOAD_BYTES } from '@/lib/pdf';

export const maxDuration = 120;

export async function POST(request: Request) {
  const { ok, response } = await guard();
  if (!ok) return response!;

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const payload = clientPayload ? JSON.parse(clientPayload) : {};
        if (payload.sizeBytes && payload.sizeBytes > MAX_UPLOAD_BYTES) {
          throw new Error('File is too large. Max size is 100MB.');
        }
        return {
          allowedContentTypes: ['application/pdf', 'text/plain', 'text/markdown', 'text/csv'],
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
