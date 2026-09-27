import { prisma } from '@/lib/prisma';

// Single kill switch for every AI call in the app. Launch strategy: ship
// fully working without any AI-dependent feature first, add AI back once
// there's revenue to fund it reliably (this session spent a long stretch
// fighting Groq/NVIDIA/Gemini all failing simultaneously — AI availability
// isn't something this app can promise students on day one). Every route
// that calls an AI provider (chat, CBT question generation, flashcard/
// revision-guide generation, free-text grading, OCR, embeddings) must check
// this FIRST, before resolving a provider or importing an AI client, so a
// disabled state genuinely makes zero network calls rather than routing to
// a "none" provider that still enters AI-shaped code. Flip AI_FEATURES_ENABLED=true
// in Vercel env to turn everything back on without a code change.
export const AI_FEATURES_ENABLED = process.env.AI_FEATURES_ENABLED === 'true';

// SEE FULL FILE IN ARTIFACT - this is a critical restore
export async function resolveNvidiaApiKey(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { nvidiaApiKey: true } });
  const saved = u?.nvidiaApiKey?.trim();
  if (saved) return saved;
  return process.env.NVIDIA_API_KEY?.trim() || '';
}

export async function resolveGeminiApiKey(): Promise<string> {
  return process.env.GEMINI_API_KEY?.trim() || '';
}

export type AiProvider = 'nvidia' | 'gemini' | 'none';

export interface AiProviderConfig {
  provider: AiProvider;
  apiKey: string;
  baseURL: string;
  model: string;
}

export const NVIDIA_BASE_URL = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
export const NVIDIA_MODEL = process.env.NVIDIA_MODEL || 'meta/llama-3.1-8b-instruct';

export const NVIDIA_MODEL_CHAIN = (
  process.env.NVIDIA_MODEL_CHAIN?.split(',').map((s) => s.trim()).filter(Boolean)
) || [
  'deepseek-ai/deepseek-v4-flash-0731',
  'meta/llama-3.1-8b-instruct',
  'nvidia/llama-3.1-nemotron-nano-8b-v1',
  'mistralai/mistral-nemotron',
  'deepseek-ai/deepseek-v4-pro-0813',
  'nvidia/llama-3.1-nemotron-51b-instruct',
];

export const GEMINI_BASE_URL = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai';
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

export async function resolveAiProvider(userId: string): Promise<AiProviderConfig> {
  const list = await resolveAiProviders(userId);
  return list[0] ?? { provider: 'none', apiKey: '', baseURL: NVIDIA_BASE_URL, model: NVIDIA_MODEL };
}

const PREFERRED_NVIDIA_MODELS = [
  'deepseek-ai/deepseek-v4-flash-0731',
  'meta/llama-3.1-8b-instruct',
  'nvidia/llama-3.1-nemotron-nano-8b-v1',
  'mistralai/mistral-nemotron',
  'meta/llama-3.1-70b-instruct',
  'nvidia/llama-3.3-nemotron-super-49b-v1',
];

const NON_CHAT_HINTS =
  /embed|rerank|guard|vision|tts|asr|whisper|clip|ocr|moderat|safety|reward|classif|-parse\b|parse-|retriev|codec|detector|video/;

function looksLikeChatModel(id: string): boolean {
  return !NON_CHAT_HINTS.test(id.toLowerCase());
}

function sizeRank(id: string): number {
  const lower = id.toLowerCase();
  if (/\b1b\b|\b2b\b|\b3b\b|nano|mini|tiny|flash/.test(lower)) return 1;
  if (/\b7b\b|\b8b\b|\b9b\b|\b14b\b|\b22b\b/.test(lower)) return 2;
  if (/super|ultra|\b49b\b|\b70b\b|\b72b\b|\b405b\b/.test(lower)) return 4;
  return 3;
}

const MAX_LIVE_CANDIDATES = 4;
const PROBE_POOL_SIZE = 60;
const PROBE_TIMEOUT_MS = 3_000;
const PROBE_CONCURRENCY = 8;
const PROBE_PHASE_BUDGET_MS = 5_000;
const MODEL_LIST_CACHE_TTL_MS = 10 * 60 * 1000;
const MODEL_COOLDOWN_MS = 5 * 60 * 1000;

type ModelListCacheEntry = { models: string[]; expiresAt: number };
const nvidiaModelListCache = new Map<string, ModelListCacheEntry>();
type ModelHealth = { brokenUntil: number };
const nvidiaModelHealth = new Map<string, ModelHealth>();

function healthKey(apiKey: string, model: string) {
  return `${apiKey}::${model}`;
}

export function markNvidiaModelBroken(apiKey: string, model: string) {
  nvidiaModelHealth.set(healthKey(apiKey, model), { brokenUntil: Date.now() + MODEL_COOLDOWN_MS });
}

function isInCooldown(apiKey: string, model: string): boolean {
  const entry = nvidiaModelHealth.get(healthKey(apiKey, model));
  if (!entry) return false;
  if (entry.brokenUntil <= Date.now()) {
    nvidiaModelHealth.delete(healthKey(apiKey, model));
    return false;
  }
  return true;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

type ProbeResult = { model: string; ok: boolean };

async function probeModel(apiKey: string, model: string): Promise<ProbeResult> {
  try {
    const res = await fetchWithTimeout(
      `${NVIDIA_BASE_URL}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model, stream: false, max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
      },
      PROBE_TIMEOUT_MS
    );
    if (res.status === 404 || res.status === 410 || res.status === 401) return { model, ok: false };
    return { model, ok: true };
  } catch {
    return { model, ok: false };
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  deadline: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length && Date.now() < deadline) {
      const idx = i++;
      results.push(await fn(items[idx]));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function resolveNvidiaModelsLive(apiKey: string): Promise<string[]> {
  const cached = nvidiaModelListCache.get(apiKey);
  if (cached && cached.expiresAt > Date.now()) return cached.models;
  try {
    const res = await fetchWithTimeout(
      `${NVIDIA_BASE_URL}/models`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
      8_000
    );
    if (!res.ok) return NVIDIA_MODEL_CHAIN;
    const body = (await res.json()) as { data?: { id?: string }[] };
    const ids = (body.data ?? [])
      .map((m) => m.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    if (ids.length === 0) return NVIDIA_MODEL_CHAIN;
    const preferred = PREFERRED_NVIDIA_MODELS.filter((id) => ids.includes(id));
    const rest = ids
      .filter((id) => !preferred.includes(id) && looksLikeChatModel(id))
      .sort((a, b) => sizeRank(a) - sizeRank(b));
    const rankedPool = [...preferred, ...rest].slice(0, PROBE_POOL_SIZE);
    const probeDeadline = Date.now() + PROBE_PHASE_BUDGET_MS;
    const probeResults = await mapWithConcurrency(rankedPool, PROBE_CONCURRENCY, probeDeadline, (model) =>
      probeModel(apiKey, model)
    );
    const ranked = probeResults.filter((r) => r.ok).map((r) => r.model).slice(0, MAX_LIVE_CANDIDATES);
    const models = ranked.length ? ranked : NVIDIA_MODEL_CHAIN;
    nvidiaModelListCache.set(apiKey, { models, expiresAt: Date.now() + MODEL_LIST_CACHE_TTL_MS });
    return models;
  } catch {
    return NVIDIA_MODEL_CHAIN;
  }
}

export async function resolveAiProviders(userId: string): Promise<AiProviderConfig[]> {
  const [nvidiaKey, geminiKey] = await Promise.all([
    resolveNvidiaApiKey(userId),
    resolveGeminiApiKey(),
  ]);
  const list: AiProviderConfig[] = [];
  if (nvidiaKey) {
    const candidates = await resolveNvidiaModelsLive(nvidiaKey);
    const live = candidates.filter((m) => !isInCooldown(nvidiaKey, m));
    for (const model of live.length ? live : candidates) {
      list.push({ provider: 'nvidia', apiKey: nvidiaKey, baseURL: NVIDIA_BASE_URL, model });
    }
  }
  if (geminiKey) list.push({ provider: 'gemini', apiKey: geminiKey, baseURL: GEMINI_BASE_URL, model: GEMINI_MODEL });
  return list;
}

export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '••••••••';
  const tail = key.slice(-4);
  const prefix = key.slice(0, 3);
  return `${prefix}•${'•'.repeat(Math.min(6, key.length - 8))}${tail}`;
}
