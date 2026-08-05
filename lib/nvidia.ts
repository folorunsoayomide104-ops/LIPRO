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

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (res.status === 429 || res.status === 503 || res.status >= 500) {
    throw new Error(`${label} error ${res.status}`);
  }
  if (!res.ok) throw new Error(`${label} error ${res.status}`);

  const data = await res.json();
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error(`${label} returned an empty response`);

  const content: string = typeof message.content === 'string' ? message.content : '';
  const toolCalls: ToolCall[] = Array.isArray(message.tool_calls)
    ? message.tool_calls.filter((tc: any) => tc?.function?.name)
    : [];

  return { content, toolCalls };
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
}): Promise<{ content: string; messages: Array<{ role: string; content: string | null }> }> {
  const { executeTool, maxIterations = 3 } = params;
  const messages = [...params.messages];

  for (let i = 0; i < maxIterations; i++) {
    const result = await chatCompletionWithTools({ ...params, messages });

    if (result.toolCalls.length === 0) {
      return { content: result.content, messages };
    }

    messages.push({
      role: 'assistant',
      content: result.content || null,
      tool_calls: result.toolCalls,
    });

    for (const call of result.toolCalls) {
      let toolOutput: string;
      try {
        const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        toolOutput = await executeTool(call.function.name, args);
      } catch (err: any) {
        toolOutput = `Tool error: ${err?.message || 'unknown error'}`;
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content: toolOutput });
    }
  }

  // If we ran out of iterations, ask for a final answer without tools.
  const final = await chatCompletionWithTools({ ...params, messages, tools: undefined });
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
