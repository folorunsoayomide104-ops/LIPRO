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

// Per-user key, checked before any shared app-wide key. This is now the
// PRIMARY access path, not a fallback: a shared NVIDIA_API_KEY serving every
// request from every student is a single point of failure by design — it's
// exactly what died (confirmed live: every model returned 401 on the shared
// key, not just individually-unentitled models) and took every student down
// with it at once. Each student adding their own free NVIDIA key in Settings
// isolates their usage/rate-limit to their own account; if a shared
// NVIDIA_API_KEY is also configured it's used only as a last resort for
// students who haven't added a personal one yet.
export async function resolveNvidiaApiKey(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { nvidiaApiKey: true } });
  const saved = u?.nvidiaApiKey?.trim();
  if (saved) return saved;
  return process.env.NVIDIA_API_KEY?.trim() || '';
}

// Env-only (no per-user override column, unlike Groq/NVIDIA) — added as a
// third fallback provider after a day where Groq's daily quota and NVIDIA's
// account credits were both exhausted simultaneously, leaving zero working
// providers. Google AI Studio's free tier is generous and needs no billing
// setup, making it a reasonable free backstop rather than a primary choice.
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

// Groq removed entirely (was: openai/gpt-oss-120b via api.groq.com) — the
// app now runs on NVIDIA only, with per-user keys as the primary access
// path (see resolveNvidiaApiKey). NVIDIA_MODEL is kept only as the single
// model resolveAiProvider (singular, chat's simple picker) reports; real
// failover happens in NVIDIA_MODEL_CHAIN below, used by resolveAiProviders.
export const NVIDIA_MODEL = process.env.NVIDIA_MODEL || 'nvidia/llama-3.1-nemotron-70b-instruct';

// Model-level failover within NVIDIA's own catalog (~80 models) — since a
// model can be individually unentitled, rate-limited, or deprecated on any
// given user's key independent of every other model, generateQuestionsFromText
// (and now chat, via resolveAiProviders) tries each of these in order and
// falls through automatically on a 401/404/410/429/timeout, the same way it
// already fell through Groq→NVIDIA→Gemini at the provider level. Ordered:
// Nemotron first (requested explicitly), then other real, currently-listed
// NVIDIA-catalog instruct models as depth — every ID here was confirmed
// present in a live GET /v1/models response (a wrong ID 404s outright
// rather than failing over, so don't add one without that confirmation).
// Individual-model callability still depends on each user's own account
// entitlements — that's exactly what this chain exists to fail through.
// Reordered off live production evidence (real timing logs from a genuine
// chat request), not guessed: 'nvidia/llama-3.1-nemotron-70b-instruct' now
// 404s outright — "Function ... Not Found for account" — it's no longer
// accessible on this NVIDIA key at all, so it was wasting time on the front
// of every single request. 'nvidia/nemotron-3.5-lightning-30b-a3b' was
// worse: it doesn't fail cleanly, it HANGS for ~92s before finally timing
// out, which is far more costly than a clean miss. Both removed rather than
// left later in the chain — a hanging model is a landmine wherever it sits.
// 'mistralai/mistral-nemotron' was the only one of the three that actually
// answered in that same request, so it's promoted to first.
export const NVIDIA_MODEL_CHAIN = (
  process.env.NVIDIA_MODEL_CHAIN?.split(',').map((s) => s.trim()).filter(Boolean)
) || [
  'mistralai/mistral-nemotron',
  'nvidia/llama-3.1-nemotron-51b-instruct',
  'deepseek-ai/deepseek-v4-pro-0813',
  'deepseek-ai/deepseek-v4-flash-0731',
];

// Google's OpenAI-compatible endpoint — confirmed directly with a live
// request that this exact base URL + model + Bearer-token auth works with
// the same request/response shape already used for Groq/NVIDIA, so no new
// client code was needed, only a new provider entry.
export const GEMINI_BASE_URL = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai';
// gemini-3.6-flash's free tier turned out to be capped at 20 requests PER
// DAY (not per-minute) — confirmed via a live 429 burst test reading the
// quota error body: quotaId "GenerateRequestsPerDayPerProjectPerModel-
// FreeTier", quotaValue 20. That's exhausted by a single CBT generation
// request's own retries, never mind real usage. gemini-3.1-flash-lite's
// free tier is a proper per-MINUTE cap instead (quotaId "...PerMinute...",
// quotaValue 15 in the same live test) — the same shape of constraint as
// Groq's, which the pipeline already knows how to serialize around.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

export async function resolveAiProvider(userId: string): Promise<AiProviderConfig> {
  const list = await resolveAiProviders(userId);
  return list[0] ?? { provider: 'none', apiKey: '', baseURL: NVIDIA_BASE_URL, model: NVIDIA_MODEL };
}

/* ------------------------------------------------------------------ *
 * LIVE MODEL DISCOVERY — every hand-maintained NVIDIA_MODEL_CHAIN entry
 * in this file's history has eventually gone stale: NVIDIA retires NIM
 * models with as little as ~2 weeks' notice, and a model can be *listed*
 * in GET /v1/models while still 404ing on every real completion call
 * ("Function '<id>' not found for account") — being listed doesn't mean
 * this key can actually invoke it. The static chain above was rebuilt by
 * hand from production log evidence at least three separate times this
 * session alone. This replaces that with the same approach a reference
 * NVIDIA-backed chat app (liproaiappn.vercel.app) actually uses: probe a
 * ranked pool of candidates with a real trivial completion call, keep
 * only the ones that don't come back 404, and cache the result briefly
 * per key so most requests skip the extra round trip. NVIDIA_MODEL_CHAIN
 * is kept as the last-resort fallback if discovery itself fails (e.g.
 * NVIDIA's /v1/models endpoint is unreachable).
 * ------------------------------------------------------------------ */

// Ranked ahead of a generic size sweep when present in the live catalog —
// not a requirement, just a tie-break. Nemotron (NVIDIA's own family) is
// checked separately, first, regardless of this list.
const PREFERRED_NVIDIA_MODELS = [
  'mistralai/mistral-nemotron',
  'meta/llama-3.1-8b-instruct',
  'nvidia/llama-3.1-nemotron-nano-8b-v1',
  'meta/llama-3.1-70b-instruct',
  'nvidia/llama-3.3-nemotron-super-49b-v1',
];

// Denylist rather than allowlist — NVIDIA's naming conventions vary too
// much for an allowlist regex to be safe (a real chat model can fail to
// match "instruct|chat|nemotron" and get silently excluded). Only rule
// out the kinds that are unambiguously not text-chat.
const NON_CHAT_HINTS =
  /embed|rerank|guard|vision|tts|asr|whisper|clip|ocr|moderat|safety|reward|classif|-parse\b|parse-|retriev|codec|detector|video/;

function looksLikeChatModel(id: string): boolean {
  return !NON_CHAT_HINTS.test(id.toLowerCase());
}

function sizeRank(id: string): number {
  const lower = id.toLowerCase();
  if (/nano|mini|\b1b\b|\b2b\b|\b3b\b/.test(lower)) return 0;
  if (/\b7b\b|\b8b\b|\b9b\b/.test(lower)) return 1;
  if (/\b13b\b|\b14b\b|\b22b\b/.test(lower)) return 2;
  if (/super|ultra|\b49b\b|\b70b\b|\b72b\b|\b405b\b/.test(lower)) return 4;
  return 3;
}

const MAX_LIVE_CANDIDATES = 6;
const PROBE_POOL_SIZE = 60;
const PROBE_TIMEOUT_MS = 6_000;
const PROBE_CONCURRENCY = 8;
const PROBE_PHASE_BUDGET_MS = 12_000;
const MODEL_LIST_CACHE_TTL_MS = 10 * 60 * 1000;
const MODEL_COOLDOWN_MS = 5 * 60 * 1000;

type ModelListCacheEntry = { models: string[]; expiresAt: number };
const nvidiaModelListCache = new Map<string, ModelListCacheEntry>();
type ModelHealth = { brokenUntil: number };
const nvidiaModelHealth = new Map<string, ModelHealth>();

function healthKey(apiKey: string, model: string) {
  return `${apiKey}::${model}`;
}

/** A model that just failed a real generation call is skipped for a short
 *  cooldown so the *next* request doesn't re-pay the latency of a model
 *  already known to be currently broken. Call this from the pipeline/
 *  question-gen callers on a genuine failure. In-memory only (best-effort
 *  across warm serverless instances) — correctness never depends on it. */
export function markNvidiaModelBroken(apiKey: string, model: string) {
  nvidiaModelHealth.set(healthKey(apiKey, model), { brokenUntil: Date.now() + MODEL_COOLDOWN_MS });
}

function isInCooldown(apiKey: string, model: string): boolean {
  const entry = nvidiaModelHealth.get(healthKey(apiKey, model));
  return Boolean(entry && entry.brokenUntil > Date.now());
}

type ProbeResult = 'ok' | 'not_found' | 'maybe';

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function probeModel(apiKey: string, model: string): Promise<ProbeResult> {
  try {
    const res = await fetchWithTimeout(
      `${NVIDIA_BASE_URL}/chat/completions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, stream: false, max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
      },
      PROBE_TIMEOUT_MS
    );
    if (res.ok) return 'ok';
    // 404 ("Function '<id>' not found for account") is the only response
    // that proves a model is permanently unusable for this key — routing
    // never located a provisioned worker pool at all. Everything else
    // (429/500/503, "Service temporarily overloaded") means routing DID
    // find a real pool and it's just busy — that's a working model
    // observed under load, not a dead one.
    return res.status === 404 ? 'not_found' : 'maybe';
  } catch {
    return 'maybe';
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  deadlineAt: number,
  fn: (item: T) => Promise<R>
): Promise<{ item: T; result: R }[]> {
  const results: { item: T; result: R }[] = [];
  let next = 0;
  async function worker() {
    while (Date.now() < deadlineAt) {
      const i = next++;
      if (i >= items.length) return;
      results.push({ item: items[i], result: await fn(items[i]) });
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Live-probed, cached, ranked list of NVIDIA models this key can actually
 * call right now. Falls back to the static NVIDIA_MODEL_CHAIN if discovery
 * itself errors (network issue reaching NVIDIA) so a transient problem here
 * never blocks generation entirely.
 */
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

    const nemotron = ids.filter((id) => /nemotron/i.test(id) && looksLikeChatModel(id));
    const preferred = PREFERRED_NVIDIA_MODELS.filter((id) => ids.includes(id) && !nemotron.includes(id));
    const rest = ids
      .filter((id) => !nemotron.includes(id) && !preferred.includes(id) && looksLikeChatModel(id))
      .sort((a, b) => sizeRank(a) - sizeRank(b));
    const rankedPool = [...nemotron, ...preferred, ...rest].slice(0, PROBE_POOL_SIZE);

    const probeDeadline = Date.now() + PROBE_PHASE_BUDGET_MS;
    const probeResults = await mapWithConcurrency(rankedPool, PROBE_CONCURRENCY, probeDeadline, (model) =>
      probeModel(apiKey, model)
    );
    const ranked = probeResults
      .filter((r) => r.result !== 'not_found')
      .map((r, i) => ({ ...r, i }))
      .sort((a, b) => (a.result === b.result ? a.i - b.i : a.result === 'ok' ? -1 : 1))
      .map((r) => r.item)
      .slice(0, MAX_LIVE_CANDIDATES);

    const models = ranked.length ? ranked : NVIDIA_MODEL_CHAIN;
    nvidiaModelListCache.set(apiKey, { models, expiresAt: Date.now() + MODEL_LIST_CACHE_TTL_MS });
    return models;
  } catch {
    return NVIDIA_MODEL_CHAIN;
  }
}

/**
 * Every usable provider+model combination for this user, in priority order:
 * live-probed NVIDIA candidates (using the user's own key if they've added
 * one in Settings, else the shared app-wide key as a last resort), then
 * Gemini. Lets generation callers fail over to another real option instead
 * of dropping straight to demo content when the preferred one is down,
 * unentitled on this account, rate-limited, or simply unavailable —
 * retrying the *same* provider/model rarely recovers from any of those
 * within a single request. Gemini is last because it's the newest, least
 * battle-tested-for-this-workload addition, and per-user keys aren't
 * supported for it (see resolveGeminiApiKey).
 *
 * Used for both chat (resolveAiProvider above just takes the first entry)
 * and CBT question generation, which needs the full list to fail through.
 */
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
