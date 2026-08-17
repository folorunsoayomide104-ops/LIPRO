import { nvidiaChatCompletion } from '@/lib/nvidia';
import type { AiProviderConfig } from '@/lib/ai';

export interface TextPage {
  num: number;
  label: string;
  text: string;
}

export interface GeneratedGuidePage extends TextPage {
  heading: string;
  summary: string;
  keyPoints: string[];
}

const MAX_PAGES = 40;
const MIN_PAGE_CHARS = 50;
const SYNTHETIC_SECTION_CHARS = 2200;

/**
 * Splits a material's text into revision-guide units. When real PDF page
 * offsets are available (see lib/pdf.ts), each unit is a real page — this is
 * what "page by page" means for a PDF. Otherwise (DOCX/TXT, or a material
 * ingested before pageOffsets existed) falls back to paragraph-aware
 * sections of roughly equal size, labeled "Section N" instead of "Page N" so
 * the guide never claims a page boundary it doesn't actually have.
 */
export function splitIntoPages(text: string, pageOffsets: number[] | null | undefined): { pages: TextPage[]; totalAvailable: number } {
  if (pageOffsets && pageOffsets.length > 1) {
    const bounded = [...pageOffsets, text.length];
    const pages: TextPage[] = [];
    for (let i = 0; i < bounded.length - 1; i++) {
      const slice = text.slice(bounded[i], bounded[i + 1]).trim();
      if (slice.length >= MIN_PAGE_CHARS) pages.push({ num: i + 1, label: `Page ${i + 1}`, text: slice });
    }
    if (pages.length > 0) return { pages: pages.slice(0, MAX_PAGES), totalAvailable: pages.length };
  }

  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const sections: string[] = [];
  let cur = '';
  for (const p of paragraphs) {
    if (cur && (cur + '\n\n' + p).length > SYNTHETIC_SECTION_CHARS) {
      sections.push(cur);
      cur = p;
    } else {
      cur = cur ? `${cur}\n\n${p}` : p;
    }
  }
  if (cur) sections.push(cur);

  const kept = sections.filter((s) => s.length >= MIN_PAGE_CHARS);
  const labeled = kept.map((s, i) => ({ num: i + 1, label: `Section ${i + 1}`, text: s }));
  return { pages: labeled.slice(0, MAX_PAGES), totalAvailable: labeled.length };
}

const SYSTEM_PROMPT = `You are an expert Nigerian university tutor who writes exam revision guides. You generate ONLY valid JSON — no markdown, no commentary, no code fences.

You receive ONE page of lecture material and must summarize ONLY that page for revision. Rules:
- Base everything strictly on the given text. NEVER invent facts, figures or names not present in it.
- "heading" is a short topic label for this page (under 8 words).
- "summary" is a tight revision paragraph (2-4 sentences) covering what a student must remember from this page.
- "keyPoints" is an array of 2-5 short, memorable bullet points (facts, definitions, formulas) drawn from the page.
- If the page has no substantive academic content (e.g. a cover page, table of contents, blank page), return {"heading":"","summary":"","keyPoints":[]}.
- Output JSON only: {"heading":"...","summary":"...","keyPoints":["...","..."]}`;

function buildUserPrompt(pageText: string): string {
  return `Page text:\n---\n${pageText}\n---\nSummarize this page for revision. Return JSON only.`;
}

interface RawGuideSection {
  heading?: unknown;
  summary?: unknown;
  keyPoints?: unknown;
}

interface GuideSection {
  heading: string;
  summary: string;
  keyPoints: string[];
}

/** Same repair strategy as lib/flashcard-gen.ts's extractFlashcardArray, adapted for a single {heading, summary, keyPoints} object per call. */
function extractGuideSection(raw: string): GuideSection | null {
  let cleaned = raw.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) cleaned = fence[1].trim();

  const tryParse = (s: string): RawGuideSection | null => {
    try {
      const v = JSON.parse(s);
      return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
    } catch {
      return null;
    }
  };

  let parsed = tryParse(cleaned);
  if (!parsed) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      const sliced = cleaned.slice(start, end + 1);
      parsed = tryParse(sliced) ?? tryParse(sliced.replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"').replace(/’/g, "'"));
    }
  }
  if (!parsed) return null;

  const heading = typeof parsed.heading === 'string' ? parsed.heading.trim() : '';
  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
  const keyPoints = Array.isArray(parsed.keyPoints)
    ? parsed.keyPoints.filter((p): p is string => typeof p === 'string' && p.trim().length > 0).map((p) => p.trim())
    : [];

  if (!summary && keyPoints.length === 0) return null;
  return { heading, summary, keyPoints };
}

function fallbackSection(pageText: string): GuideSection {
  const sentences = pageText.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 20);
  const summary = sentences.slice(0, 2).join(' ') || pageText.slice(0, 200).trim();
  const words = pageText.split(/\s+/).filter((w) => w.length >= 6 && /^[A-Za-z][A-Za-z-]+$/.test(w));
  const uniqueWords = Array.from(new Set(words)).slice(0, 5);
  const keyPoints = uniqueWords.length > 0 ? uniqueWords.map((w) => `Review the term "${w}"`) : sentences.slice(2, 5);
  return {
    heading: '',
    summary: summary || 'Add a Groq or NVIDIA API key in Settings for a real, generated revision guide.',
    keyPoints,
  };
}

async function callProvider(pageText: string, cfg: AiProviderConfig): Promise<GuideSection | null> {
  const content = await nvidiaChatCompletion({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
    model: cfg.model,
    label: cfg.provider === 'groq' ? 'Groq' : 'NVIDIA NIM',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(pageText) },
    ],
    temperature: 0.3,
    maxTokens: 700,
    timeoutMs: 30000,
    retries: 1,
  });
  return extractGuideSection(content);
}

/** Run async tasks with a concurrency cap without pulling in a dependency. */
async function runWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const pump = async () => {
    while (next < items.length) {
      const idx = next++;
      out[idx] = await worker(items[idx]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => pump()));
  return out;
}

export async function generateRevisionGuide(
  text: string,
  pageOffsets: number[] | null | undefined,
  provider?: AiProviderConfig
): Promise<{ pages: GeneratedGuidePage[]; usedFallback: boolean; totalPages: number; truncated: boolean }> {
  const { pages: textPages, totalAvailable } = splitIntoPages(text, pageOffsets);
  if (textPages.length === 0) {
    return { pages: [], usedFallback: true, totalPages: 0, truncated: false };
  }

  const cfg = provider ?? {
    provider: 'nvidia' as const,
    apiKey: (process.env.NVIDIA_API_KEY ?? '').trim(),
    baseURL: 'https://integrate.api.nvidia.com/v1',
    model: 'meta/llama-3.1-8b-instruct',
  };
  const key = cfg.apiKey.trim();

  let usedFallback = !key;
  const results = await runWithConcurrency(textPages, key ? 4 : textPages.length, async (page): Promise<GeneratedGuidePage | null> => {
    if (!key) return { ...page, ...fallbackSection(page.text) };
    try {
      const section = await callProvider(page.text, cfg);
      if (!section) return null;
      return { ...page, ...section };
    } catch (err: any) {
      console.error('Revision guide generation failed for a page, using fallback:', err?.message || err);
      usedFallback = true;
      return { ...page, ...fallbackSection(page.text) };
    }
  });

  const pages = results.filter((r): r is GeneratedGuidePage => r !== null);
  return { pages, usedFallback, totalPages: totalAvailable, truncated: totalAvailable > textPages.length };
}

export function assembleGuideMarkdown(pages: GeneratedGuidePage[]): string {
  return pages
    .map((p) => {
      const title = p.heading ? `${p.label} — ${p.heading}` : p.label;
      const bullets = p.keyPoints.map((k) => `- ${k}`).join('\n');
      return `## ${title}\n\n${p.summary}${bullets ? `\n\n${bullets}` : ''}`;
    })
    .join('\n\n---\n\n');
}
