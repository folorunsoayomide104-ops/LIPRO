import type { ToolDefinition, ToolExecutor } from '@/lib/nvidia';
import { webSearch, formatSearchResults } from '@/lib/websearch';
import { prisma } from '@/lib/prisma';
import { noteSchema, flashcardSchema } from '@/lib/validators';
import { createExamAttempt } from '@/lib/cbt/create-attempt';
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

export const CREATE_NOTE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'create_note',
    description:
      "Save a note to the student's Notes for later revision. Use this when the student asks you to write down, save, or take a note of something — a summary, a definition, key points from this conversation, etc. Actually saves it; do not just describe the note in your reply.",
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'A short, descriptive title for the note' },
        content: { type: 'string', description: 'The full note content' },
        courseCode: { type: 'string', description: 'Optional course code to file this note under, e.g. "CSC401" — omit if not course-specific' },
      },
      required: ['title', 'content'],
    },
  },
};

export const CREATE_FLASHCARD_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'create_flashcard',
    description:
      "Save a flashcard to the student's Flashcards deck for spaced review. Use this when the student asks you to make/create a flashcard, or to turn something into a flashcard for revision. Actually saves it; do not just describe the flashcard in your reply.",
    parameters: {
      type: 'object',
      properties: {
        front: { type: 'string', description: 'The question or prompt side' },
        back: { type: 'string', description: 'The answer side' },
        courseCode: { type: 'string', description: 'Optional course code to file this flashcard under, e.g. "CSC401" — omit if not course-specific' },
      },
      required: ['front', 'back'],
    },
  },
};

export const START_CBT_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'start_cbt',
    description:
      'Start a real CBT (practice or timed exam) session for a course and return a link the student can open to begin. Use this when the student asks you to quiz them, test them, or start practice questions/an exam on a course — actually creates the session rather than just describing how to start one.',
    parameters: {
      type: 'object',
      properties: {
        courseCode: { type: 'string', description: 'The course code to practice, e.g. "CSC401"' },
        mode: { type: 'string', enum: ['practice', 'exam'], description: '"practice" for instant feedback, "exam" for a timed session' },
        count: { type: 'number', description: 'Number of questions, default 10' },
      },
      required: ['courseCode', 'mode'],
    },
  },
};

export const ACCOUNT_STATUS_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_account_status',
    description:
      "Look up the student's own real wallet balance, subscription plan, and study activity counts (notes saved, flashcards, CBT attempts). Use this when they ask about their balance, plan, or how much they've done — never guess these numbers.",
    parameters: { type: 'object', properties: {} },
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
  userId: string;
  docs: PipelineDoc[];
  ragSearch: (query: string) => Promise<string>;
}

/**
 * Case-insensitive exact code match. Courses are a small public catalogue
 * (confirmed elsewhere in this codebase), so filtering the full list in JS
 * is cheap and — unlike Prisma's `mode: 'insensitive'` filter — works the
 * same regardless of database provider.
 */
async function resolveCourseByCode(code: string): Promise<{ id: string; title: string } | null> {
  const needle = code.trim().toLowerCase();
  if (!needle) return null;
  const courses = await prisma.course.findMany({ select: { id: true, title: true, code: true } });
  return courses.find((c) => c.code.toLowerCase() === needle) ?? null;
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
      case 'create_note': {
        const courseCode = args?.courseCode ? String(args.courseCode).trim() : undefined;
        const courseId = courseCode ? (await resolveCourseByCode(courseCode))?.id ?? null : null;
        const courseNotFound = !!courseCode && !courseId;
        const parsed = noteSchema.safeParse({ title: args?.title, content: args?.content, courseId });
        if (!parsed.success) return `Could not save the note: ${parsed.error.issues[0]?.message}`;
        const note = await prisma.note.create({
          data: { title: parsed.data.title, content: parsed.data.content, courseId: parsed.data.courseId ?? null, tags: parsed.data.tags, userId: ctx.userId },
        });
        if (courseNotFound) return `Saved note "${note.title}" (id: ${note.id}), but no course found with code "${courseCode}" so it wasn't filed under a course.`;
        return `Saved note "${note.title}" (id: ${note.id})${courseId ? ` under ${courseCode}` : ''}.`;
      }
      case 'create_flashcard': {
        const courseCode = args?.courseCode ? String(args.courseCode).trim() : undefined;
        const courseId = courseCode ? (await resolveCourseByCode(courseCode))?.id ?? null : null;
        const courseNotFound = !!courseCode && !courseId;
        const parsed = flashcardSchema.safeParse({ front: args?.front, back: args?.back, courseId });
        if (!parsed.success) return `Could not save the flashcard: ${parsed.error.issues[0]?.message}`;
        const card = await prisma.flashcard.create({
          data: { front: parsed.data.front, back: parsed.data.back, courseId: parsed.data.courseId ?? null, userId: ctx.userId },
        });
        if (courseNotFound) return `Saved flashcard (id: ${card.id}), but no course found with code "${courseCode}" so it wasn't filed under a course. Front: "${card.front}"`;
        return `Saved flashcard (id: ${card.id})${courseId ? ` under ${courseCode}` : ''}. Front: "${card.front}"`;
      }
      case 'start_cbt': {
        const courseCode = String(args?.courseCode || '').trim();
        if (!courseCode) return 'No course code provided.';
        const course = await resolveCourseByCode(courseCode);
        if (!course) return `No course found with code "${courseCode}". Ask the student to confirm the exact code.`;
        const mode: 'practice' | 'exam' = args?.mode === 'exam' ? 'exam' : 'practice';
        const count = Math.max(1, Math.min(100, typeof args?.count === 'number' ? args.count : 10));
        const result = await createExamAttempt(ctx.userId, { courseId: course.id, mode, count });
        if (result.ok === false) return `Could not start the session: ${result.error}`;
        return `Started a ${result.mode} session on ${course.title} (${result.count} questions${result.durationSec ? `, ${Math.round(result.durationSec / 60)} min` : ''}). Open it here: [Start ${result.mode}](/cbt/${result.attemptId})`;
      }
      case 'get_account_status': {
        const [user, noteCount, flashcardCount, attemptCount] = await Promise.all([
          prisma.user.findUnique({ where: { id: ctx.userId }, select: { walletBalance: true, subscriptionTier: true, subscriptionExpiry: true } }),
          prisma.note.count({ where: { userId: ctx.userId } }),
          prisma.flashcard.count({ where: { userId: ctx.userId } }),
          prisma.examSession.count({ where: { userId: ctx.userId } }),
        ]);
        if (!user) return 'Could not load account status.';
        const expiry = user.subscriptionExpiry ? ` (expires ${user.subscriptionExpiry.toISOString().slice(0, 10)})` : '';
        return `Wallet balance: ₦${user.walletBalance.toLocaleString('en-NG')}. Plan: ${user.subscriptionTier}${expiry}. Notes saved: ${noteCount}. Flashcards: ${flashcardCount}. CBT attempts: ${attemptCount}.`;
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