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
// Upgraded from meta/llama-3.1-8b-instruct: the 8B model produced noticeably
// weak/off-topic answers when acting as the fallback provider (e.g. describing
// a question's format instead of answering it) — confirmed directly against
// production. 70B is available on this account's NVIDIA catalog and gives
// meaningfully better answer quality for the same OpenAI-compatible API shape,
// at some cost to latency; acceptable since NVIDIA is the fallback path, not
// the default (Groq is preferred whenever it's healthy).
export const NVIDIA_MODEL = process.env.NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct';

export async function resolveAiProvider(userId: string): Promise<AiProviderConfig> {
  const [primary] = await resolveAiProviders(userId);
  return primary ?? { provider: 'none', apiKey: '', baseURL: NVIDIA_BASE_URL, model: NVIDIA_MODEL };
}

/**
 * Every usable provider for this user, in priority order (Groq first, then
 * NVIDIA). Lets generation callers retry on a second real provider instead
 * of dropping straight to demo content when the preferred one is down or
 * rate-limited — Groq's free tier 429s persistently once its daily quota is
 * spent, and retrying the *same* provider (even with backoff) never
 * recovers from that within a single request.
 */
export async function resolveAiProviders(userId: string): Promise<AiProviderConfig[]> {
  const [groqKey, nvidiaKey] = await Promise.all([resolveGroqApiKey(userId), resolveNvidiaApiKey(userId)]);
  const list: AiProviderConfig[] = [];
  if (groqKey) list.push({ provider: 'groq', apiKey: groqKey, baseURL: GROQ_BASE_URL, model: GROQ_MODEL });
  if (nvidiaKey) list.push({ provider: 'nvidia', apiKey: nvidiaKey, baseURL: NVIDIA_BASE_URL, model: NVIDIA_MODEL });
  return list;
}

export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '••••••••';
  const tail = key.slice(-4);
  const prefix = key.slice(0, 3);
  return `${prefix}•${'•'.repeat(Math.min(6, key.length - 8))}${tail}`;
}
