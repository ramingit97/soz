import OpenAI from 'openai';
import { z } from 'zod';

import { aiEnv } from './env.js';
import type { LessonError } from '../db/schema.js';
import { trackLlmUsage } from '../services/spend.js';
import { FAST_MODEL, completionLimits } from './models.js';

let cached: OpenAI | null = null;
function client(): OpenAI {
  if (!cached) cached = new OpenAI({ apiKey: aiEnv.openaiKey });
  return cached;
}

// ── Output schema (what we expect GPT to return) ─────────────────────────────

const StrengthSchema = z.object({
  topic: z.string().min(1).max(200),
  evidence: z.string().min(1).max(600),
});

const WeaknessSchema = z.object({
  topic: z.string().min(1).max(200),
  evidence: z.string().min(1).max(600),
  specificMistakes: z.array(z.string().max(200)).max(10),
});

export const AnalysisSchema = z.object({
  strengths: z.array(StrengthSchema).max(6),
  weaknesses: z.array(WeaknessSchema).max(6),
  vocabularyToReview: z.array(z.string().max(60)).max(20),
  conversationTopics: z.array(z.string().max(80)).max(10),
  interests: z.array(z.string().max(80)).max(8),
  suggestedFocus: z.array(z.string().max(600)).max(5),
});

export type Analysis = z.infer<typeof AnalysisSchema>;

// ── Input ────────────────────────────────────────────────────────────────────

export interface AnalysisInput {
  childName: string;
  childAge: number;
  level: string;
  language: 'en' | 'ru';
  lessonsCompleted: number;
  totalStars: number;
  errors: LessonError[];
  conversationTurns: { role: 'child' | 'bobo'; text: string; day: number }[];
  themesCovered: string[];
  profileInterests?: string[]; // stated at onboarding — seed the interest analysis
}

// ── Prompts ──────────────────────────────────────────────────────────────────

function buildAnalysisPrompt(input: AnalysisInput): string {
  const errorsByKind = {
    word_game: input.errors.filter((e) => e.kind === 'word_game'),
    grammar: input.errors.filter((e) => e.kind === 'grammar'),
    pronunciation: input.errors.filter((e) => e.kind === 'pronunciation'),
  };

  const errorsSummary = [
    `Word-game errors (${errorsByKind.word_game.length}):`,
    ...errorsByKind.word_game.slice(0, 30).map(
      (e) => `  - prompt:"${e.prompt}" correct:"${e.correct}" given:"${e.given}"`,
    ),
    `Grammar errors (${errorsByKind.grammar.length}):`,
    ...errorsByKind.grammar.slice(0, 30).map(
      (e) => `  - "${e.prompt}" correct:"${e.correct}" given:"${e.given}"`,
    ),
    `Pronunciation misses (${errorsByKind.pronunciation.length}) — words the child skipped or couldn't say:`,
    ...errorsByKind.pronunciation.slice(0, 30).map(
      (e) => `  - word:"${e.correct}" heard:"${e.given}"`,
    ),
  ].join('\n');

  const childTurns = input.conversationTurns
    .filter((t) => t.role === 'child')
    .slice(-50)
    .map((t) => `[day ${t.day}] ${t.text}`)
    .join('\n');

  const lang = input.language === 'ru' ? 'Russian' : 'English';

  return `You are a pedagogical analyst for a children's language-learning app (Söz). Analyze a child's ${input.lessonsCompleted}-day learning progress and produce a structured report.

CHILD PROFILE:
- Name: ${input.childName}
- Age: ${input.childAge}
- CEFR level: ${input.level}
- Learning: ${lang}
- Total lessons completed: ${input.lessonsCompleted}
- Total stars earned: ${input.totalStars}

THEMES COVERED:
${input.themesCovered.join(', ')}

INTERESTS STATED BY THE FAMILY AT SIGN-UP (treat as known favorites — always include in "interests"):
${input.profileInterests?.length ? input.profileInterests.join(', ') : '(none provided)'}

MISTAKES OBSERVED:
${errorsSummary || '(none)'}

WHAT THE CHILD ACTUALLY SAID IN CONVERSATIONS:
${childTurns || '(no conversations yet)'}

YOUR TASK — return STRICT JSON matching this exact shape:
{
  "strengths": [{ "topic": "...", "evidence": "..." }],
  "weaknesses": [{ "topic": "...", "evidence": "...", "specificMistakes": ["..."] }],
  "vocabularyToReview": ["word1", "word2"],
  "conversationTopics": ["pets", "school"],
  "interests": ["cats", "drawing"],
  "suggestedFocus": ["1-2 sentence pedagogical recommendation"]
}

RULES:
- Output language: ${lang} for human-readable fields (topic, evidence, suggestedFocus). Vocabulary words stay in target language.
- "strengths": what the child consistently does well. Cite specific evidence.
- "weaknesses": patterns of mistakes. Group similar mistakes. Be specific.
- "vocabularyToReview": list of ${lang} words the child got wrong (deduplicated).
- "conversationTopics": themes the child gravitated toward in their own speech.
- "interests": MERGE the family-stated interests above with any new ones inferred from what the child said (pets, hobbies, etc). Never drop a stated interest.
- "suggestedFocus": 3-5 specific pedagogical priorities for the next week, tailored to weaknesses + interests.
- Be concise. Be specific. Don't fabricate evidence.
- Return ONLY the JSON object, no prose, no markdown fences.`;
}

// ── Main entry point ─────────────────────────────────────────────────────────

export async function runAnalysis(input: AnalysisInput): Promise<Analysis> {
  const prompt = buildAnalysisPrompt(input);

  const response = await client().chat.completions.create({
    model: FAST_MODEL,
    ...completionLimits(FAST_MODEL, 2000),
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You are a pedagogical analyst. Output strict JSON only.' },
      { role: 'user', content: prompt },
    ],
  });

  trackLlmUsage(FAST_MODEL, response.usage);
  const raw = response.choices[0]?.message?.content?.trim() ?? '{}';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`analysis_invalid_json: ${raw.slice(0, 200)}`);
  }

  const validated = AnalysisSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`analysis_schema_mismatch: ${validated.error.message}`);
  }

  return validated.data;
}
