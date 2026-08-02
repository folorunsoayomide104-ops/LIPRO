export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
export const MAX_TEXT_CHARS = 60000;

const g = globalThis as Record<string, unknown>;
if (!g.DOMMatrix || !g.ImageData || !g.Path2D) {
  try {
    const canvas = require('@napi-rs/canvas') as Record<string, unknown>;
    if (!g.DOMMatrix && canvas.DOMMatrix) g.DOMMatrix = canvas.DOMMatrix;
    if (!g.ImageData && canvas.ImageData) g.ImageData = canvas.ImageData;
    if (!g.Path2D && canvas.Path2D) g.Path2D = canvas.Path2D;
  } catch {
    // @napi-rs/canvas unavailable — pdf-parse may still work for text-only PDFs.
  }
}

export type ExtractResult = {
  text: string;
  truncated: boolean;
};

export async function extractText(buffer: Buffer, mimeType: string): Promise<ExtractResult> {
  let raw = '';

  if (mimeType === 'application/pdf' || buffer.subarray(0, 5).toString('latin1') === '%PDF-') {
    try {
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: buffer });
      const parsed = await parser.getText();
      raw = parsed.text || '';
      await parser.destroy().catch(() => undefined);
    } catch (err: any) {
      throw new Error(`Could not read this PDF: ${err?.message || 'unknown error'}`);
    }
  } else if (mimeType.startsWith('text/')) {
    raw = buffer.toString('utf8');
  } else {
    raw = buffer.toString('utf8');
  }

  const collapsed = raw.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (collapsed.length === 0) {
    throw new Error('No readable text found. This file may be a scanned image PDF — try a text-based PDF.');
  }
  const truncated = collapsed.length > MAX_TEXT_CHARS;
  return { text: truncated ? collapsed.slice(0, MAX_TEXT_CHARS) : collapsed, truncated };
}
