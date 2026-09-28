export type QuestionFormat = 'MCQ' | 'TRUE_FALSE' | 'FILL_BLANK' | 'THEORY';

import { nvidiaChatCompletion } from '@/lib/nvidia';
import type { AiProviderConfig } from '@/lib/ai';

function providerLabel(cfg: AiProviderConfig): string {
  if (cfg.provider === 'gemini') return 'Gemini';
  return 'NVIDIA NIM';
}

function concurrencyFor(cfg: AiProviderConfig): number {
  if (cfg.provider === 'gemini') return 1;
  return 4;
}

function perCallFor(cfg: AiProviderConfig): number {
  return cfg.provider === 'gemini' ? 25 : 10;
}

function maxTokensFor(cfg: AiProviderConfig, count: number): number {
  const cap = cfg.provider === 'gemini' ? 12000 : 6000;
  return Math.min(cap, count * 220 + 600);
}

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

const SYSTEM_PROMPT = `You are a senior Nigerian university examiner setting a real end-of-semester / continuous-assessment paper. You write ONLY questions a lecturer would actually put on the exam from the given notes. Generate ONLY valid JSON — no markdown, no commentary, no code fences.

GOAL: Every question must be a LIKELY EXAM QUESTION — the kind students would see on a real paper for this course, not a random quiz from a sentence.

What counts as a likely exam question:
- Tests definitions, named laws/principles/theorems, processes and steps, classifications, comparisons, cause-and-effect, formulas, and clinical or applied facts that lecturers emphasise.
- Uses exam language: "Which of the following…", "The primary function of…", "X is characterised by…", "All of the following are true EXCEPT…", "Define / Explain / List / Distinguish between…"
- Stems are short and formal (one clear idea). No conversational or "from the passage above" wording.
- MCQ distractors are plausible and drawn from related ideas in the material (not silly or unrelated).
- Prefer concepts that appear with emphasis, repetition, lists, bold terms, or are central to the topic — skip introductions, transitions, and trivial asides.

Hard rules:
- Every fact in the question, answer and explanation MUST come from the material. NEVER invent facts, names, figures or definitions.
- MCQ: exactly 4 options, one correct. "answer" MUST be the full text of the correct option, copied EXACTLY from "options" — never a letter (A/B/C/D) or index.
- TRUE_FALSE: answer is exactly "True" or "False"; statement must be directly answerable from the material.
- FILL_BLANK: blank is "___" in the question; answer is the missing term/phrase from the material.
- THEORY: short model answer (2–4 sentences) grounded in the material, like a marking scheme.
- Always include a one-sentence explanation citing the material.
- "type" MUST be exactly one of: "MCQ", "TRUE_FALSE", "FILL_BLANK", "THEORY".
- Output a JSON array only, e.g. [{"type":"MCQ","question":"Which of the following nerves controls plantar flexion of the foot?","options":["Tibial nerve","Common peroneal nerve","Femoral nerve","Obturator nerve"],"answer":"Tibial nerve","explanation":"..."}]`;

function buildUserPrompt(text: string, formats: QuestionFormat[], countPerFormat: number): string {
  const list = formats.length ? formats.join(', ') : 'MCQ';
  return `Lecture material:\n---\n${text}\n---\nWrite ${countPerFormat} LIKELY EXAM question(s) for each format: ${list}.\nWrite questions a Nigerian university lecturer would put on a real CA or semester exam from this material — not random sentence quizzes.\nBase every question ONLY on the material above. Return a JSON array.`;
}

export interface ExamTopic {
  concept: string;
  context: string;
}

const ANALYSIS_SYSTEM_PROMPT = `You are a senior Nigerian university examiner preparing an exam paper from lecture notes. You generate ONLY valid JSON — no markdown, no commentary, no code fences.

Extract ONLY concepts that are LIKELY TO APPEAR ON A REAL EXAM — the points a lecturer would test in CA or finals:
- Key definitions and technical terms
- Named laws, principles, theorems, theories
- Steps of processes and procedures
- Classifications and types
- Comparisons and distinctions ("X vs Y")
- Cause-and-effect and mechanisms
- Important numbers, formulas, or criteria

SKIP: chapter intros, "in this lecture we will…", transitions, examples that are only illustrative, and anything a student would not be asked in a real paper.

Output a JSON array:
[{"concept": "short exam-ready name", "context": "exact sentence(s) from the material, copied verbatim"}]

Return 3–20 concepts ranked by how likely they are to be examined. Never invent content not in the text.`;

function buildAnalysisPrompt(text: string, targetCount: number): string {
  return `Lecture material:\n---\n${text}\n---\nIdentify up to ${targetCount} of the most exam-likely concepts from this material. Return a JSON array.`;
}

function looksLikeTopic(v: any): boolean {
  return !!v && typeof v === 'object' && !Array.isArray(v) && typeof v.concept === 'string' && typeof v.context === 'string';
}

function extractTopics(raw: string): ExamTopic[] {
  let cleaned = raw.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) cleaned = fence[1].trim();
  try {
    const direct = JSON.parse(cleaned);
    if (Array.isArray(direct)) return direct.filter(looksLikeTopic);
    if (direct && Array.isArray(direct.topics)) return direct.topics.filter(looksLikeTopic);
  } catch {}
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(
      cleaned.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1').replace(/[\u201C\u201D]/g, '"').replace(/\u2019/g, "'")
    );
    return Array.isArray(parsed) ? parsed.filter(looksLikeTopic) : [];
  } catch {
    return [];
  }
}

async function analyzeChunk(text: string, targetCount: number, cfg: AiProviderConfig, retries = 2): Promise<ExamTopic[]> {
  try {
    const content = await nvidiaChatCompletion({
      apiKey: cfg.apiKey,
      baseURL: cfg.baseURL,
      model: cfg.model,
      label: providerLabel(cfg),
      messages: [
        { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
        { role: 'user', content: buildAnalysisPrompt(text, targetCount) },
      ],
      temperature: 0.3,
      maxTokens: Math.min(3000, targetCount * 140 + 400),
      timeoutMs: 30000,
      retries,
      reasoningEffort: cfg.provider === 'gemini' ? 'none' : undefined,
    });
    return extractTopics(content);
  } catch (err: any) {
    console.error('Document analysis failed for a chunk:', err?.message || err);
    return [];
  }
}

function dedupeTopics(topics: ExamTopic[]): ExamTopic[] {
  const seen = new Set<string>();
  const out: ExamTopic[] = [];
  for (const t of topics) {
    const key = normalize(t.concept);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function truncateContext(s: string, max = 400): string {
  return s.length > max ? s.slice(0, max).trimEnd() + '…' : s;
}

function buildUserPromptFromTopics(topics: ExamTopic[], format: QuestionFormat, count: number): string {
  const list = topics.map((t, i) => `${i + 1}. ${t.concept} — context: "${truncateContext(t.context)}"`).join('\n');
  return `These are the most exam-likely concepts from the lecture material (most important first):\n${list}\n\nWrite ${count} ${FORMAT_LABELS[format]} question(s) that could appear on a real Nigerian university exam.\nEach question must target a DIFFERENT concept from the list (cycle if needed, but change the angle).\nUse formal exam wording. For MCQ, make distractors plausible from related ideas in the contexts.\nUse ONLY the "context" text for each concept; never invent facts.\nReturn a JSON array of question objects (type "${format}").`;
}

function looksLikeQuestion(v: any): boolean {
  return !!v && typeof v === 'object' && !Array.isArray(v) && typeof v.question === 'string' && 'answer' in v;
}

export function extractJsonArray(raw: string): GeneratedQuestion[] {
  let cleaned = raw.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) cleaned = fence[1].trim();
  try {
    const direct = JSON.parse(cleaned);
    if (Array.isArray(direct)) return normalizeQuestions(direct);
    if (direct && Array.isArray(direct.questions)) return normalizeQuestions(direct.questions);
    if (looksLikeQuestion(direct)) return normalizeQuestions([direct]);
  } catch {}
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model response did not contain a JSON array');
  }
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    const repaired = cleaned.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1').replace(/[\u201C\u201D]/g, '"').replace(/\u2019/g, "'");
    try {
      parsed = JSON.parse(repaired);
    } catch {
      const partial = extractObjects(repaired);
      if (partial.length > 0) return partial;
      throw new Error('Model response contained invalid JSON');
    }
  }
  if (!Array.isArray(parsed)) {
    if (parsed && Array.isArray(parsed.questions)) return normalizeQuestions(parsed.questions);
    throw new Error('Expected a JSON array');
  }
  return normalizeQuestions(parsed);
}

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
    } catch {}
  }
  return out;
}

const FORMAT_ALIASES: Record<string, QuestionFormat> = {
  mcq: 'MCQ', multiplechoice: 'MCQ', multiple_choice: 'MCQ', choice: 'MCQ',
  true_false: 'TRUE_FALSE', truefalse: 'TRUE_FALSE', 'true/false': 'TRUE_FALSE', boolean: 'TRUE_FALSE',
  fill_blank: 'FILL_BLANK', fillblank: 'FILL_BLANK', fill_in_the_blank: 'FILL_BLANK', gapfill: 'FILL_BLANK',
  theory: 'THEORY', essay: 'THEORY', theory_essay: 'THEORY', shortanswer: 'THEORY',
};

function normalizeFormatType(raw: unknown): QuestionFormat {
  if (typeof raw !== 'string') return 'MCQ';
  const key = raw.toLowerCase().replace(/[^\w\s/]/g, '').replace(/\s+/g, '');
  const direct = raw.trim();
  if (['MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'THEORY'].includes(direct)) return direct as QuestionFormat;
  return FORMAT_ALIASES[key] || 'MCQ';
}

const FALSE_WORDS = new Set(['false', 'f', 'no', 'n', 'incorrect']);

function truthyLabel(answer: string): string {
  const n = answer.trim().toLowerCase();
  return FALSE_WORDS.has(n) ? 'False' : 'True';
}

function resolveMcqAnswer(answer: string, options: string[]): string | null {
  const trimmed = answer.trim();
  if (options.some((o) => o.trim().toLowerCase() === trimmed.toLowerCase())) return trimmed;
  const letterMatch = trimmed.match(/^\(?option\)?\s*([a-d])\)?\.?$/i) || trimmed.match(/^([a-d])[).]?$/i);
  if (letterMatch) {
    const idx = letterMatch[1]!.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
    if (options[idx]) return options[idx]!;
  }
  const numberMatch = trimmed.match(/^\(?option\)?\s*([1-4])\)?\.?$/i) || trimmed.match(/^([1-4])[).]?$/);
  if (numberMatch) {
    const idx = Number(numberMatch[1]) - 1;
    if (options[idx]) return options[idx]!;
  }
  return null;
}

function normalizeQuestions(items: any[]): GeneratedQuestion[] {
  return items
    .filter((q: any) => q && typeof q.question === 'string' && typeof q.answer === 'string')
    .map((q: any) => {
      const type = normalizeFormatType(q.type);
      let options = Array.isArray(q.options) ? q.options.map(String) : null;
      let answer = String(q.answer);
      if (type === 'MCQ' && options && options.length >= 2) {
        const resolved = resolveMcqAnswer(answer, options);
        if (resolved === null) return null;
        answer = resolved;
      }
      if (type === 'TRUE_FALSE') {
        options = ['True', 'False'];
        answer = truthyLabel(answer);
      }
      return {
        type,
        question: String(q.question),
        options,
        answer,
        explanation: q.explanation ? String(q.explanation) : '',
      };
    })
    .filter((q): q is GeneratedQuestion => q !== null);
}

export function isDemoMode(apiKey?: string): boolean {
  const key = apiKey ?? process.env.NVIDIA_API_KEY;
  return !key || key.trim().length === 0;
}

export async function generateQuestionsFromText(
  text: string,
  formats: QuestionFormat[],
  countPerFormat = 2,
  provider?: AiProviderConfig | AiProviderConfig[]
): Promise<{ questions: GeneratedQuestion[]; usedFallback: boolean }> {
  const defaultCfg: AiProviderConfig = {
    provider: 'nvidia',
    apiKey: (process.env.NVIDIA_API_KEY ?? '').trim(),
    baseURL: 'https://integrate.api.nvidia.com/v1',
    model: 'meta/llama-3.1-8b-instruct',
  };
  const candidates = (Array.isArray(provider) ? provider : provider ? [provider] : [defaultCfg]).filter(
    (c) => c.apiKey.trim().length > 0
  );
  const targets = formats.length ? formats : (['MCQ'] as QuestionFormat[]);

  if (candidates.length === 0) {
    return { questions: fallbackGenerate(text, targets, countPerFormat), usedFallback: true };
  }

  for (let i = 0; i < candidates.length; i++) {
    const cfg = candidates[i];
    const retries = i === candidates.length - 1 ? 2 : 0;
    try {
      const questions = await generateFromProvider(text, targets, countPerFormat, cfg, retries);
      if (questions.length > 0) return { questions, usedFallback: false };
      console.error(`Question generation returned empty from ${cfg.provider}.`);
    } catch (err: any) {
      console.error(`Question generation failed on ${cfg.provider}:`, err?.message || err);
    }
  }

  console.error('Question generation exhausted all providers; using demo fallback.');
  return { questions: fallbackGenerate(text, targets, countPerFormat), usedFallback: true };
}

function chunkText(text: string, chunkSize = 6000): string[] {
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

async function callProviderRaw(text: string, formats: QuestionFormat[], count: number, cfg: AiProviderConfig, retries = 2): Promise<GeneratedQuestion[]> {
  const content = await nvidiaChatCompletion({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
    model: cfg.model,
    label: providerLabel(cfg),
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(text, formats, count) },
    ],
    temperature: 0.35,
    maxTokens: maxTokensFor(cfg, count),
    timeoutMs: 45000,
    retries,
    reasoningEffort: cfg.provider === 'gemini' ? 'none' : undefined,
  });
  return extractJsonArray(content);
}

async function callProviderWithTopics(topics: ExamTopic[], format: QuestionFormat, count: number, cfg: AiProviderConfig, retries = 2): Promise<GeneratedQuestion[]> {
  const content = await nvidiaChatCompletion({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
    model: cfg.model,
    label: providerLabel(cfg),
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPromptFromTopics(topics, format, count) },
    ],
    temperature: 0.35,
    maxTokens: maxTokensFor(cfg, count),
    timeoutMs: 45000,
    retries,
    reasoningEffort: cfg.provider === 'gemini' ? 'none' : undefined,
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

async function generateFromProvider(text: string, formats: QuestionFormat[], countPerFormat: number, cfg: AiProviderConfig, retries = 2): Promise<GeneratedQuestion[]> {
  const perCall = perCallFor(cfg);
  const numChunks = Math.max(1, Math.min(12, Math.ceil(countPerFormat / perCall)));
  const chunks = numChunks > 1 ? chunkText(text, Math.ceil(text.length / numChunks)) : [text];

  // Stage 1: analyze every chunk for exam-likely concepts
  const topicsPerChunk = Math.max(3, Math.ceil((countPerFormat * 1.4) / chunks.length));
  const analyzed = await runWithConcurrency(chunks, Math.max(1, Math.min(concurrencyFor(cfg), chunks.length)), (chunk) =>
    analyzeChunk(chunk, topicsPerChunk, cfg, retries)
  );
  const topics = dedupeTopics(analyzed.flat());

  if (topics.length === 0) {
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
    const results = await runWithConcurrency(jobs, Math.max(1, Math.min(concurrencyFor(cfg), jobs.length)), async (job) => {
      try {
        return await callProviderRaw(job.chunk, [job.fmt], job.ask, cfg, retries);
      } catch (err: any) {
        console.error(`Generation failed for ${job.fmt}:`, err?.message || err);
        return [] as GeneratedQuestion[];
      }
    });
    return dedupe(results.flat()).slice(0, countPerFormat * formats.length + Math.ceil(countPerFormat * 0.2));
  }

  // Stage 2: write questions against identified topics
  const jobs: Array<{ fmt: QuestionFormat; ask: number; topicSlice: ExamTopic[] }> = [];
  for (const fmt of formats) {
    let need = countPerFormat;
    let offset = 0;
    while (need > 0) {
      const ask = Math.min(need, perCall);
      const topicSlice = Array.from({ length: Math.min(topics.length, Math.max(ask, 5)) }, (_, i) => topics[(offset + i) % topics.length]);
      jobs.push({ fmt, ask, topicSlice });
      need -= ask;
      offset += ask;
    }
  }

  const results = await runWithConcurrency(jobs, Math.max(1, Math.min(concurrencyFor(cfg), jobs.length)), async (job) => {
    try {
      return await callProviderWithTopics(job.topicSlice, job.fmt, job.ask, cfg, retries);
    } catch (err: any) {
      console.error(`Generation failed for ${job.fmt}:`, err?.message || err);
      return [] as GeneratedQuestion[];
    }
  });

  const unique = dedupe(results.flat());
  return unique.slice(0, countPerFormat * formats.length + Math.ceil(countPerFormat * 0.2));
}

async function runWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R[]>): Promise<R[][]> {
  const out = new Array<R[]>(items.length);
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
          options: ['True', 'False'],
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
          explanation: 'Full answer depends on the AI tutor — this is a demo question (no NVIDIA API key set).',
        });
      }
    }
  }
  return questions;
}
