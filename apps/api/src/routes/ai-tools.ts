import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import OpenAI from 'openai';
import { aiEnv } from '../ai/env.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { trackLlmUsage } from '../services/spend.js';
import { FAST_MODEL, completionLimits } from '../ai/models.js';

export const aiToolsRoute = new Hono();

// Public — called during onboarding before the user has an account
aiToolsRoute.use('*', rateLimit({ name: 'ai_tools', capacity: 20, windowMs: 60 * 60 * 1000 }));

const KNOWN_KEYS = ['animals', 'dinos', 'space', 'sports', 'music', 'art', 'science', 'food', 'games'];

const analyzeInterestsSchema = z.object({
  text: z.string().min(2).max(500),
  lang: z.enum(['ru', 'az']).default('ru'),
});

// POST /ai/interests
// Extracts interest tags from free text written by a parent describing what their child loves.
aiToolsRoute.post('/interests', zValidator('json', analyzeInterestsSchema), async (c) => {
  const { text, lang } = c.req.valid('json');

  const client = new OpenAI({ apiKey: aiEnv.openaiKey });

  const systemPrompt = `You extract children's interest tags from free text written by a parent.
Extract up to 6 relevant interest tags.
Prefer these known tag keys when they clearly match: ${KNOWN_KEYS.join(', ')}.
For interests not in the known list, create short free-form tags in the SAME language as the input text (1-2 words, lowercase, no punctuation).
Respond ONLY with valid JSON: {"tags": ["tag1", "tag2"]}`;

  const userMsg = lang === 'az'
    ? `Valideyn yazdı: "${text}"\nUşağın maraqlarını çıxar.`
    : `Родитель написал: "${text}"\nИзвлеки интересы ребёнка.`;

  try {
    const response = await client.chat.completions.create({
      model: FAST_MODEL,
      ...completionLimits(FAST_MODEL, 120),
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg },
      ],
    });

    trackLlmUsage(FAST_MODEL, response.usage);
    const raw = response.choices[0]?.message?.content?.trim() ?? '{}';
    let parsed: { tags?: unknown } = {};
    try { parsed = JSON.parse(raw); } catch { /* non-JSON — return empty */ }

    const tags = Array.isArray(parsed.tags)
      ? (parsed.tags as unknown[])
          .filter((t): t is string => typeof t === 'string' && t.length > 0)
          .slice(0, 6)
      : [];

    return c.json({ tags });
  } catch (e) {
    console.warn('[ai-tools] analyze-interests failed:', e);
    return c.json({ tags: [] });
  }
});
