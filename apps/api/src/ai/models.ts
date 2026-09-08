/**
 * Which OpenAI model does what.
 *
 * Two tiers, both overridable from the environment so a model can be swapped in
 * production without a rebuild:
 *
 *  - CHAT_MODEL — what the child actually hears. Bobo's replies and the session
 *    opener. Quality matters here more than anywhere else in the app.
 *  - FAST_MODEL — everything that produces JSON for the code, not words for the
 *    child: the safety classifier, memory extraction, interest tagging, photo
 *    labels, song lines, the parent analysis. Cheap and quick is the point.
 *
 * Defaults verified live on 2026-08-25: gpt-5.6-terra answered a child-style
 * prompt in 1.2–1.9 s with `reasoning_effort: 'none'` and matches the flagship
 * on capability at half its price; gpt-4o-mini is what the classifiers were
 * built and tested against, so it stays until each one is re-checked.
 */

export const CHAT_MODEL = env('OPENAI_CHAT_MODEL') ?? 'gpt-5.6-terra';
export const FAST_MODEL = env('OPENAI_FAST_MODEL') ?? 'gpt-4o-mini';
/** Week/curriculum generation — long structured output, runs off the hot path. */
export const GENERATOR_MODEL = env('OPENAI_GENERATOR_MODEL') ?? 'gpt-4o';

function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

/** GPT-5-family models reason by default and reject the legacy token cap. */
export function isReasoningModel(model: string): boolean {
  return /^(gpt-5|o[1-9])/.test(model);
}

/**
 * The output-limit parameters for a given model.
 *
 * GPT-5.x rejects `max_tokens` outright ("Unsupported parameter … use
 * max_completion_tokens instead") and defaults to `reasoning_effort: 'medium'`,
 * which spends seconds thinking before a one-line reply to a seven-year-old.
 * Every call on the child's hot path goes through here so a model swap via env
 * cannot silently break the request shape.
 */
export function completionLimits(
  model: string,
  maxTokens: number,
): { max_tokens: number } | { max_completion_tokens: number; reasoning_effort: 'none' } {
  return isReasoningModel(model)
    ? { max_completion_tokens: maxTokens, reasoning_effort: 'none' }
    : { max_tokens: maxTokens };
}
