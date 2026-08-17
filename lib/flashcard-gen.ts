import { nvidiaChatCompletion } from '@/lib/nvidia';
import type { AiProviderConfig } from '@/lib/ai';

export interface GeneratedFlashcard {
  front: string;
  back: string;
}

const SYSTEM_PROMPT = `You are an expert Nigerian university tutor who writes concise, accurate flashcards. You generate ONLY valid JSON — no markdown, no commentary, no code fences.

You receive lecture material and must write flashcards based ONLY on that material. Rules:
- Every fact on a card must come from the material. NEVER invent facts, definitions, figures or names that are not in the material.
- "front" is a short question, term, or prompt (under 20 words). "back" is the concise answer or definition (1-3 sentences, no filler).
- Cover distinct facts — never write two cards that test the same thing.
- Output a JSON array only, like: [{"front":"...","back":"..."}]`;

function buildUserPrompt(text: string, count: number): string {
  return `Lecture material:
---
${text}
---
Write ${count} flashcard(s) covering distinct key facts from the material above. Return a JSON array.`;
}

function looksLikeCard(v: any): boolean {
  return !!v && typeof v === 'object' && !Array.isArray(v) && typeof v.front === 'string' && 'back' in v;
}

/** Same extraction/repair strategy as lib/question-gen.ts's extractJsonArray — proven against
 *  this project's actual model responses (fenced blocks, bare-object collapse, trailing commas,
 *  smart quotes, truncation), just re-shaped for {front, back} instead of question objects. */
export function extractFlashcardArray(raw: string): GeneratedFlashcard[] {
  let cleaned = raw.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) cleaned = fence[1].trim();

  try {
    const direct = JSON.parse(cleaned);
    if (Array.isArray(direct)) return normalizeCards(direct);
    if (direct && Array.isArray(direct.cards)) return normalizeCards(direct.cards);
    if (direct && Array.isArray(direct.flashcards)) return normalizeCards(direct.flashcards);
    if (looksLikeCard(direct)) return normalizeCards([direct]);
  } catch {
    // fall through
  }

  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model response did not contain a JSON array');
  }
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    const repaired = cleaned
      .slice(start, end + 1)
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/[“”]/g, '"')
      .replace(/’/g, "'");
    try {
      parsed = JSON.parse(repaired);
    } catch {
      const partial = extractObjects(repaired);
      if (partial.length > 0) return partial;
      throw new Error('Model response contained invalid JSON');
    }
  }
  if (!Array.isArray(parsed)) {
    if (parsed && Array.isArray(parsed.cards)) return normalizeCards(parsed.cards);
    throw new Error('Expected a JSON array');
  }
  return normalizeCards(parsed);
}

function extractObjects(raw: string): GeneratedFlashcard[] {
  const findObjects = (s: string): string[] => {
    const objects: string[] = [];
    let depth = 0;
    let current = '';
    let inStr = false;
    for (let k = 0; k < s.length; k++) {
      const ch = s[k];
      if (ch === '"' && s[k - 1] !== '\\') inStr = !inStr;
      if (!inStr) {
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            objects.push(current + '}');
            current = '';
            continue;
          }
        }
      }
      if (depth > 0) current += ch;
    }
    return objects;
  };
  const out: GeneratedFlashcard[] = [];
  for (const obj of findObjects(raw)) {
    try {
      out.push(...normalizeCards([JSON.parse(obj)]));
    } catch {
      // skip malformed object
    }
  }
  return out;
}

function normalizeCards(items: any[]): GeneratedFlashcard[] {
  return items
    .filter((c: any) => c && typeof c.front === 'string' && typeof c.back === 'string' && c.front.trim() && c.back.trim())
    .map((c: any) => ({ front: String(c.front).trim(), back: String(c.back).trim() }));
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function dedupe(list: GeneratedFlashcard[]): GeneratedFlashcard[] {
  const seen = new Set<string>();
  const out: GeneratedFlashcard[] = [];
  for (const c of list) {
    const key = normalize(c.front);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function chunkText(text: string, chunkSize = 12000): string[] {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 0);
  const chunks: string[] = [];
  let cur = '';
  for (const s of sentences) {
    if (cur && (cur + ' ' + s).length > chunkSize) {
      chunks.push(cur);
      cur = s;
    } else {
      cur = cur ? `${cur} ${s}` : s;
    }
  }
  if (cur) chunks.push(cur);
  return chunks.filter((c) => c.length > 0);
}

async function callProvider(text: string, count: number, cfg: AiProviderConfig): Promise<GeneratedFlashcard[]> {
  const content = await nvidiaChatCompletion({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
    model: cfg.model,
    label: cfg.provider === 'groq' ? 'Groq' : 'NVIDIA NIM',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(text, count) },
    ],
    temperature: 0.4,
    maxTokens: Math.min(4000, count * 120 + 400),
    timeoutMs: 45000,
    retries: 1,
    // No responseFormat: json_object here either — see the identical note in
    // lib/question-gen.ts, same root cause (forces an object root, collapses
    // the requested array to a single bare card against this model).
  });
  return extractFlashcardArray(content);
}

/** Run async tasks with a concurrency cap without pulling in a dependency. */
async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<GeneratedFlashcard[]>): Promise<GeneratedFlashcard[][]> {
  const out = new Array<GeneratedFlashcard[]>(items.length);
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

async function generateFromProvider(text: string, count: number, cfg: AiProviderConfig): Promise<GeneratedFlashcard[]> {
  const perCall = 10;
  const numChunks = Math.max(1, Math.min(12, Math.ceil(count / perCall)));
  const chunks = numChunks > 1 ? chunkText(text, Math.ceil(text.length / numChunks)) : [text];

  const jobs: Array<{ chunk: string; ask: number }> = [];
  let need = count;
  for (let ci = 0; ci < chunks.length && need > 0; ci++) {
    const chunksLeft = chunks.length - ci;
    const ask = Math.min(Math.ceil(need / chunksLeft), perCall);
    if (ask <= 0) break;
    jobs.push({ chunk: chunks[ci], ask });
    need -= ask;
  }

  const results = await runWithConcurrency(jobs, Math.max(2, Math.min(16, jobs.length)), async (job) => {
    try {
      return await callProvider(job.chunk, job.ask, cfg);
    } catch (err: any) {
      console.error('Flashcard generation failed for a chunk:', err?.message || err);
      return [] as GeneratedFlashcard[];
    }
  });

  return dedupe(results.flat()).slice(0, count + Math.ceil(count * 0.2));
}

export function fallbackGenerate(text: string, count: number): GeneratedFlashcard[] {
  const sentences = text
    .split(/[.\n]+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 25 && s.length < 200 && /\w{4,}/.test(s));

  const words = text.split(/\s+/).filter((w) => w.length >= 6 && /^[A-Za-z][A-Za-z\-]+$/.test(w));
  const uniqueWords = Array.from(new Set(words));
  const keyword = (n: number) => (uniqueWords.length ? uniqueWords[Math.floor((uniqueWords.length * (n % 7)) / 8) % uniqueWords.length] : 'this concept');

  const cards: GeneratedFlashcard[] = [];
  for (let i = 0; i < count; i++) {
    const sentence = sentences.length ? sentences[i % sentences.length] : text.slice(0, 160);
    const kw = keyword(i + 1);
    cards.push({
      front: `What does the material say about "${kw}"?`,
      back: sentence || `${kw} is a key concept in this document — add a Groq or NVIDIA API key in Settings for real, generated flashcards.`,
    });
  }
  return cards;
}

export async function generateFlashcardsFromText(
  text: string,
  count = 10,
  provider?: AiProviderConfig
): Promise<{ cards: GeneratedFlashcard[]; usedFallback: boolean }> {
  const cfg = provider ?? {
    provider: 'nvidia',
    apiKey: (process.env.NVIDIA_API_KEY ?? '').trim(),
    baseURL: 'https://integrate.api.nvidia.com/v1',
    model: 'meta/llama-3.1-8b-instruct',
  };
  const key = cfg.apiKey.trim();

  if (!key) {
    return { cards: fallbackGenerate(text, count), usedFallback: true };
  }

  try {
    const cards = await generateFromProvider(text, count, cfg);
    if (cards.length === 0) {
      console.error('Flashcard generation returned empty; using demo fallback.');
      return { cards: fallbackGenerate(text, count), usedFallback: true };
    }
    return { cards, usedFallback: false };
  } catch (err: any) {
    console.error('Flashcard generation failed, using fallback:', err?.message || err);
    return { cards: fallbackGenerate(text, count), usedFallback: true };
  }
}
