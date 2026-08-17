export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
export const MAX_TEXT_CHARS = 60000;

const g = globalThis as Record<string, unknown>;
async function ensureDomPolyfills() {
  if (g.DOMMatrix && g.ImageData && g.Path2D) return;
  try {
    const canvas = await import('@napi-rs/canvas') as unknown as Record<string, unknown>;
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
  /** Offsets into `text` where each PDF page begins. Only set for multi-page PDFs. */
  pageOffsets?: number[];
};

function collapse(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function isDocxName(name: string): boolean {
  return /\.docx$/i.test(name);
}

function isZipSignature(buffer: Buffer): boolean {
  // DOCX/PPTX/XLSX are all ZIP archives ("PK\x03\x04" signature); plain-text buffers never start this way.
  return buffer.subarray(0, 4).toString('latin1') === 'PK\x03\x04';
}

function looksLikeDocx(buffer: Buffer, mimeType: string): boolean {
  return mimeType === DOCX_MIME || isZipSignature(buffer);
}

export async function extractText(buffer: Buffer, mimeType: string): Promise<ExtractResult> {
  let raw = '';
  let pageOffsets: number[] | undefined;

  if (mimeType === 'application/pdf' || buffer.subarray(0, 5).toString('latin1') === '%PDF-') {
    try {
      await ensureDomPolyfills();
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: buffer });
      const parsed = await parser.getText();
      await parser.destroy().catch(() => undefined);

      // Collapse each page independently, then join, so offsets computed here
      // stay valid in the final collapsed text — collapsing the whole
      // concatenation afterward could shift them (whitespace at page seams).
      const pages = (parsed.pages || []).map((p) => collapse(p.text || '')).filter((t) => t.length > 0);
      if (pages.length > 1) {
        const offsets: number[] = [];
        let acc = '';
        for (const pageText of pages) {
          offsets.push(acc.length);
          acc = acc ? `${acc}\n\n${pageText}` : pageText;
        }
        raw = acc;
        pageOffsets = offsets;
      } else {
        raw = parsed.text || pages[0] || '';
      }
    } catch (err: any) {
      throw new Error(`Could not read this PDF: ${err?.message || 'unknown error'}`);
    }
  } else if (looksLikeDocx(buffer, mimeType)) {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      raw = result.value || '';
    } catch {
      // Any ZIP-shaped file (PPTX, XLSX, plain ZIP, corrupt DOCX) that mammoth
      // can't parse as a Word document lands here — give a user-facing answer
      // instead of leaking mammoth's internal "main document part" wording.
      throw new Error(
        mimeType === DOCX_MIME
          ? 'Could not read this Word document — it may be corrupted.'
          : 'This looks like a PowerPoint, Excel, or other non-Word file. Only PDF and Word (.docx) documents are supported right now.'
      );
    }
  } else if (mimeType.startsWith('text/')) {
    raw = buffer.toString('utf8');
  } else {
    raw = buffer.toString('utf8');
  }

  // Already collapsed per-page above when pageOffsets is set — collapsing again is a no-op.
  const collapsed = pageOffsets ? raw : collapse(raw);
  if (collapsed.length === 0) {
    throw new Error('No readable text found. This file may be a scanned image PDF — try a text-based PDF.');
  }
  const truncated = collapsed.length > MAX_TEXT_CHARS;
  const finalText = truncated ? collapsed.slice(0, MAX_TEXT_CHARS) : collapsed;
  const finalOffsets = pageOffsets ? pageOffsets.filter((o) => o < finalText.length) : undefined;
  return { text: finalText, truncated, pageOffsets: finalOffsets };
}
