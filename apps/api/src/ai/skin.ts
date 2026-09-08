import OpenAI from 'openai';
import { z } from 'zod';

import { aiEnv } from './env.js';
import type { LessonContent, LessonPrefs } from '../db/schema.js';
import { FAST_MODEL, completionLimits } from './models.js';
import { trackLlmUsage } from '../services/spend.js';

let cached: OpenAI | null = null;
function client(): OpenAI {
  if (!cached) cached = new OpenAI({ apiKey: aiEnv.openaiKey });
  return cached;
}

// A rewrite, not a generation — gpt-4o-mini is fast + cheap + good enough.
const MODEL = FAST_MODEL;

// ── What the skinner is allowed to change ────────────────────────────────────
//
// SKELETON (kept verbatim from the template — NEVER touched here):
//   theme, themeEmoji, vocabulary, wordGame, grammar, reward.stars
// SKIN (re-themed around the child's interests):
//   story (the 3 scenes the child reads), talkSystemPrompt (how Bobo frames it),
//   reward.message (the celebratory line).
//
// Keeping vocabulary + exercises identical means ZERO pedagogical risk: the same
// words and the same grammar are taught — only the wrapping story changes so it
// feels made for this specific child ("red like your dinosaur").

// Lenient on shape (mini occasionally returns 2 or 4 scenes, or an extra field) so
// a near-miss isn't thrown away — we normalize to a clean 3-scene story afterwards.
const SkinSchema = z.object({
  story: z
    .array(
      z.object({
        text: z.string().min(2).max(200),
        emoji: z.string().min(1).max(12),
      }),
    )
    .min(2)
    .max(5),
  talkSystemPrompt: z.string().min(40).max(2000),
  rewardMessage: z.string().min(2).max(200),
});

export type SkinResult = z.infer<typeof SkinSchema>;

// Parent "dials" steer the skin on top of interests (stored as children.lessonPrefs).
export type SkinDirectives = LessonPrefs;

export interface SkinInput {
  base: LessonContent;
  interests: string[];
  language: 'en' | 'ru';
  childName?: string;
  directives?: SkinDirectives;
}

function buildSkinPrompt(input: SkinInput): string {
  const lang = input.language === 'ru' ? 'Russian' : 'English';
  const name = input.childName?.trim() || (input.language === 'ru' ? 'ребёнок' : 'the child');
  const likes = input.interests.join(', ');
  const d = input.directives ?? {};
  const dialLines = [
    d.moreTalk
      ? '- The family asked for MORE conversation: make talkSystemPrompt invite a longer, chattier back-and-forth.'
      : '',
    d.moreWords
      ? '- The family asked for MORE words: the story may naturally include a couple of extra interest-related words (still simple, still themed).'
      : '',
    d.difficulty === 'easier'
      ? '- The family asked for it to be EASIER: keep story sentences extra short and simple (do NOT remove the vocabulary words).'
      : '',
    d.difficulty === 'harder'
      ? '- The family asked for it to be HARDER: the story sentences may be a little longer and richer (still age-appropriate, same vocabulary).'
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  return `You personalize a children's language lesson so it feels made for one specific child — WITHOUT changing what is taught.

THE LESSON (keep its learning goal exactly):
- Theme: ${input.base.theme}
- Vocabulary being taught (DO NOT change these words, the lesson must still teach exactly them): ${input.base.vocabulary.join(', ')}
- Original story (for reference): ${input.base.story.map((s) => s.text).join(' / ')}

THE CHILD (${name}) LOVES: ${likes}

YOUR JOB — rewrite ONLY the wrapper so it connects to what ${name} loves:
1. "story": exactly 3 short ${lang} scenes. Re-tell the SAME theme ("${input.base.theme}") but weave in ${name}'s interests (${likes}). Still naturally feature the vocabulary words. Each scene = one short ${lang} sentence (age 4-9) + one emoji.
2. "talkSystemPrompt": a 2-4 sentence instruction (written TO Bobo, "You are Bobo...") in ${lang}, telling Bobo to chat about this theme while hooking the child's interests (${likes}) and encouraging the vocabulary.
3. "rewardMessage": one warm celebratory ${lang} sentence that references the interest.
${dialLines ? `\nEXTRA FAMILY REQUESTS:\n${dialLines}\n` : ''}
RULES:
- Keep the SAME theme and the SAME vocabulary. You are re-skinning, not replacing the lesson.
- All text in ${lang}. Simple, warm, age-appropriate.
- Output STRICT JSON only, no markdown fences, no prose:
{
  "story": [{ "text": "...", "emoji": "..." }, { "text": "...", "emoji": "..." }, { "text": "...", "emoji": "..." }],
  "talkSystemPrompt": "...",
  "rewardMessage": "..."
}`;
}

// Normalize the model's story to exactly 3 clean scenes: drop malformed ones,
// then pad from the template if the model returned too few. Never fewer than the
// template's scene count, never more than 3.
function normalizeStory(
  scenes: SkinResult['story'],
  base: LessonContent,
): LessonContent['story'] {
  const clean = scenes.filter((s) => s.text?.trim() && s.emoji?.trim());
  if (clean.length >= 3) return clean.slice(0, 3);
  // Top up missing scenes from the original template so the lesson is never short.
  const padded = [...clean];
  for (const t of base.story) {
    if (padded.length >= base.story.length || padded.length >= 3) break;
    padded.push(t);
  }
  return padded.length > 0 ? padded : base.story;
}

async function callSkin(prompt: string): Promise<SkinResult> {
  const response = await client().chat.completions.create({
    model: MODEL,
    ...completionLimits(MODEL, 1200),
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You adapt children\'s lessons to a child\'s interests without changing what is taught. Output strict valid JSON only. The "story" MUST be an array of exactly 3 objects, each with a non-empty "text" and a single "emoji".',
      },
      { role: 'user', content: prompt },
    ],
  });

  trackLlmUsage(MODEL, response.usage);
  const raw = response.choices[0]?.message?.content?.trim() ?? '{}';
  const parsed: unknown = JSON.parse(raw); // throws → caller retries
  const validated = SkinSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`skin_schema_mismatch: ${validated.error.message.slice(0, 200)}`);
  }
  return validated.data;
}

/**
 * Re-theme a template lesson around a child's interests, keeping the pedagogical
 * skeleton (theme + vocabulary + exercises) identical. Returns the full, merged
 * LessonContent ready to store/serve. Retries once on a malformed LLM response
 * (mini occasionally returns a bad shape); throws only if both attempts fail, so
 * callers fall back to the untouched template — a failed skin never breaks a lesson.
 */
export async function skinLesson(input: SkinInput): Promise<LessonContent> {
  const prompt = buildSkinPrompt(input);

  let skin: SkinResult;
  try {
    skin = await callSkin(prompt);
  } catch {
    skin = await callSkin(prompt); // one retry — usually succeeds on a fresh sample
  }

  // Merge: keep the whole template, swap ONLY the re-skinnable surface.
  return {
    ...input.base,
    story: normalizeStory(skin.story, input.base),
    talkSystemPrompt: skin.talkSystemPrompt,
    reward: { ...input.base.reward, message: skin.rewardMessage },
  };
}

export const SKIN_MODEL = MODEL;
