/**
 * Real-time child-safety screen — runs on EVERY child turn BEFORE Bobo replies.
 *
 * A fast gpt-4o-mini classifier flags `crisis` (self-harm, abuse, being in danger,
 * serious violence) and lighter `concerning` content (bullying, fear, sadness). On
 * crisis the caller overrides Bobo's normal reply with a calm, safe response that
 * steers the child to a trusted adult (+ a local helpline IF configured) and raises
 * an immediate parent alert. This is independent of the retrospective memory
 * extraction, so a crisis on turn 1 is caught even if the app is closed right after.
 *
 * SAFETY NOTE: AZ_CRISIS_LINE is spoken to a child in crisis, so it may only ever
 * hold a number the founder has personally verified as live. Set to 116 111
 * (Azerbaijan Child Helpline) on 2026-07-07, re-confirmed 2026-09-08. Do not
 * change it from a web search alone — a wrong number here is worse than none.
 */

import { generateBoboReply } from './llm.js';

// Azerbaijan Child Helpline (Uşaq qaynar xətti) — 24/7, free, confidential.
// Verified by founder 2026-07-07. Spoken to the child on a crisis turn.
export const AZ_CRISIS_LINE: string | null = '116 111';

export interface SafetyResult {
  crisis: boolean;
  concerning: boolean;
  category: string;
  /** True when the classifier could not be reached and the deterministic keyword
   *  screen decided instead. Recorded on the alert so triage knows the flag is
   *  lower-confidence — and so a run of these is visible as an outage. */
  degraded?: boolean;
}

const SAFE: SafetyResult = { crisis: false, concerning: false, category: 'none' };

/** Per-attempt cap. Two attempts + the gap stay under ~5s in the worst case, on
 *  top of an STT round trip the child is already waiting through. */
const ATTEMPT_TIMEOUT_MS = 2_000;
const ATTEMPTS = 2;
const RETRY_DELAY_MS = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Deterministic last resort for when the classifier is unreachable.
 *
 * This used to fail open: one OpenAI blip and a child saying "папа меня бьёт" got
 * an ordinary cheerful language-tutor reply and no parent alert. Fail-open is the
 * right default for a *classifier* — never block the conversation — but it is the
 * wrong default for *escalation*, so the two are now separated: the chat always
 * continues, while the highest-signal phrases still raise an alert with no model
 * in the loop.
 *
 * Patterns are deliberately narrow and multi-word. A false positive costs one
 * neutral email; over-matching ordinary kid talk ("я убил босса в игре") would
 * train parents to ignore the alert, which costs far more. Only en/ru — Deepgram
 * runs strict single-language STT for the lesson language, so an az transcript
 * never reaches here in az.
 */
// NOTE on word boundaries: JS `\b` is defined over [A-Za-z0-9_], so /\bпапа/ does
// NOT match "папа меня бьёт" — there is no \w before the 'п', hence no boundary.
// Every Cyrillic pattern written that way would silently never fire. `w()` wraps a
// pattern in Unicode-aware lookarounds instead, which work for both alphabets.
const w = (body: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`, 'iu');

const CRISIS_PATTERNS: RegExp[] = [
  // self-harm / suicide
  w(String.raw`(?:kill|hurt|cut)\s+my\s?self`),
  w(String.raw`(?:want|wanna|going)\s+to\s+die`),
  w(String.raw`i\s+(?:want|wanna)\s+to\s+kill`),
  w(String.raw`suicide`),
  w(String.raw`(?:не\s+хочу|надоело)\s+жить`),
  w(String.raw`хочу\s+(?:умереть|сдохнуть)`),
  w(String.raw`(?:убить|порезать|резать)\s+себя`),
  w(String.raw`покончить\s+с\s+собой`),
  // being hurt by someone
  w(String.raw`(?:dad|mom|father|mother|he|she|they)\s+(?:hits|beats|hurts)\s+me`),
  w(String.raw`(?:hits|beats)\s+me\s+(?:every|all|when)`),
  w(String.raw`(?:папа|мама|отчим|брат|он|она)\s+(?:меня\s+)?(?:бьёт|бьет|избивает)`),
  w(String.raw`меня\s+(?:бьют|бьёт|бьет|избивают)`),
  // sexual abuse
  w(String.raw`touch(?:es|ed)?\s+me\s+(?:there|down|private)`),
  w(String.raw`трогает\s+меня\s+(?:там|внизу)`),
];

export function keywordCrisisScreen(text: string): boolean {
  return CRISIS_PATTERNS.some((re) => re.test(text));
}

export async function screenChildMessage(
  text: string,
  language: 'en' | 'ru',
): Promise<SafetyResult> {
  const t = text.trim();
  if (t.length < 2) return SAFE;

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      return await classify(t);
    } catch (e) {
      lastError = e;
      if (attempt < ATTEMPTS) await sleep(RETRY_DELAY_MS);
    }
  }

  // Classifier unreachable. Keep the conversation going (Хани's own system prompt
  // still carries the safety rails) but do not silently drop escalation.
  console.error('[safety] classifier unavailable after retries:', lastError);
  if (keywordCrisisScreen(t)) {
    console.warn('[safety] keyword fallback flagged a crisis while the classifier was down');
    return { crisis: true, concerning: true, category: 'keyword_fallback', degraded: true };
  }
  return { ...SAFE, degraded: true };
}

async function classify(t: string): Promise<SafetyResult> {
  const result = await generateBoboReply({
    tier: 'fast',
    timeoutMs: ATTEMPT_TIMEOUT_MS,
    maxTokens: 60,
    systemPrompt: `You are a child-safety classifier for a children's language app. Classify the child's latest message. Return ONLY JSON: {"crisis": boolean, "concerning": boolean, "category": "self_harm|abuse|violence|bullying|fear|sadness|none|other"}.
- crisis=true ONLY for: self-harm or suicide, abuse, being hurt or in danger, serious violence.
- concerning=true for: bullying, strong fear, persistent sadness, frightening situations.
- Otherwise both false, category "none". Stay calm and precise — do NOT over-flag ordinary kid talk (games, cartoons, "I'm tired", pretend play).`,
    history: [],
    childMessage: t,
  });
  const raw = result.text.replace(/```json\n?|\n?```/g, '').trim();
  const parsed = JSON.parse(raw) as Partial<SafetyResult>;
  return {
    crisis: !!parsed.crisis,
    concerning: !!parsed.concerning,
    category: typeof parsed.category === 'string' ? parsed.category : 'other',
  };
}

/** Calm, non-probing safe reply used when a crisis is detected. */
export function safeCrisisReply(language: 'en' | 'ru'): string {
  const line = AZ_CRISIS_LINE;
  if (language === 'en') {
    return `That sounds really important, and I'm glad you told me. I'm just a little AI bear 🐻 — please talk to a parent or a grown-up you trust about this right now.${line ? ` You can also call ${line}.` : ''} You're not alone. 💛`;
  }
  return `Это очень важно, и хорошо, что ты сказал мне. Я всего лишь маленький ИИ-медвежонок 🐻 — пожалуйста, прямо сейчас расскажи об этом родителям или взрослому, которому доверяешь.${line ? ` Ещё можно позвонить ${line}.` : ''} Ты не один. 💛`;
}
