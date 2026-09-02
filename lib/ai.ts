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
export const NVIDIA_MODEL_CHAIN = (
  process.env.NVIDIA_MODEL_CHAIN?.split(',').map((s) => s.trim()).filter(Boolean)
) || [
  'nvidia/llama-3.1-nemotron-70b-instruct',
  'nvidia/nemotron-3.5-lightning-30b-a3b',
  'mistralai/mistral-nemotron',
  'nvidia/llama-3.1-nemotron-51b-instruct',
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

/**
 * Every usable provider+model combination for this user, in priority order:
 * each model in NVIDIA_MODEL_CHAIN (using the user's own key if they've
 * added one in Settings, else the shared app-wide key as a last resort),
 * then Gemini. Lets generation callers fail over to another real option
 * instead of dropping straight to demo content when the preferred one is
 * down, unentitled on this account, rate-limited, or simply unavailable —
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
    for (const model of NVIDIA_MODEL_CHAIN) {
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
