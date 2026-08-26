import { prisma } from '@/lib/prisma';

export async function resolveNvidiaApiKey(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { nvidiaApiKey: true } });
  const saved = u?.nvidiaApiKey?.trim();
  if (saved) return saved;
  return process.env.NVIDIA_API_KEY?.trim() || '';
}

export async function resolveGroqApiKey(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { groqApiKey: true } });
  const saved = u?.groqApiKey?.trim();
  if (saved) return saved;
  return process.env.GROQ_API_KEY?.trim() || '';
}

export type AiProvider = 'groq' | 'nvidia' | 'none';

export interface AiProviderConfig {
  provider: AiProvider;
  apiKey: string;
  baseURL: string;
  model: string;
}

export const GROQ_BASE_URL = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
// llama-3.3-70b-versatile (the previous default) is deprecated and 404s
// against the live API — confirmed directly. openai/gpt-oss-120b is Groq's
// current flagship production model and supports tool calling.
export const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
export const NVIDIA_BASE_URL = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
// meta/llama-3.1-8b-instruct gave weak/off-topic answers as the fallback
// model; meta/llama-3.3-70b-instruct fixed quality but blew the LIPRO AI
// chat pipeline's 40s-per-attempt reasoning-stage timeout — confirmed
// directly against production ("NVIDIA NIM (reasoning) timed out after
// 40s"), a hard failure that's worse than 8B's weak-but-real answer. Trying
// a speed-optimized model next: deepseek-ai/deepseek-v4-flash-0731 is built
// for low latency, which is what this route actually needs more than raw
// size — if this also blows the budget, revert to meta/llama-3.1-8b-instruct.
export const NVIDIA_MODEL = process.env.NVIDIA_MODEL || 'deepseek-ai/deepseek-v4-flash-0731';
// Question generation (lib/question-gen.ts) shared NVIDIA_MODEL with chat
// until this was split out — confirmed directly against production that
// deepseek-v4-flash, while fast on short chat replies, consistently blew the
// 30s per-chunk analysis timeout once real (non-trivial) academic text was
// involved: every chunk of a 170K-char real-content test document timed out,
// forcing the whole generation to demo fallback. meta/llama-3.1-8b-instruct
// is the model this pipeline was actually built and proven against.
export const NVIDIA_QUESTIONGEN_MODEL = process.env.NVIDIA_QUESTIONGEN_MODEL || 'meta/llama-3.1-8b-instruct';

// Model-level failover within NVIDIA, not just provider-level (Groq→NVIDIA).
// Every entry here was directly confirmed present in a live GET
// /v1/models response — a wrong model ID 404s instead of failing over, so
// don't add one without that confirmation. (meta/llama-3.1-8b-instruct
// itself no longer appears in that listing despite still working when
// called — NVIDIA's catalog and its listing endpoint can drift — so this
// list intentionally leans on models confirmed by the listing, not just by
// having worked once.) Ordered: proven-reliable-for-this-workload first,
// then two different vendors under the nv-mistralai/nvidia orgs so one
// vendor's outage/rate-limit can't take out the whole chain.
export const NVIDIA_QUESTIONGEN_MODEL_CHAIN = (
  process.env.NVIDIA_QUESTIONGEN_MODEL_CHAIN?.split(',').map((s) => s.trim()).filter(Boolean)
) || [
  NVIDIA_QUESTIONGEN_MODEL,
  'nv-mistralai/mistral-nemo-12b-instruct',
  'nvidia/mistral-nemo-minitron-8b-8k-instruct',
];

export async function resolveAiProvider(userId: string): Promise<AiProviderConfig> {
  const [groqKey, nvidiaKey] = await Promise.all([resolveGroqApiKey(userId), resolveNvidiaApiKey(userId)]);
  if (groqKey) return { provider: 'groq', apiKey: groqKey, baseURL: GROQ_BASE_URL, model: GROQ_MODEL };
  if (nvidiaKey) return { provider: 'nvidia', apiKey: nvidiaKey, baseURL: NVIDIA_BASE_URL, model: NVIDIA_MODEL };
  return { provider: 'none', apiKey: '', baseURL: NVIDIA_BASE_URL, model: NVIDIA_MODEL };
}

/**
 * Every usable provider+model combination for this user, in priority order:
 * Groq first, then each model in NVIDIA_QUESTIONGEN_MODEL_CHAIN in turn.
 * Lets generation callers fail over to another real option instead of
 * dropping straight to demo content when the preferred one is down, rate-
 * limited, or (as happened twice this session) simply too slow for this
 * workload on this document — retrying the *same* provider/model rarely
 * recovers from any of those within a single request.
 *
 * Currently only called from the CBT question-generation route — chat uses
 * the singular resolveAiProvider above with its own NVIDIA_MODEL, kept
 * deliberately separate (see NVIDIA_QUESTIONGEN_MODEL's comment for why a
 * shared model constant broke question generation once already).
 */
export async function resolveAiProviders(userId: string): Promise<AiProviderConfig[]> {
  const [groqKey, nvidiaKey] = await Promise.all([resolveGroqApiKey(userId), resolveNvidiaApiKey(userId)]);
  const list: AiProviderConfig[] = [];
  if (groqKey) list.push({ provider: 'groq', apiKey: groqKey, baseURL: GROQ_BASE_URL, model: GROQ_MODEL });
  if (nvidiaKey) {
    for (const model of NVIDIA_QUESTIONGEN_MODEL_CHAIN) {
      list.push({ provider: 'nvidia', apiKey: nvidiaKey, baseURL: NVIDIA_BASE_URL, model });
    }
  }
  return list;
}

export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '••••••••';
  const tail = key.slice(-4);
  const prefix = key.slice(0, 3);
  return `${prefix}•${'•'.repeat(Math.min(6, key.length - 8))}${tail}`;
}
