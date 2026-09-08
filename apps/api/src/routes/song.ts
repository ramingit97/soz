/**
 * /song — generate a short rhyming jingle for a given list of vocab words,
 * then synthesize it as a single audio clip via OpenAI TTS.
 *
 * Backend handles the heavy lifting:
 *  1. GPT-4o-mini composes a 4-line rhyming verse using ALL provided vocab.
 *  2. OpenAI TTS-1 sings it with the 'nova' voice (warm, child-friendly).
 *  3. We return base64 audio + the lyrics so the client can karaoke-highlight.
 */

import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import OpenAI from 'openai';
import { z } from 'zod';

import { requireAuth } from '../auth/middleware.js';
import { aiEnv } from '../ai/env.js';
import { trackLlmUsage } from '../services/spend.js';
import { FAST_MODEL, completionLimits } from '../ai/models.js';

export const songRoute = new Hono();
songRoute.use('*', requireAuth);

const songSchema = z.object({
  vocab: z.array(z.string()).min(2).max(8),
  language: z.enum(['en', 'ru']),
  theme: z.string().optional(),
});

export interface SongResponse {
  lyrics: string[]; // Array of lines for karaoke highlight
  audioBase64: string;
  audioMimeType: string;
}

let cached: OpenAI | null = null;
function openai(): OpenAI {
  if (!cached) cached = new OpenAI({ apiKey: aiEnv.openaiKey });
  return cached;
}

songRoute.post('/', zValidator('json', songSchema), async (c) => {
  const body = c.req.valid('json');

  const langName = body.language === 'en' ? 'English' : 'Russian';
  const themeBit = body.theme ? ` The theme is "${body.theme}".` : '';

  // 1) Compose 4 short rhyming lines using all vocab
  const composition = await openai().chat.completions.create({
    model: FAST_MODEL,
    ...completionLimits(FAST_MODEL, 200),
    messages: [
      {
        role: 'system',
        content: `You write extremely simple 4-line rhymes for kids aged 5-10 learning ${langName}.${themeBit}
- Each line must be 4-7 words.
- AABB or ABAB rhyme scheme.
- Use ALL given vocabulary words at least once (split across lines).
- Use only simple, present-tense grammar.
- Output ONLY the 4 lines, one per line, no titles, no numbers, no quotes.`,
      },
      {
        role: 'user',
        content: `Write a 4-line rhyme using these words: ${body.vocab.join(', ')}.`,
      },
    ],
  });

  trackLlmUsage(FAST_MODEL, composition.usage);
  const lyricsText = composition.choices[0]?.message?.content?.trim() ?? '';
  const lyrics = lyricsText
    .split('\n')
    .map((l) => l.trim().replace(/^[\d.)\-•*]+\s*/, ''))
    .filter((l) => l.length > 0)
    .slice(0, 4);

  if (lyrics.length === 0) {
    return c.json({ error: 'no_lyrics' }, 502);
  }

  // 2) Synthesize audio (one TTS call for the whole song; nova voice + slower)
  const speechResp = await openai().audio.speech.create({
    model: 'tts-1',
    voice: 'nova',
    input: lyrics.join('\n'),
    speed: 0.9,
  });

  const buf = Buffer.from(await speechResp.arrayBuffer());
  const audioBase64 = buf.toString('base64');

  return c.json<SongResponse>({
    lyrics,
    audioBase64,
    audioMimeType: 'audio/mpeg',
  });
});
