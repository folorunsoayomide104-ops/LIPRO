import type { AiProviderConfig } from '@/lib/ai';

export type PipelineRole = 'system' | 'user' | 'assistant' | 'tool';

export interface PipelineMessage {
  role: string;
  content: string | null;
}

export interface PipelineDoc {
  name: string;
  text: string;
}

export interface PipelineUser {
  fullName: string;
  university: string;
  department: string;
  level: string;
  role: string;
}

export interface PipelineInput {
  userId: string;
  user: PipelineUser;
  provider: AiProviderConfig;
  messages: PipelineMessage[];
  docs: PipelineDoc[];
  ragContext: string;
  /** Optional live semantic-search callback provided by the route. */
  runtimeRagSearch?: (query: string) => Promise<string>;
}

export type Intent = 'chitchat' | 'study_help' | 'document_qa' | 'current_info' | 'calculation' | 'complex';

export interface TaskPlan {
  intent: Intent;
  needsWebSearch: boolean;
  needsRagSearch: boolean;
  needsDocumentSearch: boolean;
  difficulty: 'basic' | 'intermediate' | 'advanced';
  steps: string[];
}

export interface PipelineResult {
  reply: string;
  confidence: number;
  usedTools: string[];
  usedFallback: boolean;
}