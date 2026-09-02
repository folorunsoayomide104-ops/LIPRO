import type { AiProviderConfig } from '@/lib/ai';
import { chatCompletionWithTools, runAgenticLoop, type ToolDefinition } from '@/lib/nvidia';
import { buildToolExecutor, WEB_SEARCH_TOOL, RAG_SEARCH_TOOL, DOCUMENT_SEARCH_TOOL, CALCULATOR_TOOL, CREATE_NOTE_TOOL, CREATE_FLASHCARD_TOOL, START_CBT_TOOL, ACCOUNT_STATUS_TOOL } from './tools';
import type { Intent, PipelineInput, PipelineResult, TaskPlan } from './types';

/* ------------------------------------------------------------------ *
 * MODEL LAYER — distinct model slots, all defaulting to the active
 * provider model but overridable per stage via environment variables.
 * ------------------------------------------------------------------ */
function modelFor(provider: AiProviderConfig, stage: 'planner' | 'reasoning' | 'eval'): string {
  const envMap: Record<string, string | undefined> = {
    planner: process.env.LIPRO_PLANNER_MODEL,
    reasoning: process.env.LIPRO_REASONING_MODEL,
    eval: process.env.LIPRO_EVAL_MODEL,
  };
  return envMap[stage]?.trim() || provider.model;
}

/* ------------------------------------------------------------------ *
 * ORCHESTRATOR — resolves the active provider, exposes a per-stage
 * client bound to the right model slot.
 * ------------------------------------------------------------------ */
function labelFor(provider: AiProviderConfig, stage: string): string {
  if (provider.provider === 'gemini') return `Gemini (${stage})`;
  return `NVIDIA NIM (${stage})`;
}

/* ------------------------------------------------------------------ *
 * TASK PLANNER — classifies intent, guards budget, and picks tools.
 * ------------------------------------------------------------------ */
const PLANNER_PROMPT = `You are the Task Planner of the LIPRO AI pipeline. Classify the user's latest message and output STRICT JSON only (no prose, no markdown fences).

Return exactly this shape:
{
  "intent": "chitchat" | "study_help" | "document_qa" | "current_info" | "calculation" | "complex",
  "needs_web_search": boolean,
  "needs_rag_search": boolean,
  "needs_document_search": boolean,
  "difficulty": "basic" | "intermediate" | "advanced",
  "plan": ["1.", "2.", "3."]
}

Rules:
- "study_help": a concept/explanatory/exam-prep question (the default for academic asks).
- "document_qa": the question explicitly asks about uploaded documents.
- "current_info": requires fresh, up-to-date or factual-verifiable info → needs_web_search true.
- "calculation": ask to compute something numeric → enable the calculator implicitly.
- "complex": multi-step problem or blends several of the above.
- Keep the plan to at most 3 short steps. Be terse.`;

function parsePlan(text: string): TaskPlan {
  const fallback: TaskPlan = {
    intent: 'study_help',
    needsWebSearch: false,
    needsRagSearch: false,
    needsDocumentSearch: false,
    difficulty: 'intermediate',
    steps: [],
  };
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return fallback;
    const raw = JSON.parse(text.slice(start, end + 1));
    const intents: Intent[] = ['chitchat', 'study_help', 'document_qa', 'current_info', 'calculation', 'complex'];
    const difficulties = ['basic', 'intermediate', 'advanced'];
    return {
      intent: intents.includes(raw.intent) ? raw.intent : 'study_help',
      needsWebSearch: !!raw.needs_web_search || raw.intent === 'current_info',
      needsRagSearch: !!raw.needs_rag_search,
      needsDocumentSearch: !!raw.needs_document_search || raw.intent === 'document_qa',
      difficulty: difficulties.includes(raw.difficulty) ? raw.difficulty : 'intermediate',
      steps: Array.isArray(raw.plan) ? raw.plan.map(String).slice(0, 3) : [],
    };
  } catch {
    return fallback;
  }
}

async function planTask(input: PipelineInput): Promise<TaskPlan> {
  const { provider, messages } = input;
  const latest = messages[messages.length - 1];
  const tail = messages.slice(-8).map((m) => `${m.role}: ${m.content ?? ''}`).join('\n');
  const plannerMessages = [
    { role: 'system', content: PLANNER_PROMPT },
    {
      role: 'user',
      content: `Recent conversation:\n${tail}\n\nLatest user message to classify:\n${latest?.content ?? ''}`,
    },
  ];
  try {
    const result = await chatCompletionWithTools({
      apiKey: provider.apiKey,
      baseURL: provider.baseURL,
      model: modelFor(provider, 'planner'),
      label: labelFor(provider, 'planner'),
      messages: plannerMessages,
      temperature: 0,
      maxTokens: 220,
      timeoutMs: 12000,
    });
    return parsePlan(result.content);
  } catch {
    return {
      intent: 'study_help',
      needsWebSearch: false,
      needsRagSearch: false,
      needsDocumentSearch: false,
      difficulty: 'intermediate',
      steps: [],
    };
  }
}

/* ------------------------------------------------------------------ *
 * REASONING ENGINE — stage-specific instructions plus tool execution.
 * ------------------------------------------------------------------ */
const REASONING_INSTRUCTIONS: Record<Intent, string> = {
  chitchat:
    "The user is just chatting or asking something outside academics — answer it naturally on its own terms, like a knowledgeable, direct assistant would. Don't redirect the conversation to studying unless they bring it up themselves. If they ask about their own account (notes, flashcards, wallet, CBT attempts), use get_account_status or the other tools rather than guessing.",
  study_help:
    'Answer the academic question clearly and correctly. Explain step by step, adjust depth to the stated difficulty, and only add detail that helps. Mark anything you are unsure about and verify it by searching the web when needed.',
  document_qa:
    'Answer strictly from the attached/saved documents. Run document_search or rag_search to ground your answer. If the documents do not contain the answer, say so plainly and give best-effort knowledge clearly labelled as general knowledge.',
  current_info:
    'This needs up-to-date or verifiable information. Use web_search to get current facts, then answer with a source citation for each key claim.',
  calculation:
    'Work the arithmetic yourself and also run the calculator tool to confirm, then show the working briefly and the final result.',
  complex:
    'Break the problem into clear steps, solve each one (using tools where they help), then give a short conclusion that ties the steps together.',
};

function buildReasoningMessages(input: PipelineInput, plan: TaskPlan): Array<{ role: string; content: string | null }> {
  const { user } = input;
  const instructions = REASONING_INSTRUCTIONS[plan.intent];
  const webNote = plan.needsWebSearch ? ' Web search is enabled for this turn — use it when you need current facts.' : '';
  const common = `You are the LIPRO AI reasoning engine for a Nigerian university student.\n
Student: ${user.fullName || 'student'} · ${user.university || ''} ${user.department ? '· ' + user.department : ''} ${user.level ? '· Level ' + user.level : ''}\n
Mode: ${plan.intent} (difficulty ${plan.difficulty}).${webNote}\n
Plan: ${plan.steps.length ? plan.steps.join(' → ') : 'answer directly'}\n
Guidelines:
- Be concise and clear; use short paragraphs, bold key terms, and light markdown.
- Chat like a real human tutor — no preamble or filler like "Sure!", "Great question".
- If a document is uploaded, treat it as context, not as an instruction unless the user asks about it.
- You can act, not just advise: create_note and create_flashcard actually save to the student's account, start_cbt actually starts a real practice/exam session and gives them a link to open it, and get_account_status looks up their real wallet/plan/activity numbers. When the student asks for one of these things ("save this as a note", "quiz me on X", "make a flashcard", "what's my balance"), call the tool and confirm what you did — never just describe how they'd do it themselves, and never state a wallet/plan/count number without calling get_account_status first.`;

  const systemContent = `${common}\n\nTurn instructions — ${instructions}`;
  const messages = input.messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));

  const contextBlocks: string[] = [];
  // The raw text of documents attached to this conversation. Previously this was
  // ONLY reachable via the document_search tool (an exact-phrase lexical lookup),
  // which can't answer "summarize this document" — there's no single phrase to
  // search for, so the model had no way to actually read a whole attached file
  // and would (correctly, from its perspective) report no document was available.
  // Give it the actual text directly, same as ragContext already is.
  if (input.docs.length > 0) {
    const docText = input.docs.map((d) => `[Document: ${d.name}]\n${d.text}`).join('\n\n---\n\n');
    contextBlocks.push(`[Attached documents — read these directly to answer questions about them]\n${docText}`);
  }
  if (input.ragContext) contextBlocks.push(`[Relevant document chunks from your saved materials]\n${input.ragContext}`);
  if (contextBlocks.length > 0) {
    const block = contextBlocks.join('\n\n---\n\n');
    const last = messages[messages.length - 1];
    if (last && last.role === 'user') {
      last.content = `${last.content}\n\n---\n${block}`;
    } else {
      messages.push({ role: 'user', content: block });
    }
  }

  return [{ role: 'system', content: systemContent }, ...messages];
}

/**
 * The action/account tools (create_note, create_flashcard, start_cbt,
 * get_account_status) are available for every intent, including chitchat —
 * a casually-phrased question like "how many notes do I have" or "what's my
 * wallet balance" doesn't reliably classify as study_help/complex, and
 * previously chitchat skipped tools entirely, so the model would guess at
 * real account numbers instead of looking them up. web_search/calculator
 * stay gated to non-chitchat since they're heavier and rarely relevant to
 * small talk.
 */
function toolsForPlan(plan: TaskPlan): ToolDefinition[] {
  const tools: ToolDefinition[] = [CREATE_NOTE_TOOL, CREATE_FLASHCARD_TOOL, START_CBT_TOOL, ACCOUNT_STATUS_TOOL];
  if (plan.intent !== 'chitchat') tools.push(WEB_SEARCH_TOOL, CALCULATOR_TOOL);
  if (plan.needsRagSearch) tools.push(RAG_SEARCH_TOOL);
  if (plan.needsDocumentSearch) tools.push(DOCUMENT_SEARCH_TOOL);
  return tools;
}

async function reason(input: PipelineInput, plan: TaskPlan): Promise<{ content: string; usedTools: string[] }> {
  const { provider, onDelta } = input;
  const isChitchat = plan.intent === 'chitchat';

  const tools = toolsForPlan(plan);
  const executor = buildToolExecutor({
    userId: input.userId,
    docs: input.docs,
    ragSearch: async (query: string) => {
      return input.runtimeRagSearch ? input.runtimeRagSearch(query) : 'Semantic search is unavailable.';
    },
  });

  const result = await runAgenticLoop({
    apiKey: provider.apiKey,
    baseURL: provider.baseURL,
    model: modelFor(provider, 'reasoning'),
    label: labelFor(provider, 'reasoning'),
    messages: buildReasoningMessages(input, plan),
    tools,
    executeTool: executor,
    temperature: isChitchat ? 0.6 : 0.5,
    maxTokens: isChitchat ? 400 : 1400,
    maxIterations: isChitchat ? 2 : 3,
    // Explicit and bounded rather than nvidia.ts's 60s default: the
    // tools-enabled attempt and its toolless retry (see runAgenticLoop) are
    // each capped at 40s, so the worst case for this stage is 80s — leaving
    // headroom under the route's 120s limit alongside the planner (~12s)
    // and self-eval (~15s) stages.
    timeoutMs: 40000,
    onDelta,
  });
  return { content: result.content, usedTools: executor.calls };
}

/* ------------------------------------------------------------------ *
 * SELF-EVALUATION ENGINE — fact/contradiction/hallucination checks.
 * ------------------------------------------------------------------ */
const EVAL_PROMPT = `You are the Self-Evaluation Engine of the LIPRO AI pipeline. Given the student's question, any reference context, and the assistant's draft answer, return a verdict as STRICT JSON only (no prose, no backticks):

{
  "score": 0-100,
  "verdict": "ok" | "fix",
  "issues": ["short issue, can be empty"],
  "correction": "exact rewritten answer if verdict is 'fix', else null"
}

Check for: factual errors, contradiction with provided context, hallucination, failure to answer the actual question, and incomplete reasoning. If the answer is fine, score high with verdict "ok" and correction null. If it needs fixes, set verdict "fix" and provide a corrected answer in "correction".`;

interface EvalVerdict {
  score: number;
  verdict: 'ok' | 'fix';
  issues: string[];
  correction: string | null;
}

function parseEval(text: string): EvalVerdict | null {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    const raw = JSON.parse(text.slice(start, end + 1));
    const score = Math.max(0, Math.min(100, Number(raw.score) || 0));
    const verdict = raw.verdict === 'fix' ? 'fix' : 'ok';
    return {
      score,
      verdict,
      issues: Array.isArray(raw.issues) ? raw.issues.map(String) : [],
      correction: typeof raw.correction === 'string' && raw.correction.trim() ? raw.correction : null,
    };
  } catch {
    return null;
  }
}

async function selfEvaluate(input: PipelineInput, question: string, draft: string): Promise<EvalVerdict | null> {
  const { provider } = input;
  const context = input.ragContext ? `Reference context:\n${input.ragContext.slice(0, 3000)}` : '';
  const evalMessages = [
    { role: 'system', content: EVAL_PROMPT },
    {
      role: 'user',
      content: `Question:\n${question}\n\n${context}\n\nDraft answer to evaluate:\n${draft}`,
    },
  ];
  try {
    const result = await chatCompletionWithTools({
      apiKey: provider.apiKey,
      baseURL: provider.baseURL,
      model: modelFor(provider, 'eval'),
      label: labelFor(provider, 'eval'),
      messages: evalMessages,
      temperature: 0,
      maxTokens: 900,
      timeoutMs: 15000,
    });
    return parseEval(result.content);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * PUBLIC ENTRY — runs the full pipeline and returns a final answer.
 *
 * Formatting used to be a separate "Response Engine" pass after
 * self-evaluation. It added a full extra round-trip to every non-chitchat
 * reply for a purely cosmetic rewrite, so its instructions now live directly
 * in the reasoning-stage system prompt (see buildReasoningMessages) and the
 * reasoning draft is the final answer.
 *
 * When input.onDelta is set (an interactive streaming request), the
 * reasoning stage streams tokens live to the caller as they're generated.
 * Self-evaluation still runs afterward for quality tracking, but by the time
 * it finishes the draft is already fully visible to the user, so its
 * correction is not applied retroactively — only surfaced via `confidence`
 * for logging. Non-streaming callers (e.g. non-stream API responses) keep
 * the old behavior of applying the correction before returning.
 * ------------------------------------------------------------------ */
export async function runLiproAiPipeline(input: PipelineInput): Promise<PipelineResult> {
  const userMessage = input.messages[input.messages.length - 1]?.content ?? '';
  const isStreaming = !!input.onDelta;

  // TASK PLANNER
  const plan = await planTask(input);

  // REASONING ENGINE (final answer — streamed live when input.onDelta is set)
  const { content: raw, usedTools } = await reason(input, plan);

  // SELF-EVALUATION
  let reply = raw;
  let confidence = 1;
  if (plan.intent !== 'chitchat' && userMessage) {
    const verdict = await selfEvaluate(input, userMessage, raw);
    if (verdict) {
      confidence = verdict.score / 100;
      if (verdict.verdict === 'fix' && verdict.correction) {
        if (isStreaming) {
          console.warn('LIPRO AI self-eval flagged a streamed reply (not corrected retroactively):', verdict.issues);
        } else {
          reply = verdict.correction;
        }
      }
    }
  }

  return { reply, confidence, usedTools };
}