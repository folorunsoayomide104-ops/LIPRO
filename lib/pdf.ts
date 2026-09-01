export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
export const MAX_TEXT_CHARS = 60000;

// A phone-scanned PDF (CamScanner, Adobe Scan, etc.) has no real text
// layer — each "page" is a raster image wrapped in a PDF container. Some
// scanner apps still embed a tiny text layer containing only their own
// watermark ("CamScanner" repeated once per page), so pdf-parse doesn't
// come back literally empty; it comes back with a handful of characters
// per page that pass the empty-string check but aren't the document's
// actual content. Confirmed directly against a real production upload
// (19-page PDF, 190 total extracted characters, every one of them the
// word "CamScanner"). Below this average chars-per-page, treat native
// extraction as unusable and fall back to OCR instead of shipping
// watermark text as if it were the lecture material.
const SPARSE_TEXT_CHARS_PER_PAGE = 40;
// Cap how many pages get OCR'd per document — each page is a real vision-
// model call (cost + latency), and a lecture PDF beyond this is already an
// edge case worth a clearer error than a multi-minute upload.
const MAX_OCR_PAGES = 30;

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

/**
 * Renders every page of a PDF to a PNG buffer using pdfjs-dist (already a
 * transitive dependency of pdf-parse) + @napi-rs/canvas (already a direct
 * dependency for pdf-parse's own DOM polyfills) — no new packages needed.
 */
async function renderPdfPagesToPng(buffer: Buffer, maxPages: number): Promise<Buffer[]> {
  await ensureDomPolyfills();
  const { createCanvas } = await import('@napi-rs/canvas');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const doc = await loadingTask.promise;
  const pageCount = Math.min(doc.numPages, maxPages);
  const images: Buffer[] = [];

  try {
    for (let i = 1; i <= pageCount; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 }); // 2x for legible OCR on small text
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx as any, viewport, canvas: canvas as any }).promise;
      images.push(canvas.toBuffer('image/png'));
      page.cleanup();
    }
  } finally {
    await doc.destroy().catch(() => undefined);
  }
  return images;
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

/**
 * @param userId Required to OCR a scanned PDF (the vision model call is
 *   billed against the user's configured provider) — without it, a scanned
 *   PDF still fails with the same "no readable text" error as before, just
 *   without the extra OCR attempt in between.
 */
export async function extractText(buffer: Buffer, mimeType: string, userId?: string): Promise<ExtractResult> {
  let raw = '';
  let pageOffsets: number[] | undefined;

  if (mimeType === 'application/pdf' || buffer.subarray(0, 5).toString('latin1') === '%PDF-') {
    let rawPageCount = 0;
    try {
      await ensureDomPolyfills();
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: buffer });
      const parsed = await parser.getText();
      await parser.destroy().catch(() => undefined);
      rawPageCount = parsed.pages?.length || 0;

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

    // Native extraction succeeded but the result is suspiciously thin for
    // the page count — almost certainly a phone-scanned PDF with no real
    // text layer (see SPARSE_TEXT_CHARS_PER_PAGE above). OCR each page
    // instead of shipping scanner-app watermark text as the material.
    const avgCharsPerPage = rawPageCount > 0 ? raw.length / rawPageCount : raw.length;
    if (userId && rawPageCount > 0 && avgCharsPerPage < SPARSE_TEXT_CHARS_PER_PAGE) {
      const { extractTextFromImage } = await import('./ocr');
      const { resolveNvidiaApiKey, AI_FEATURES_ENABLED } = await import('./ai');

      if (!AI_FEATURES_ENABLED) {
        throw new Error('This looks like a scanned document (a phone-scanned PDF with no real text layer). Reading it needs AI, which is temporarily disabled — upload a text-based PDF instead.');
      }

      // Check for a working vision provider BEFORE rendering any pages —
      // rendering N pages just to have every OCR call fail identically for
      // the same reason (no NVIDIA key) wastes real compute, and looping
      // per-page swallows the actual "why" into a vague generic message.
      // Fail fast with the real reason instead.
      const hasVisionProvider = !!(await resolveNvidiaApiKey(userId));
      if (!hasVisionProvider) {
        throw new Error('This looks like a scanned document (a phone-scanned PDF with no real text layer). Reading it needs an NVIDIA API key specifically — add one in Settings, or upload a text-based PDF instead.');
      }

      const images = await renderPdfPagesToPng(buffer, MAX_OCR_PAGES);
      // Sequential OCR (one vision-model call per page, awaited one at a
      // time) blew this route's 120s budget on real multi-page scanned
      // PDFs — confirmed directly against production (a 30-page document
      // times out well before the last page even starts). Run pages
      // concurrently, capped, to keep wall-clock time roughly (pages /
      // OCR_CONCURRENCY) instead of (pages) call-durations.
      const OCR_CONCURRENCY = 4;
      const ocrPages: string[] = new Array(images.length).fill('');
      let lastOcrError: string | null = null;
      let nextIndex = 0;
      async function ocrWorker() {
        while (true) {
          const i = nextIndex++;
          if (i >= images.length) return;
          try {
            ocrPages[i] = collapse(await extractTextFromImage(images[i], userId));
          } catch (err: any) {
            lastOcrError = err?.message || null;
            ocrPages[i] = ''; // one unreadable page shouldn't sink the whole document
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(OCR_CONCURRENCY, images.length) }, ocrWorker));
      const nonEmpty = ocrPages.filter((t) => t.length > 0);
      if (nonEmpty.length === 0) {
        // Both native extraction (watermark-only) and OCR came back empty.
        // Falling through here would let the ~190-char watermark text pass
        // the collapsed.length === 0 check below and ship as if it were
        // real content — the exact bug this whole path exists to fix — so
        // fail explicitly instead, surfacing the real OCR error if there
        // was one rather than a generic message.
        throw new Error(lastOcrError || 'This looks like a scanned document, and no text could be read from any page. Try a clearer scan or a text-based PDF.');
      }
      const offsets: number[] = [];
      let acc = '';
      for (const pageText of ocrPages) {
        offsets.push(acc.length);
        acc = acc ? `${acc}\n\n${pageText}` : pageText;
      }
      raw = acc;
      pageOffsets = offsets;
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
