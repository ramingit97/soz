/**
 * /photo-learn — child takes a photo, GPT-4o Vision returns 3-5 vocab words
 * in the target language with translations and short example phrases.
 */

import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import OpenAI from 'openai';
import { z } from 'zod';

import { requireAuth } from '../auth/middleware.js';
import { aiEnv } from '../ai/env.js';
import { trackLlmUsage } from '../services/spend.js';
import { FAST_MODEL, completionLimits } from '../ai/models.js';

export const photoLearnRoute = new Hono();
photoLearnRoute.use('*', requireAuth);

const photoLearnSchema = z.object({
  imageBase64: z.string().min(100),
  imageMimeType: z.string().default('image/jpeg'),
  /** Language the child is learning */
  targetLanguage: z.enum(['en', 'ru']),
  /** Parent UI language for translations the child can read */
  uiLanguage: z.enum(['ru', 'az']).default('ru'),
  /** Child's level so the words match what they can read */
  level: z.enum(['beginner', 'elementary', 'pre_intermediate', 'intermediate']).default('beginner'),
});

export interface PhotoLearnItem {
  word: string;           // word in target language
  translation: string;    // translation in UI language
  example: string;        // short example sentence in target language
  emoji: string;          // representative emoji
}

export interface PhotoLearnResponse {
  items: PhotoLearnItem[];
  summary: string;        // 1-sentence description of what's in the photo
}

let cached: OpenAI | null = null;
function openai(): OpenAI {
  if (!cached) cached = new OpenAI({ apiKey: aiEnv.openaiKey });
  return cached;
}

photoLearnRoute.post('/', zValidator('json', photoLearnSchema), async (c) => {
  const body = c.req.valid('json');

  const targetName = body.targetLanguage === 'en' ? 'English' : 'Russian';
  const uiName = body.uiLanguage === 'az' ? 'Azerbaijani' : 'Russian';
  const ageNote = body.level === 'beginner' ? 'very simple, single-word concrete nouns'
    : body.level === 'elementary' ? 'simple nouns and a few common verbs/adjectives'
    : 'a mix of nouns, verbs, and adjectives suitable for elementary-school kids';

  const systemPrompt = `You are Bobo, a friendly language tutor for kids aged 5-12. The child shows you a photo of their surroundings. Return 3-5 vocabulary items in ${targetName} for things visible in the photo, with translations in ${uiName}.

Prefer ${ageNote}. Avoid abstract or rare words. Each example sentence must be 3-7 words, simple grammar, present tense.

Respond ONLY with strict JSON in this exact shape:
{
  "summary": "one short sentence in ${uiName} describing the photo",
  "items": [
    { "word": "...", "translation": "...", "example": "...", "emoji": "🍎" }
  ]
}

Rules:
- 3 to 5 items only.
- All "word" and "example" fields in ${targetName}.
- All "translation" and "summary" fields in ${uiName}.
- "emoji" is one Unicode emoji representing the word.
- No markdown fences, no extra prose.`;

  try {
    const completion = await openai().chat.completions.create({
      model: FAST_MODEL,
      ...completionLimits(FAST_MODEL, 600),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Look at this photo and pick the most useful ${targetName} words for me to learn.` },
            {
              type: 'image_url',
              image_url: {
                url: `data:${body.imageMimeType};base64,${body.imageBase64}`,
                detail: 'low',
              },
            },
          ],
        },
      ],
    });

    trackLlmUsage(FAST_MODEL, completion.usage);
    const text = completion.choices[0]?.message?.content ?? '{}';
    let parsed: PhotoLearnResponse;
    try {
      parsed = JSON.parse(text) as PhotoLearnResponse;
    } catch {
      return c.json({ error: 'invalid_ai_response', raw: text.slice(0, 200) }, 502);
    }

    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      return c.json({ error: 'no_items_extracted' }, 502);
    }

    return c.json(parsed);
  } catch (err) {
    console.warn('[photo-learn] failed:', err);
    return c.json({ error: 'ai_error', message: err instanceof Error ? err.message : 'unknown' }, 502);
  }
});
