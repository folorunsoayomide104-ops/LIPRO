export interface NvidiaChatMessage {
  role: string;
  content: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface CompletionResult {
  content: string;
  toolCalls: ToolCall[];
}

export async function chatCompletionWithTools(params: {
  apiKey: string;
  baseURL?: string;
  model?: string;
  label?: string;
  messages: Array<{ role: string; content: string | null; tool_calls?: ToolCall[]; tool_call_id?: string }>;
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<CompletionResult> {
  const { apiKey, baseURL, model, label = 'AI provider', messages, tools, temperature, maxTokens, timeoutMs = 60000 } = params;
  const url = `${baseURL || process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1'}/chat/completions`;
  const mdl = model || process.env.NVIDIA_MODEL || 'meta/llama-3.1-8b-instruct';

  const body: Record<string, unknown> = {
    model: mdl,
    messages,
    temperature: temperature ?? 0.7,
    max_tokens: maxTokens ?? 800,
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err: any) {
    // Tagged distinctly from an HTTP-level rejection below: a caller that
    // retries on "tools rejected" must NOT retry on a timeout — the retry
    // would just add another full timeoutMs on top, and two 60s attempts
    // back-to-back is exactly enough to blow the route's 120s hard limit.
    const timeoutErr = new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`);
    (timeoutErr as any).isTimeout = true;
    throw timeoutErr;
  }

  if (!res.ok) {
    // Surface the provider's actual error body (truncated) rather than just
    // the status code — some models/providers reject the `tools` param
    // outright (e.g. "function calling not supported for this model"), and
    // that detail is what actually explains a failure, not "error 400".
    const detail = await res.text().catch(() => '');
    throw new Error(`${label} error ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`);
  }

  const data = await res.json();
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error(`${label} returned an empty response`);

  const content: string = typeof message.content === 'string' ? message.content : '';
  const toolCalls: ToolCall[] = Array.isArray(message.tool_calls)
    ? message.tool_calls.filter((tc: any) => tc?.function?.name)
    : [];

  return { content, toolCalls };
}

/**
 * Streaming variant of chatCompletionWithTools. Parses SSE deltas from the
 * OpenAI-compatible /chat/completions endpoint. Content deltas are forwarded
 * live via onDelta as they arrive; tool-call deltas are accumulated (they
 * arrive as partial argument-string fragments keyed by index) and only
 * surfaced once the stream ends, since they can't be executed mid-stream.
 */
export async function streamChatCompletionWithTools(params: {
  apiKey: string;
  baseURL?: string;
  model?: string;
  label?: string;
  messages: Array<{ role: string; content: string | null; tool_calls?: ToolCall[]; tool_call_id?: string }>;
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  onDelta?: (text: string) => void;
}): Promise<CompletionResult> {
  const { apiKey, baseURL, model, label = 'AI provider', messages, tools, temperature, maxTokens, timeoutMs = 60000, onDelta } = params;
  const url = `${baseURL || process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1'}/chat/completions`;
  const mdl = model || process.env.NVIDIA_MODEL || 'meta/llama-3.1-8b-instruct';

  const body: Record<string, unknown> = {
    model: mdl,
    messages,
    temperature: temperature ?? 0.7,
    max_tokens: maxTokens ?? 800,
    stream: true,
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  // The timer used to guard the whole call — fetch AND the full stream read
  // below — not just time-to-first-byte. Previously it was cleared the
  // instant fetch() resolved (i.e. once headers arrived), so a provider that
  // sent headers promptly but then hung mid-stream (never sending [DONE])
  // had no timeout at all short of Vercel's own 120s function hard limit,
  // which is exactly the failure mode seen in production.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      const timeoutErr = new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`);
      (timeoutErr as any).isTimeout = true;
      throw timeoutErr;
    }

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => '');
      throw new Error(`${label} error ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    const toolCallsAcc: Record<number, { id: string; name: string; args: string }> = {};

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (!data || data === '[DONE]') continue;
          let json: any;
          try {
            json = JSON.parse(data);
          } catch {
            continue;
          }
          const delta = json.choices?.[0]?.delta;
          if (!delta) continue;
          if (typeof delta.content === 'string' && delta.content) {
            content += delta.content;
            onDelta?.(delta.content);
          }
          if (Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              const acc = (toolCallsAcc[idx] ??= { id: '', name: '', args: '' });
              if (tc.id) acc.id = tc.id;
              if (tc.function?.name) acc.name += tc.function.name;
              if (tc.function?.arguments) acc.args += tc.function.arguments;
            }
          }
        }
      }
    } catch (err) {
      const timeoutErr = new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`);
      (timeoutErr as any).isTimeout = true;
      throw timeoutErr;
    }

    const toolCalls: ToolCall[] = Object.values(toolCallsAcc)
      .filter((tc) => tc.name)
      .map((tc) => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.args } }));

    if (!content && toolCalls.length === 0) throw new Error(`${label} returned an empty response`);

    return { content, toolCalls };
  } finally {
    clearTimeout(timer);
  }
}

export type ToolExecutor = (name: string, args: any) => Promise<string>;

export async function runAgenticLoop(params: {
  apiKey: string;
  baseURL?: string;
  model?: string;
  label?: string;
  messages: Array<{ role: string; content: string | null; tool_calls?: ToolCall[]; tool_call_id?: string }>;
  tools: ToolDefinition[];
  executeTool: ToolExecutor;
  temperature?: number;
  maxTokens?: number;
  maxIterations?: number;
  timeoutMs?: number;
  /**
   * When provided, each turn is requested with stream:true so content deltas
   * of the FINAL answer (the turn with no tool_calls) are forwarded live.
   * Tool-resolution turns never produce content deltas in practice — models
   * emit either tool_calls or content, not both — so this never streams text
   * that later gets discarded.
   */
  onDelta?: (text: string) => void;
}): Promise<{ content: string; messages: Array<{ role: string; content: string | null }> }> {
  const { executeTool, maxIterations = 3, onDelta } = params;
  const messages = [...params.messages];
  const call = onDelta
    ? (p: Parameters<typeof chatCompletionWithTools>[0]) => streamChatCompletionWithTools({ ...p, onDelta })
    : chatCompletionWithTools;

  for (let i = 0; i < maxIterations; i++) {
    let result: CompletionResult;
    try {
      result = await call({ ...params, messages });
    } catch (err: any) {
      // Some models/providers don't actually support the `tools` param even
      // when advertised — observed in production as a hang rather than a
      // clean rejection, surfacing here as a timeout. On the first
      // iteration, fall back to a plain toolless completion instead —
      // better to answer without acting than to fail the turn entirely.
      // A timeout only triggers this retry when the caller passed an
      // explicit timeoutMs (meaning they've already budgeted for two bounded
      // attempts back to back) — with nvidia.ts's 60s default, two stacked
      // attempts would risk blowing the route's own hard time limit.
      const canRetryTimeout = !err?.isTimeout || params.timeoutMs !== undefined;
      if (i === 0 && canRetryTimeout && params.tools && params.tools.length > 0) {
        result = await call({ ...params, messages, tools: undefined });
      } else {
        throw err;
      }
    }

    if (result.toolCalls.length === 0) {
      return { content: result.content, messages };
    }

    messages.push({
      role: 'assistant',
      content: result.content || null,
      tool_calls: result.toolCalls,
    });

    for (const toolCall of result.toolCalls) {
      let toolOutput: string;
      try {
        const args = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
        toolOutput = await executeTool(toolCall.function.name, args);
      } catch (err: any) {
        toolOutput = `Tool error: ${err?.message || 'unknown error'}`;
      }
      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: toolOutput });
    }
  }

  // If we ran out of iterations, ask for a final answer without tools.
  const final = await call({ ...params, messages, tools: undefined });
  return { content: final.content, messages };
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
  responseFormat?: { type: 'json_object' | 'text' };
}): Promise<string> {
  const { apiKey, baseURL, model, label = 'AI provider', messages, temperature, maxTokens, timeoutMs = 60000, retries = 2, responseFormat } = params;
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
          ...(responseFormat ? { response_format: responseFormat } : {}),
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
