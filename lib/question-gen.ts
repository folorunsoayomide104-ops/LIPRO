export type QuestionFormat = 'MCQ' | 'TRUE_FALSE' | 'FILL_BLANK' | 'THEORY';

import { nvidiaChatCompletion } from '@/lib/nvidia';
import type { AiProviderConfig } from '@/lib/ai';

function providerLabel(cfg: AiProviderConfig): string {
  if (cfg.provider === 'groq') return 'Groq';
  if (cfg.provider === 'gemini') return 'Gemini';
  return 'NVIDIA NIM';
}

// Confirmed directly against production, then against a live rate-limit
// probe: Groq's actual constraint is a tight shared token-per-minute budget
// (8000 TPM on the model in use), not a per-request count a little
// concurrency comfortably fits under. Firing calls in parallel against a
// shared token budget just means every parallel job exhausts it and gets
// 429'd at the same moment — concurrency provides no real throughput there,
// only simultaneous failure. Serialized to 1 so each call completes (or
// backs off using the provider's own reported reset time — see
// lib/nvidia.ts's backoffMs) before the next one spends from the same
// budget.
//
// NVIDIA has no equivalent shared-budget constraint, and generateQuestionsFromText
// falls through to it whenever Groq is exhausted — running NVIDIA's own
// two-stage pipeline at concurrency 1 too meant a large document (20-30+
// chunks) could easily exceed the route's 280s budget even when NVIDIA
// itself was working fine, silently landing on demo-content fallback.
// Confirmed directly against production: a 20-page document's chunk
// analysis alone ran past 280s serialized. Concurrency 4 for NVIDIA cuts
// that by roughly 4x with no observed rate-limit errors.
function concurrencyFor(cfg: AiProviderConfig): number {
  return cfg.provider === 'groq' ? 1 : 4;
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

const SYSTEM_PROMPT = `You are an expert Nigerian university examiner who writes high-quality, accurate CBT questions. You generate ONLY valid JSON — no markdown, no commentary, no code fences.

You receive lecture notes and must write questions based ONLY on the material given. Rules:
- Every fact in a question, answer and explanation must come from the material. NEVER invent facts, definitions, figures or names that are not in the material.
- Keep questions concise and exam-realistic for Nigerian universities.
- MCQ: exactly 4 options with one correct answer. The correct answer must be verifiable from the material.
- MCQ "answer" MUST be the full text of the correct option, copied EXACTLY character-for-character from that entry in "options" — never a letter like "A"/"B"/"C"/"D" and never an index. The grader matches "answer" against "options" by exact text; a letter will never match and the question becomes ungradeable.
- TRUE_FALSE: the answer is exactly "True" or "False", and the statement must be directly answerable from the material.
- FILL_BLANK: the missing word/phrase goes in the answer, and the blank appears as "___" in the question.
- THEORY: the answer is a short model answer (2-4 sentences) grounded in the material.
- Always include a one-sentence explanation citing the material.
- The "type" field MUST be exactly one of these uppercase tokens: "MCQ", "TRUE_FALSE", "FILL_BLANK", "THEORY". Never use any other value (not "Multiple Choice", not "true/False", not "Essay").
- Output a JSON array only, like: [{"type":"MCQ","question":"Which nerve controls plantar flexion?","options":["Tibial nerve","Peroneal nerve","Femoral nerve","Radial nerve"],"answer":"Tibial nerve","explanation":"..."}]`;

function buildUserPrompt(text: string, formats: QuestionFormat[], countPerFormat: number): string {
  const list = formats.length ? formats.join(', ') : 'MCQ';
  return `Lecture material:
---
${text}
---
Write ${countPerFormat} accurate question(s) for each of these formats: ${list}.
Base every question ONLY on the material above. Return a JSON array.`;
}

/* ------------------------------------------------------------------ *
 * Document analysis — identify what's actually exam-worthy before
 * writing any questions, instead of extracting mechanically from
 * whatever text happens to fall in a given chunk. This is the
 * difference between "a random question generator" and something that
 * targets the concepts a real lecturer would test.
 * ------------------------------------------------------------------ */

export interface ExamTopic {
  concept: string;
  context: string;
}

const ANALYSIS_SYSTEM_PROMPT = `You are an expert Nigerian university examiner reviewing lecture material before setting an exam. You generate ONLY valid JSON — no markdown, no commentary, no code fences.

Identify the concepts in this material that a lecturer is MOST LIKELY to test: key definitions, named principles/laws/theorems, processes and their steps, classifications, comparisons, cause-and-effect relationships, and important numerical facts or formulas. Prioritize specific, testable content over trivial or incidental sentences (do not pick things like introductions, transitions, or "in this chapter we will discuss...").

Output a JSON array of objects, each shaped like:
[{"concept": "short name of the testable idea", "context": "the exact sentence(s) from the material this is based on, copied verbatim"}]

Return between 3 and 20 concepts depending on how much genuinely testable material is present. Never invent a concept that isn't actually in the text.`;

function buildAnalysisPrompt(text: string, targetCount: number): string {
  return `Lecture material:
---
${text}
---
Identify up to ${targetCount} of the most exam-likely concepts from this material. Return a JSON array.`;
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
  } catch {
    // fall through to bracket-slicing below
  }
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(
      cleaned
        .slice(start, end + 1)
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/[“”]/g, '"')
        .replace(/’/g, "'")
    );
    return Array.isArray(parsed) ? parsed.filter(looksLikeTopic) : [];
  } catch {
    return [];
  }
}

/** One analysis call per chunk — cheap/fast relative to full question authoring. */
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

/** Model-supplied "context" is meant to be a sentence or two, but nothing stops a
 *  verbose response from copying a much longer excerpt — cap it so a batch of
 *  topics can never balloon a single request past a provider's payload limit
 *  (confirmed directly against production: Groq 413 on an oversized request). */
function truncateContext(s: string, max = 400): string {
  return s.length > max ? s.slice(0, max).trimEnd() + '…' : s;
}

function buildUserPromptFromTopics(topics: ExamTopic[], format: QuestionFormat, count: number): string {
  const list = topics.map((t, i) => `${i + 1}. ${t.concept} — context: "${truncateContext(t.context)}"`).join('\n');
  return `Exam-relevant concepts already identified from the material, in order of importance:
${list}

Write ${count} ${FORMAT_LABELS[format]} question(s). Each question must be based on a DIFFERENT concept from the list above — cycle back to the start of the list if you need more questions than there are concepts, but vary the angle each time so repeats aren't identical. Use ONLY the "context" text given for each concept; never invent facts beyond it. Return a JSON array of question objects (type "${format}").`;
}

/** True for an object shaped like one question (as opposed to e.g. `{"options":[...]}`). */
function looksLikeQuestion(v: any): boolean {
  return !!v && typeof v === 'object' && !Array.isArray(v) && typeof v.question === 'string' && 'answer' in v;
}

export function extractJsonArray(raw: string): GeneratedQuestion[] {
  let cleaned = raw.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) cleaned = fence[1].trim();

  // Try parsing the response as-is before any bracket-slicing heuristics.
  // This matters because slicing from the first "[" to the last "]" is wrong
  // whenever the model returns a single bare object that merely *contains* a
  // nested array (e.g. an MCQ's "options" field) instead of the requested
  // top-level array — that slice parses "successfully" as just the options
  // list, which then silently produces zero valid questions with no error.
  try {
    const direct = JSON.parse(cleaned);
    if (Array.isArray(direct)) return normalizeQuestions(direct);
    if (direct && Array.isArray(direct.questions)) return normalizeQuestions(direct.questions);
    if (looksLikeQuestion(direct)) return normalizeQuestions([direct]);
  } catch {
    // Not directly parseable (fenced/truncated/decorated) — fall through.
  }

  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    // No top-level array. Some models wrap the list in an object, e.g.
    // {"questions": [...]}. Pull the array out before giving up.
    const arrStart = cleaned.indexOf('[');
    const arrEnd = cleaned.lastIndexOf(']');
    if (arrStart !== -1 && arrEnd > arrStart) {
      try {
        return normalizeQuestions(JSON.parse(cleaned.slice(arrStart, arrEnd + 1)));
      } catch {
        // fall through to extraction below
      }
    }
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
  if (!Array.isArray(parsed)) {
    // {"questions": [...]} style wrapper.
    if (parsed && Array.isArray(parsed.questions)) {
      return normalizeQuestions(parsed.questions);
    }
    throw new Error('Expected a JSON array');
  }
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

/**
 * Safety net for MCQ answers, independent of the prompt instructing the
 * model to return full option text. Confirmed against real production
 * data that models still sometimes ignore that instruction and return a
 * bare option letter/index instead ("A", "B", "1", "2", "Option A") — the
 * grader (lib/cbt/grading.ts) matches "answer" against "options" by exact
 * text, so a letter never matches any option and the question becomes
 * permanently ungradeable: every response, including the objectively
 * correct one, is marked wrong. Resolves that letter back to the option
 * it actually refers to; returns null if it can't be resolved at all
 * (an unresolvable MCQ is dropped rather than shipped ungradeable).
 */
const FALSE_WORDS = new Set(['false', 'f', 'no', 'n', 'incorrect']);

/** Normalizes a model-supplied True/False answer to the canonical option label. */
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
        // The model is never asked to supply options for this format (the prompt only
        // specifies the answer is "True"/"False"), so q.options is always absent here.
        // Without options, exam-runner.tsx treats the item as free-text and renders a
        // textarea instead of True/False radio buttons — force them explicitly.
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

export function isDemoMode(apiKey?: string, groqApiKey?: string): boolean {
  const key = apiKey ?? process.env.NVIDIA_API_KEY;
  const gkey = groqApiKey ?? process.env.GROQ_API_KEY;
  return (!key || key.trim().length === 0) && (!gkey || gkey.trim().length === 0);
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

  // Try every configured provider in order before giving up to demo content.
  // A provider that's persistently rate-limited (Groq's free tier 429s all
  // day once its quota is spent, regardless of retries/backoff within a
  // single request) shouldn't take down generation when another real
  // provider is available. Only the LAST candidate gets the full retry
  // budget — retrying an already-failing provider with backoff before
  // falling through wastes the whole request on a provider that's already
  // proven bad, leaving no time to actually reach the working fallback.
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

// Halved from 12000 — confirmed directly against production that a
// 12000-char chunk could trip a Groq 413 (request payload too large) on
// the raw-fallback path. A smaller chunk means more chunks for a long
// document, but each individual request stays safely under the limit.
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

/** Raw-chunk fallback path — used only when document analysis (see below) comes up empty. */
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
    temperature: 0.4,
    maxTokens: Math.min(6000, count * 220 + 600),
    timeoutMs: 45000,
    // Retries (with the provider helper's existing exponential-ish 429
    // backoff) default to 2, but generateQuestionsFromText passes 0 here
    // whenever another real provider is queued behind this one — retrying
    // the same already-failing provider with a growing backoff wastes the
    // whole request budget before the working fallback ever gets a turn.
    // Only the last configured provider gets the full retry budget.
    retries,
    // No responseFormat here deliberately: `json_object` forces a JSON
    // *object* at the root, which conflicts with the array this prompt asks
    // for. Against meta/llama-3.1-8b-instruct that constraint made the model
    // silently collapse to a single bare question object (dropping the
    // array and ignoring the requested count) — verified by comparing raw
    // output with and without the flag. Rely on the prompt + extractJsonArray's
    // repair logic instead.
  });
  return extractJsonArray(content);
}

/** Targeted generation: writes questions against pre-identified exam topics rather than raw text. */
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
    temperature: 0.4,
    maxTokens: Math.min(6000, count * 220 + 600),
    timeoutMs: 45000,
    retries,
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

/**
 * Two-stage pipeline: analyze the material for what's genuinely exam-worthy,
 * then write questions targeting those specific concepts — rather than
 * mechanically extracting from whatever text happens to fall in a chunk.
 * This is what makes generation feel like real exam preparation instead of
 * a random-sentence question generator.
 */
async function generateFromProvider(text: string, formats: QuestionFormat[], countPerFormat: number, cfg: AiProviderConfig, retries = 2): Promise<GeneratedQuestion[]> {
  const perCall = 10;
  const numChunks = Math.max(1, Math.min(12, Math.ceil(countPerFormat / perCall)));
  const chunks = numChunks > 1 ? chunkText(text, Math.ceil(text.length / numChunks)) : [text];

  // Stage 1: analyze every chunk in parallel for exam-likely concepts. Ask
  // for a bit more than strictly needed per chunk so the merged, deduped
  // list comfortably covers countPerFormat even after some chunks yield
  // fewer usable topics than others.
  const topicsPerChunk = Math.max(3, Math.ceil((countPerFormat * 1.4) / chunks.length));
  const analyzed = await runWithConcurrency(chunks, Math.max(1, Math.min(concurrencyFor(cfg), chunks.length)), (chunk) =>
    analyzeChunk(chunk, topicsPerChunk, cfg, retries)
  );
  const topics = dedupeTopics(analyzed.flat());

  // Analysis came up empty (e.g. very short, list-like, or malformed
  // material) — fall back to the raw-chunk path rather than generating
  // nothing at all.
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

  // Stage 2: write questions against the identified topics. Each job gets a
  // rotated slice of the topic list (not the same starting point every
  // time) so parallel batches for the same format don't all anchor on the
  // same handful of concepts.
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

/** Run async tasks with a concurrency cap without pulling in a dependency. */
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
          explanation: 'Full answer depends on the AI tutor — this is a demo question (no Groq or NVIDIA API key set).',
        });
      }
    }
  }
  return questions;
}
