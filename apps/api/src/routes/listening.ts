/**
 * AI listening stories — per-child, personalized, saved for re-listen.
 *
 * The LLM writes a short level-appropriate story woven around the child's name +
 * interests, plus a few comprehension questions; ElevenLabs/OpenAI TTS reads it.
 * Stories are saved PER CHILD and never shared with another child (a story made
 * for child A names A's interests — it would feel wrong for child B).
 *
 * Cost note: re-listen re-runs TTS from the stored text. The client caches the
 * audio file locally so same-device replays are free.
 */

import { and, desc, eq, gte } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import OpenAI from 'openai';
import { z } from 'zod';

import { aiEnv } from '../ai/env.js';
import { synthesizeBobo } from '../ai/tts.js';
import { requireAuth } from '../auth/middleware.js';
import { getDb, isDbAvailable } from '../db/client.js';
import { children, listeningStories, type ListeningPhrase, type ListeningQuestion } from '../db/schema.js';
import { FAST_MODEL, completionLimits } from '../ai/models.js';
import { trackLlmUsage } from '../services/spend.js';

export const listeningRoute = new Hono();
listeningRoute.use('*', requireAuth);

const MODEL = FAST_MODEL;
let cached: OpenAI | null = null;
function client(): OpenAI {
  if (!cached) cached = new OpenAI({ apiKey: aiEnv.openaiKey });
  return cached;
}

const LEVELS = ['beginner', 'elementary', 'pre_intermediate', 'intermediate'] as const;
type Level = (typeof LEVELS)[number];
const LANGS = ['en', 'ru'] as const;
const DAILY_STORY_CAP = 5; // new generations per child per day (cost guard; re-listen is free)

function normLevel(v: string | null | undefined): Level {
  return (LEVELS as readonly string[]).includes(v ?? '') ? (v as Level) : 'beginner';
}

const StorySchema = z.object({
  title: z.string().min(1).max(80),
  text: z.string().min(20).max(1500),
  questions: z
    .array(
      z.object({
        q: z.string().min(3).max(200),
        options: z.array(z.string().min(1).max(80)).min(2).max(4),
        correct: z.number().int().min(0).max(3),
      }),
    )
    .min(1)
    .max(4),
  phrases: z
    .array(
      z.object({
        text: z.string().min(1).max(120),
        translation: z.string().min(1).max(120),
      }),
    )
    .max(6)
    .default([]),
});

const LEVEL_LEN: Record<Level, string> = {
  beginner: '6-8 very short, simple sentences (3-7 words each); only basic vocabulary',
  elementary: '8-10 short sentences (5-10 words); simple present tense',
  pre_intermediate: '8-12 sentences (8-15 words); mixed tenses',
  intermediate: '10-14 natural sentences (10-20 words); rich vocabulary',
};

function buildPrompt(opts: {
  language: 'en' | 'ru';
  level: Level;
  childName: string;
  interests: string[];
  topic?: string;
}): string {
  const langName = opts.language === 'en' ? 'English' : 'Russian';
  const len = LEVEL_LEN[opts.level];
  const likes = opts.interests.length ? opts.interests.join(', ') : 'animals, adventures';
  const topicLine = opts.topic ? `Topic: ${opts.topic}.` : '';
  return `Write a SHORT listening story for a language learner named ${opts.childName}.
Write the story ENTIRELY in ${langName}. ${topicLine}
Personalize it around what ${opts.childName} loves: ${likes}. You may use the name.
Length & difficulty: ${len}.
Make it warm, vivid and easy to follow by ear — it will be read aloud.
Then write 2-3 simple comprehension questions about the story, each with 3 options and the index (0-based) of the correct one. Questions and options in ${langName}.
Also list 3-5 KEY phrases from the story worth remembering, each with a short translation into ${opts.language === 'en' ? 'Russian' : 'English'}.
Return STRICT JSON only: {"title":"...","text":"the full story","questions":[{"q":"...","options":["..","..",".."],"correct":0}],"phrases":[{"text":"...","translation":"..."}]}`;
}

const generateSchema = z.object({
  childId: z.string().min(1),
  language: z.enum(LANGS),
  level: z.enum(LEVELS).optional(),
  topic: z.string().max(80).optional(),
});

// POST /listening/generate — make + save a new personalized story, return audio.
listeningRoute.post('/generate', zValidator('json', generateSchema), async (c) => {
  if (!isDbAvailable()) return c.json({ error: 'database_not_configured' }, 503);
  const userId = c.get('userId');
  const body = c.req.valid('json');
  const db = getDb();

  const [child] = await db.select().from(children).where(eq(children.id, body.childId)).limit(1);
  if (!child) return c.json({ error: 'child_not_found' }, 404);
  if (child.userId !== userId) return c.json({ error: 'forbidden' }, 403);

  // Cost guard: cap NEW generations per child per day (re-listening saved stories is free).
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const todays = await db
    .select({ id: listeningStories.id })
    .from(listeningStories)
    .where(and(eq(listeningStories.childId, body.childId), gte(listeningStories.createdAt, since)));
  if (todays.length >= DAILY_STORY_CAP) {
    return c.json({ error: 'daily_limit' }, 429);
  }

  const level: Level = body.level ?? normLevel(child.level);
  const prompt = buildPrompt({
    language: body.language,
    level,
    childName: child.name,
    interests: child.interests ?? [],
    topic: body.topic,
  });

  let story: z.infer<typeof StorySchema>;
  try {
    const resp = await client().chat.completions.create({
      model: MODEL,
      ...completionLimits(MODEL, 1200),
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You write short, warm, level-appropriate listening stories for language learners. Output strict valid JSON only.',
        },
        { role: 'user', content: prompt },
      ],
    });
    trackLlmUsage(MODEL, resp.usage);
    const raw = resp.choices[0]?.message?.content?.trim() ?? '{}';
    story = StorySchema.parse(JSON.parse(raw));
  } catch (e) {
    return c.json({ error: `generation_failed: ${(e as Error).message.slice(0, 200)}` }, 502);
  }

  const [saved] = await db
    .insert(listeningStories)
    .values({
      childId: body.childId,
      language: body.language,
      level,
      title: story.title,
      text: story.text,
      questions: story.questions as ListeningQuestion[],
      phrases: story.phrases as ListeningPhrase[],
    })
    .returning();

  const tts = await synthesizeBobo({ text: story.text, language: body.language });

  return c.json(
    {
      id: saved?.id,
      title: story.title,
      text: story.text,
      questions: story.questions,
      phrases: story.phrases,
      audioBase64: tts.audioBase64,
      audioMimeType: tts.mimeType,
      ttsStubbed: tts.stubbed,
    },
    201,
  );
});

// GET /listening/story/:id — full story + freshly synthesized audio (re-listen).
listeningRoute.get('/story/:id', async (c) => {
  if (!isDbAvailable()) return c.json({ error: 'database_not_configured' }, 503);
  const userId = c.get('userId');
  const id = c.req.param('id');
  const db = getDb();

  const [story] = await db.select().from(listeningStories).where(eq(listeningStories.id, id)).limit(1);
  if (!story) return c.json({ error: 'not_found' }, 404);
  const [child] = await db
    .select({ userId: children.userId })
    .from(children)
    .where(eq(children.id, story.childId))
    .limit(1);
  if (!child || child.userId !== userId) return c.json({ error: 'forbidden' }, 403);

  const tts = await synthesizeBobo({ text: story.text, language: story.language as 'en' | 'ru' });
  return c.json({
    id: story.id,
    title: story.title,
    text: story.text,
    questions: story.questions,
    phrases: story.phrases,
    audioBase64: tts.audioBase64,
    audioMimeType: tts.mimeType,
    ttsStubbed: tts.stubbed,
  });
});

// GET /listening/:childId — the child's saved library (metadata only).
listeningRoute.get('/:childId', async (c) => {
  if (!isDbAvailable()) return c.json([]);
  const userId = c.get('userId');
  const childId = c.req.param('childId');
  const db = getDb();

  const [child] = await db
    .select({ userId: children.userId })
    .from(children)
    .where(eq(children.id, childId))
    .limit(1);
  if (!child) return c.json({ error: 'child_not_found' }, 404);
  if (child.userId !== userId) return c.json({ error: 'forbidden' }, 403);

  const rows = await db
    .select({
      id: listeningStories.id,
      title: listeningStories.title,
      level: listeningStories.level,
      language: listeningStories.language,
      createdAt: listeningStories.createdAt,
    })
    .from(listeningStories)
    .where(eq(listeningStories.childId, childId))
    .orderBy(desc(listeningStories.createdAt));

  return c.json(rows);
});
