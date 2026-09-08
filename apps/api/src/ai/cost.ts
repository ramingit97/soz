/**
 * Per-call cost estimation. Feeds the daily spend counter (services/spend.ts)
 * and the per-turn `cost` block in the /talk response.
 *
 * Prices verified against the providers' public pages on 2026-08-25. An unknown
 * model falls back to the most expensive tier we use, so a typo in
 * OPENAI_CHAT_MODEL over-counts instead of under-counting.
 *
 * History: this file priced "Haiku" at $1/$5 while the code called gpt-4o-mini
 * at $0.15/$0.60 — a 7× overstatement that nobody noticed because the number was
 * returned to the client and never summed anywhere.
 */

interface TokenPrice {
  /** USD per 1M input tokens */
  input: number;
  /** USD per 1M cached input tokens (prompt caching). */
  cached: number;
  /** USD per 1M output tokens */
  output: number;
}

const TOKEN_PRICES: Record<string, TokenPrice> = {
  'gpt-5.6-sol': { input: 4.0, cached: 0.4, output: 20.0 },
  'gpt-5.6-terra': { input: 2.0, cached: 0.2, output: 12.0 },
  'gpt-5.6-luna': { input: 0.2, cached: 0.02, output: 1.2 },
  'gpt-5-mini': { input: 0.25, cached: 0.025, output: 2.0 },
  'gpt-5-nano': { input: 0.05, cached: 0.005, output: 0.4 },
  'gpt-4.1': { input: 2.0, cached: 0.5, output: 8.0 },
  'gpt-4.1-mini': { input: 0.4, cached: 0.1, output: 1.6 },
  'gpt-4o': { input: 2.5, cached: 1.25, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, cached: 0.075, output: 0.6 },
};

const FALLBACK_PRICE: TokenPrice = TOKEN_PRICES['gpt-5.6-sol']!;

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  /** Portion of inputTokens served from the prompt cache. */
  cachedTokens?: number;
}

export function llmCost(model: string, usage: LlmUsage): number {
  const p = TOKEN_PRICES[model] ?? FALLBACK_PRICE;
  const cached = Math.min(usage.cachedTokens ?? 0, usage.inputTokens);
  const fresh = usage.inputTokens - cached;
  return (
    (fresh / 1_000_000) * p.input +
    (cached / 1_000_000) * p.cached +
    (usage.outputTokens / 1_000_000) * p.output
  );
}

// Deepgram Nova-3, pre-recorded, single language (stt.ts runs strict per-language
// calls). Multilingual would be $0.0052.
const DEEPGRAM_NOVA3_PER_MIN_USD = 0.0043;
// OpenAI gpt-4o-mini-transcribe (the fallback path in stt.ts).
const OPENAI_MINI_TRANSCRIBE_PER_MIN_USD = 0.003;

export function sttCost(audioMs: number, provider: 'deepgram' | 'openai' = 'deepgram'): number {
  const perMin =
    provider === 'openai' ? OPENAI_MINI_TRANSCRIBE_PER_MIN_USD : DEEPGRAM_NOVA3_PER_MIN_USD;
  return (audioMs / 60_000) * perMin;
}

// ElevenLabs Flash/Turbo on the developer (pay-as-you-go) plans. The old value
// here, $0.18, was 3.6× too high.
const ELEVENLABS_FLASH_PER_1K_CHARS_USD = 0.05;
// OpenAI tts-1: $15 per 1M characters.
const OPENAI_TTS1_PER_1K_CHARS_USD = 0.015;

export function ttsCost(
  charCount: number,
  provider: 'elevenlabs' | 'openai' = 'elevenlabs',
): number {
  const per1k =
    provider === 'openai' ? OPENAI_TTS1_PER_1K_CHARS_USD : ELEVENLABS_FLASH_PER_1K_CHARS_USD;
  return (charCount / 1000) * per1k;
}

export function isKnownModel(model: string): boolean {
  return model in TOKEN_PRICES;
}
