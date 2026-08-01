export interface NvidiaChatMessage {
  role: string;
  content: string;
}

export async function nvidiaChatCompletion(params: {
  apiKey: string;
  baseURL?: string;
  model?: string;
  label?: string;
  messages: NvidiaChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  retries?: number;
}): Promise<string> {
  const { apiKey, baseURL, model, label = 'AI provider', messages, temperature, maxTokens, timeoutMs = 60000, retries = 2 } = params;
  const url = `${baseURL || process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1'}/chat/completions`;
  const mdl = model || process.env.NVIDIA_MODEL || 'meta/llama-3.1-8b-instruct';

  let lastErr: Error = new Error(`${label} request failed`);
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: mdl,
          messages,
          temperature: temperature ?? 0.7,
          max_tokens: maxTokens ?? 800,
        }),
        signal: controller.signal,
      });

      if (res.status === 429 || res.status === 503 || res.status >= 500) {
        lastErr = new Error(`${label} error ${res.status} (attempt ${attempt + 1}/${retries + 1})`);
        await sleep(2000 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`${label} error ${res.status}`);

      const data = await res.json();
      const content: string = data.choices?.[0]?.message?.content || '';
      if (!content) throw new Error(`${label} returned an empty response`);
      return content;
    } catch (err: any) {
      lastErr = err?.message ? err : new Error(err?.message || `${label} request failed`);
      if (err?.name === 'AbortError') {
        lastErr = new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`);
      }
      await sleep(1000 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

export interface StreamParams {
  apiKey: string;
  baseURL?: string;
  model?: string;
  label?: string;
  messages: NvidiaChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export async function openNvidiaStream(params: StreamParams): Promise<Response> {
  const { apiKey, baseURL, model, messages, temperature, maxTokens, timeoutMs = 90000 } = params;
  const url = `${baseURL || process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1'}/chat/completions`;
  const mdl = model || process.env.NVIDIA_MODEL || 'meta/llama-3.1-8b-instruct';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: mdl,
        messages,
        temperature: temperature ?? 0.7,
        max_tokens: maxTokens ?? 800,
        stream: true,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
