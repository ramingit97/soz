import OpenAI from 'openai';

import { llmCost } from './cost.js';
import { aiEnv } from './env.js';
import { CHAT_MODEL, FAST_MODEL, completionLimits } from './models.js';
import { recordSpend } from '../services/spend.js';

let cached: OpenAI | null = null;
function client(): OpenAI {
  if (!cached) cached = new OpenAI({ apiKey: aiEnv.openaiKey });
  return cached;
}

export interface ConversationTurn {
  role: 'child' | 'bobo';
  text: string;
}

export interface LLMResponse {
  text: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  /** Input tokens served from the prompt cache (billed at the cached rate). */
  cachedTokens: number;
  /** The model that actually answered — for cost attribution. */
  model: string;
  /** Estimated cost of this call in USD. */
  usd: number;
}

export async function generateBoboReply(args: {
  systemPrompt: string;
  history: ConversationTurn[];
  childMessage: string;
  /**
   * Optional system instruction injected AFTER the child's message — the
   * strongest position for a chat model, which otherwise favors whatever rule
   * came last in a long system prompt. Used for must-obey turn commands
   * (e.g. "time is up — wrap up now").
   */
  postInstruction?: string;
  /**
   * Abort the request after this long. The OpenAI SDK defaults to a 10-minute
   * timeout, which is fine for a background job and completely wrong for anything
   * a child is waiting on — the safety screen runs BEFORE Хани replies, so a
   * stalled request there freezes the conversation. Callers on the hot path
   * should always set this.
   */
  timeoutMs?: number;
  /** Override the 200-token reply cap (classifiers need far fewer). */
  maxTokens?: number;
  /**
   * 'chat' (default) — words the child will hear; the strong model.
   * 'fast' — JSON for the code (safety screen, memory extraction); the cheap one.
   */
  tier?: 'chat' | 'fast';
}): Promise<LLMResponse> {
  const start = Date.now();
  const model = args.tier === 'fast' ? FAST_MODEL : CHAT_MODEL;

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: args.systemPrompt },
    ...args.history.map<OpenAI.ChatCompletionMessageParam>((t) => ({
      role: t.role === 'child' ? 'user' : 'assistant',
      content: t.text,
    })),
    { role: 'user', content: args.childMessage },
    ...(args.postInstruction
      ? [{ role: 'system', content: args.postInstruction } as OpenAI.ChatCompletionMessageParam]
      : []),
  ];

  const response = await client().chat.completions.create(
    {
      model,
      ...completionLimits(model, args.maxTokens ?? 200),
      messages,
    },
    args.timeoutMs ? { timeout: args.timeoutMs } : undefined,
  );

  const text = response.choices[0]?.message?.content?.trim() ?? '';
  const usage = {
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
    cachedTokens: response.usage?.prompt_tokens_details?.cached_tokens ?? 0,
  };
  const usd = llmCost(model, usage);
  recordSpend('llm', usd, model);

  return {
    text,
    durationMs: Date.now() - start,
    ...usage,
    model,
    usd,
  };
}
