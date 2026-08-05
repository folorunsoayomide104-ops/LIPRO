import type { ToolDefinition, ToolExecutor } from '@/lib/nvidia';
import { webSearch, formatSearchResults } from '@/lib/websearch';
import type { PipelineDoc } from './types';

export const WEB_SEARCH_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'web_search',
    description:
      'Search the web in real time. Use this to get current, up-to-date information, recent news, facts, or anything you are unsure about. Provide a concise query.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'The search query, e.g. "JAMB 2026 date"' } },
      required: ['query'],
    },
  },
};

export const RAG_SEARCH_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'rag_search',
    description:
      'Semantic search across the student\'s saved documents and notes using vector embeddings. Use this to find relevant passages from their uploaded study materials. Provide the key idea to search for.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'The concept or phrase to find in the student\'s documents' } },
      required: ['query'],
    },
  },
};

export const DOCUMENT_SEARCH_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'document_search',
    description:
      'Strict lexical search over the documents currently attached to this conversation. Use this to locate exact wording or specific sections in the attached PDFs/TXT/MD files.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'A phrase to locate within the attached documents' } },
      required: ['query'],
    },
  },
};

export const CALCULATOR_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'calculator',
    description:
      'Evaluate a numeric expression safely (supports + - * / % and parentheses). Use this for arithmetic the student asks to compute.',
    parameters: {
      type: 'object',
      properties: { expression: { type: 'string', description: 'A numeric expression, e.g. "(12 + 34) * 2 / 7"' } },
      required: ['expression'],
    },
  },
};

/**
 * Not yet wired up — reserved placeholders in the architecture.
 * Kept as documented stubs so the tool selection describes them accurately.
 */
export const CODE_EXECUTOR_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'code_executor',
    description: 'Execute a snippet of code in a sandbox and return its output. Not available yet.',
    parameters: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] },
  },
};

interface ToolExecutorContext {
  docs: PipelineDoc[];
  ragSearch: (query: string) => Promise<string>;
}

export function buildToolExecutor(ctx: ToolExecutorContext): ToolExecutorWithCalls {
  const calls: string[] = [];
  const runner: ToolExecutor = async (name: string, args: any): Promise<string> => {
    calls.push(name);
    switch (name) {
      case 'web_search': {
        const query = String(args?.query || '').trim();
        if (!query) return 'No query provided';
        const results = await webSearch(query, 5);
        return formatSearchResults(results);
      }
      case 'rag_search': {
        const query = String(args?.query || '').trim();
        if (!query) return 'No query provided';
        return ctx.ragSearch(query);
      }
      case 'document_search': {
        const query = String(args?.query || '').trim();
        if (!query) return 'No query provided';
        if (ctx.docs.length === 0) return 'No documents are attached to this conversation.';
        const needle = query.toLowerCase();
        const hits: string[] = [];
        for (const doc of ctx.docs) {
          const lower = doc.text.toLowerCase();
          let idx = 0;
          let guard = 0;
          while (guard++ < 6) {
            idx = lower.indexOf(needle, idx);
            if (idx === -1) break;
            const start = Math.max(0, idx - 160);
            const end = Math.min(doc.text.length, idx + needle.length + 320);
            hits.push(`[${doc.name}]\n...${doc.text.slice(start, end).replace(/\s+/g, ' ')}...`);
            idx += needle.length;
            if (hits.length >= 4) break;
          }
          if (hits.length >= 4) break;
        }
        return hits.length > 0
          ? hits.join('\n\n---\n\n')
          : 'No exact matches found in the attached documents.';
      }
      case 'calculator': {
        const expression = String(args?.expression || '').trim();
        if (!expression) return 'No expression provided';
        try {
          const value = safeEvaluate(expression);
          return `${expression} = ${value}`;
        } catch {
          return 'Could not evaluate that expression.';
        }
      }
      default:
        return 'Unknown tool.';
    }
  };
  return Object.assign(runner, { calls });
}

export type ToolExecutorWithCalls = ToolExecutor & { calls: string[] };

/** Minimal safe arithmetic evaluator (no eval): + - * / % and parentheses. */
function safeEvaluate(expression: string): number {
  const tokens = expression.match(/(\d+\.?\d*|[()+*\/%-])/g);
  if (!tokens) throw new Error('Invalid expression');

  const output: Array<number | string> = [];
  const ops: string[] = [];
  const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2 };

  for (const tok of tokens) {
    if (/^\d/.test(tok)) {
      output.push(parseFloat(tok));
    } else if (tok === '(') {
      ops.push(tok);
    } else if (tok === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') {
        output.push(ops.pop()!);
      }
      ops.pop();
    } else if (precedence[tok] != null) {
      while (ops.length && ops[ops.length - 1] !== '(' && precedence[ops[ops.length - 1]] >= precedence[tok]) {
        output.push(ops.pop()!);
      }
      ops.push(tok);
    }
  }
  while (ops.length) output.push(ops.pop()!);

  const stack: number[] = [];
  for (const item of output) {
    if (typeof item === 'number') {
      stack.push(item);
    } else {
      const b = stack.pop();
      const a = stack.pop();
      if (a == null || b == null) throw new Error('Invalid expression');
      let result: number;
      switch (item) {
        case '+': result = a + b; break;
        case '-': result = a - b; break;
        case '*': result = a * b; break;
        case '/':
          if (b === 0) throw new Error('Division by zero');
          result = a / b;
          break;
        case '%':
          if (b === 0) throw new Error('Modulo by zero');
          result = a % b;
          break;
        default: throw new Error('Invalid operator');
      }
      if (!Number.isFinite(result)) throw new Error('Non-finite result');
      stack.push(result);
    }
  }
  if (stack.length !== 1) throw new Error('Invalid expression');
  return Number(stack[0].toFixed(6));
}