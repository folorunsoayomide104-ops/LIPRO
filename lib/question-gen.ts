export type QuestionFormat = 'MCQ' | 'TRUE_FALSE' | 'FILL_BLANK' | 'THEORY';

import { nvidiaChatCompletion } from '@/lib/nvidia';
import type { AiProviderConfig } from '@/lib/ai';

export const FORMAT_LABELS: Record<QuestionFormat, string> = {
  MCQ: 'Multiple Choice',
  TRUE_FALSE: 'True / False',
  FILL_BLANK: 'Fill in the Blank',
  THEORY: 'Theory / Essay',
};

export interface GeneratedQuestion {
  type: QuestionFormat;
  question: string;
  options: string[] | null;
  answer: string;
  explanation: string;
}

const SYSTEM_PROMPT = `You are an expert Nigerian university examiner who writes high-quality, accurate CBT questions. You generate ONLY valid JSON — no markdown, no commentary, no code fences.

You receive lecture notes and must write questions based ONLY on the material given. Rules:
- Every fact in a question, answer and explanation must come from the material. NEVER invent facts, definitions, figures or names that are not in the material.
- Keep questions concise and exam-realistic for Nigerian universities.
- MCQ: exactly 4 options with one correct answer. The correct answer must be verifiable from the material.
- TRUE_FALSE: the answer is exactly "True" or "False", and the statement must be directly answerable from the material.
- FILL_BLANK: the missing word/phrase goes in the answer, and the blank appears as "___" in the question.
- THEORY: the answer is a short model answer (2-4 sentences) grounded in the material.
- Always include a one-sentence explanation citing the material.
- The "type" field MUST be exactly one of these uppercase tokens: "MCQ", "TRUE_FALSE", "FILL_BLANK", "THEORY". Never use any other value (not "Multiple Choice", not "true/False", not "Essay").
- Output a JSON array only, like: [{"type":"MCQ","question":"...","options":["A","B","C","D"],"answer":"A","explanation":"..."}]`;

function buildUserPrompt(text: string, formats: QuestionFormat[], countPerFormat: number): string {
  const list = formats.length ? formats.join(', ') : 'MCQ';
  return `Lecture material:
---
${text}
---
Write ${countPerFormat} accurate question(s) for each of these formats: ${list}.
Base every question ONLY on the material above. Return a JSON array.`;
}

export function extractJsonArray(raw: string): GeneratedQuestion[] {
  let cleaned = raw.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) cleaned = fence[1].trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model response did not contain a JSON array');
  }
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    // Model occasionally emits trailing commas, smart quotes, or truncates the
    // array. Repair what we can and fall back to object-by-object extraction
    // so a single malformed item doesn't discard the whole batch.
    const repaired = cleaned
      .slice(start, end + 1)
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\u2019/g, "'");
    try {
      parsed = JSON.parse(repaired);
    } catch {
      const partial = extractObjects(repaired);
      if (partial.length > 0) return partial;
      throw new Error('Model response contained invalid JSON');
    }
  }
  if (!Array.isArray(parsed)) throw new Error('Expected a JSON array');
  return normalizeQuestions(parsed);
}

/** Best-effort: pull complete {…} objects out of an unparseable response. */
function extractObjects(raw: string): GeneratedQuestion[] {
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
  const out: GeneratedQuestion[] = [];
  for (const obj of findObjects(raw)) {
    try {
      out.push(...normalizeQuestions([JSON.parse(obj)]));
    } catch {
      // skip malformed object
    }
  }
  return out;
}

const FORMAT_ALIASES: Record<string, QuestionFormat> = {
  mcq: 'MCQ',
  multiplechoice: 'MCQ',
  multiple_choice: 'MCQ',
  multiplechoicequestion: 'MCQ',
  multiplechoicequestions: 'MCQ',
  choice: 'MCQ',
  'true_false': 'TRUE_FALSE',
  truefalse: 'TRUE_FALSE',
  true_false_question: 'TRUE_FALSE',
  truefalsequestion: 'TRUE_FALSE',
  'true_or_false': 'TRUE_FALSE',
  'true/false': 'TRUE_FALSE',
  boolean: 'TRUE_FALSE',
  fill_blank: 'FILL_BLANK',
  fillblank: 'FILL_BLANK',
  fill_in_blank: 'FILL_BLANK',
  fillintheblank: 'FILL_BLANK',
  fill_in_the_blank: 'FILL_BLANK',
  gapfill: 'FILL_BLANK',
  gap_fill: 'FILL_BLANK',
  fillintheblanks: 'FILL_BLANK',
  'fill-in-the-blank': 'FILL_BLANK',
  theory: 'THEORY',
  theoryessay: 'THEORY',
  essay: 'THEORY',
  essaytheory: 'THEORY',
  theory_essay: 'THEORY',
  shortanswer: 'THEORY',
  short_answer: 'THEORY',
  'theory/essay': 'THEORY',
  'theory / essay': 'THEORY',
};

function normalizeFormatType(raw: unknown): QuestionFormat {
  if (typeof raw !== 'string') return 'MCQ';
  const key = raw
    .toLowerCase()
    .replace(/[^\w\s/]/g, '')
    .replace(/\s+/g, '');
  const direct = raw.trim();
  if (['MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'THEORY'].includes(direct)) return direct as QuestionFormat;
  return FORMAT_ALIASES[key] || 'MCQ';
}

function normalizeQuestions(items: any[]): GeneratedQuestion[] {
  return items
    .filter((q: any) => q && typeof q.question === 'string' && typeof q.answer === 'string')
    .map((q: any) => ({
      type: normalizeFormatType(q.type),
      question: String(q.question),
      options: Array.isArray(q.options) ? q.options.map(String) : null,
      answer: String(q.answer),
      explanation: q.explanation ? String(q.explanation) : '',
    }));
}

export function isDemoMode(apiKey?: string, groqApiKey?: string): boolean {
  const key = apiKey ?? process.env.NVIDIA_API_KEY;
  const gkey = groqApiKey ?? process.env.GROQ_API_KEY;
  return (!key || key.trim().length === 0) && (!gkey || gkey.trim().length === 0);
}

export async function generateQuestionsFromText(
  text: string,
  formats: QuestionFormat[],
  countPerFormat = 2,
  provider?: AiProviderConfig
): Promise<{ questions: GeneratedQuestion[]; usedFallback: boolean }> {
  const cfg = provider ?? {
    provider: 'nvidia',
    apiKey: (process.env.NVIDIA_API_KEY ?? '').trim(),
    baseURL: 'https://integrate.api.nvidia.com/v1',
    model: 'meta/llama-3.1-8b-instruct',
  };
  const key = cfg.apiKey.trim();
  const targets = formats.length ? formats : (['MCQ'] as QuestionFormat[]);

  if (!key) {
    return { questions: fallbackGenerate(text, targets, countPerFormat), usedFallback: true };
  }

  try {
    const questions = await generateFromProvider(text, targets, countPerFormat, cfg);
    if (questions.length === 0) {
      // Provider succeeded but produced nothing usable — fall back so the user
      // always gets a usable set instead of a hard error.
      console.error('Question generation returned empty; using demo fallback.');
      return { questions: fallbackGenerate(text, targets, countPerFormat), usedFallback: true };
    }
    return { questions, usedFallback: false };
  } catch (err: any) {
    console.error('Question generation failed, using fallback:', err?.message || err);
    return { questions: fallbackGenerate(text, targets, countPerFormat), usedFallback: true };
  }
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

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

async function callProvider(text: string, formats: QuestionFormat[], count: number, cfg: AiProviderConfig): Promise<GeneratedQuestion[]> {
  const content = await nvidiaChatCompletion({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
    model: cfg.model,
    label: cfg.provider === 'groq' ? 'Groq' : 'NVIDIA NIM',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(text, formats, count) },
    ],
    temperature: 0.4,
    maxTokens: Math.min(6000, count * 220 + 600),
    timeoutMs: 45000,
    retries: 1,
  });
  return extractJsonArray(content);
}

function dedupe(list: GeneratedQuestion[]): GeneratedQuestion[] {
  const seen = new Set<string>();
  const out: GeneratedQuestion[] = [];
  for (const q of list) {
    const key = normalize(`${q.type}::${q.question}`);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

async function generateFromProvider(text: string, formats: QuestionFormat[], countPerFormat: number, cfg: AiProviderConfig): Promise<GeneratedQuestion[]> {
  // Run all (format × chunk) asks in parallel so we can generate large counts
  // (e.g. 100) far more quickly than sequential chunk settling allowed.
  const perCall = 10;
  const numChunks = Math.max(1, Math.min(12, Math.ceil(countPerFormat / perCall)));
  const chunks = numChunks > 1 ? chunkText(text, Math.ceil(text.length / numChunks)) : [text];

  const jobs: Array<{ chunk: string; fmt: QuestionFormat; ask: number }> = [];
  for (const fmt of formats) {
    let need = countPerFormat;
    for (let ci = 0; ci < chunks.length && need > 0; ci++) {
      const chunksLeft = chunks.length - ci;
      const ask = Math.min(Math.ceil(need / chunksLeft), perCall);
      if (ask <= 0) break;
      jobs.push({ chunk: chunks[ci], fmt, ask });
      need -= ask;
    }
  }

  const results = await runWithConcurrency(jobs, Math.max(2, Math.min(16, jobs.length)), async (job) => {
    try {
      return await callProvider(job.chunk, [job.fmt], job.ask, cfg);
    } catch (err: any) {
      console.error(`Generation failed for ${job.fmt}:`, err?.message || err);
      return [] as GeneratedQuestion[];
    }
  });

  const unique = dedupe(results.flat());
  return unique.slice(0, countPerFormat * formats.length + Math.ceil(countPerFormat * 0.2));
}

/** Run async tasks with a concurrency cap without pulling in a dependency. */
async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<GeneratedQuestion[]>): Promise<GeneratedQuestion[][]> {
  const out = new Array<GeneratedQuestion[]>(items.length);
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

export function fallbackGenerate(text: string, formats: QuestionFormat[], countPerFormat: number): GeneratedQuestion[] {
  const sentences = text
    .split(/[.\n]+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 25 && s.length < 200 && /\w{4,}/.test(s));

  const words = text.split(/\s+/).filter((w) => w.length >= 6 && /^[A-Za-z][A-Za-z\-]+$/.test(w));
  const uniqueWords = Array.from(new Set(words));
  const keyword = (n: number) => (uniqueWords.length ? uniqueWords[Math.floor((uniqueWords.length * (n % 7)) / 8) % uniqueWords.length] : 'concept');

  const questions: GeneratedQuestion[] = [];
  const targets = formats.length ? formats : (['MCQ'] as QuestionFormat[]);
  for (const type of targets) {
    for (let i = 0; i < countPerFormat; i++) {
      const sentence = sentences.length ? sentences[(i * targets.length + targets.indexOf(type)) % sentences.length] : text.slice(0, 120);
      const kw = keyword(i + targets.indexOf(type) + 1);
      if (type === 'MCQ') {
        questions.push({
          type,
          question: `${sentence} — What does this passage primarily describe?`,
          options: [kw, 'An unrelated definition', 'A historical footnote', 'A grammatical point'],
          answer: kw,
          explanation: `The passage focuses on "${kw}".`,
        });
      } else if (type === 'TRUE_FALSE') {
        questions.push({
          type,
          question: `${sentence}`,
          options: null,
          answer: 'True',
          explanation: 'This statement is drawn directly from the uploaded material.',
        });
      } else if (type === 'FILL_BLANK') {
        const idx = sentence.toLowerCase().indexOf(kw.toLowerCase());
        const filled = idx !== -1 ? `${sentence.slice(0, idx)}___${sentence.slice(idx + kw.length)}` : `${sentence} The key term is "___".`;
        questions.push({
          type,
          question: filled,
          options: null,
          answer: kw,
          explanation: `The term "${kw}" completes the sentence based on the material.`,
        });
      } else {
        questions.push({
          type,
          question: `Explain the role of "${kw}" as discussed in this material.`,
          options: null,
          answer: `"${kw}" is a key concept covered in this document. Base your answer on the uploaded material and give a concrete example.`,
          explanation: 'Full answer depends on the AI tutor — this is a demo question (no Groq or NVIDIA API key set).',
        });
      }
    }
  }
  return questions;
}
