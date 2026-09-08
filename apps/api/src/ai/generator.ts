import OpenAI from 'openai';
import { z } from 'zod';

import type { Analysis } from './analysis.js';
import { aiEnv } from './env.js';
import type { GeneratedLesson, LessonPrefs } from '../db/schema.js';
import { GENERATOR_MODEL as CONFIGURED_MODEL, completionLimits } from './models.js';
import { trackLlmUsage } from '../services/spend.js';

let cached: OpenAI | null = null;
function client(): OpenAI {
  if (!cached) cached = new OpenAI({ apiKey: aiEnv.openaiKey });
  return cached;
}

const MODEL = CONFIGURED_MODEL;

// ── Output schema (strict — bad LLM output gets rejected) ────────────────────

const StorySceneSchema = z.object({
  text: z.string().min(3).max(200),
  emoji: z.string().min(1).max(10),
});

const WordGameRoundSchema = z.object({
  emoji: z.string().min(1).max(10),
  correct: z.string().min(1).max(60),
  options: z.array(z.string().min(1).max(60)).length(4),
});

const GrammarExerciseSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('fill_blank'),
    prompt: z.string().min(3).max(200),
    options: z.array(z.string().min(1).max(60)).min(3).max(4),
    correct: z.string().min(1).max(60),
  }),
  z.object({
    kind: z.literal('order_words'),
    prompt: z.string().min(3).max(200),
    options: z.array(z.string().min(1).max(60)).min(2).max(8),
    correct: z.array(z.string().min(1).max(60)).min(2).max(8),
  }),
]);

const LessonSchema = z.object({
  day: z.number().int().min(1).max(365),
  theme: z.string().min(2).max(60),
  themeEmoji: z.string().min(1).max(10),
  // Pedagogical focus of the day — drives which activity is the hero in the path.
  focus: z
    .enum(['story_listen', 'conversation', 'vocab_grammar', 'review'])
    .default('vocab_grammar'),
  vocabulary: z.array(z.string().min(1).max(60)).length(5),
  story: z.array(StorySceneSchema).length(3),
  wordGame: z.array(WordGameRoundSchema).length(3),
  grammar: z.array(GrammarExerciseSchema).length(2),
  talkSystemPrompt: z.string().min(50).max(2000),
  reward: z.object({
    stars: z.number().int().min(8).max(40),
    message: z.string().min(3).max(200),
  }),
  reasoning: z.string().min(5).max(400),
});

export const WeekPlanSchema = z.object({
  weekRationale: z.string().min(20).max(800),
  // 1..7 lessons: full weeks ask for 7, the fast first-lesson path asks for 1,
  // and week-1 completion asks for 6. The exact expected count is enforced in
  // generateWeekPlan against the requested day range.
  lessons: z.array(LessonSchema).min(1).max(7),
});

export type WeekPlan = z.infer<typeof WeekPlanSchema>;

// ── Input ────────────────────────────────────────────────────────────────────

export interface GeneratorInput {
  childName: string;
  childAge: number;
  level: string;
  language: 'en' | 'ru';
  startDay: number;
  endDay: number;
  weekNumber: number;
  analysis: Analysis;
  recentThemes: string[]; // last 4 weeks of themes — to avoid repeats
  season: 'winter' | 'spring' | 'summer' | 'autumn';
  prefs?: LessonPrefs; // parent dials from the checkpoint
  ageBand?: 'young' | 'mid' | 'teen' | 'adult'; // tone/topic register
  goal?: string; // PRIMARY goal — kept for back-compat
  goals?: string[]; // all chosen goals (kid path: up to 2) — biases themes/scenarios
  activeDaysPerWeek?: number; // chosen study days/week (from schedule) — shapes focus distribution
}

// Why the learner is studying — steers theme & scenario selection so the plan
// actually serves their reason(s) (a "move abroad" plan ≠ a "school grades" plan).
function goalGuidance(goals?: string[]): string {
  const list = (goals ?? []).map((g) => g.trim()).filter(Boolean);
  if (list.length === 0) return '';
  const map: Record<string, string> = {
    school: 'school subjects, classroom situations, homework, exams, and academic vocabulary',
    future: 'future plans, careers, technology, and the skills that open doors later',
    move: 'real-life survival situations abroad — shops, doctor, school enrolment, directions, making new friends in a new country',
    communication: 'free everyday conversation and confident speaking in real dialogues',
    fun: 'playful, high-interest themes the learner enjoys, games, and pop culture',
    travel: 'travel situations — airports, hotels, directions, ordering food, small talk',
    career: 'workplace and professional situations, meetings, email, interviews',
    interview: 'job interviews, self-presentation, and professional Q&A',
    family: 'family life, relationships, home, and everyday domestic situations',
  };
  const focuses = list.map((g) => map[g] ?? g).join('; and ');
  const primary = list[0];
  return `LEARNING GOAL(S): the learner studies mainly for ${list.map((g) => `"${g}"`).join(' + ')} (primary: "${primary}"). Bias themes and roleplay/talk scenarios toward ${focuses}. Lead with the primary goal. Keep level and age register intact.`;
}

// Age-band register so a teen/adult B1 plan never reads like a 7-year-old's
// (robots, "good job little friend"), and a young child's never gets abstract.
function ageBandGuidance(band: GeneratorInput['ageBand']): string {
  switch (band) {
    case 'young':
      return 'LEARNER AGE REGISTER: young child (5-7). Playful, concrete, lots of encouragement, very short sentences, familiar everyday themes (toys, animals, family, colors).';
    case 'teen':
      return 'LEARNER AGE REGISTER: teenager (13-16). Treat them as a capable young adult — themes like school, friends, music, gaming, social media, future plans, real-life situations. NO babyish framing, NO talking-robot premise, NO childish rewards. Tone is cool, natural, respectful.';
    case 'adult':
      return 'LEARNER AGE REGISTER: adult learner. Mature, practical themes (work, travel, daily life, opinions, culture). Treat them as an adult peer. NO childish framing, mascots, or kiddie rewards. Tone is warm but grown-up.';
    case 'mid':
    default:
      return 'LEARNER AGE REGISTER: child (8-12). Fun and friendly, concrete themes, age-appropriate humor and encouragement.';
  }
}

// ── Prompt ───────────────────────────────────────────────────────────────────

function buildGeneratorPrompt(input: GeneratorInput): string {
  const lang = input.language === 'ru' ? 'Russian' : 'English';
  const dayCount = input.endDay - input.startDay + 1;
  const weakSummary = input.analysis.weaknesses
    .map((w) => `  - ${w.topic}: ${w.evidence}`)
    .join('\n');
  const strongSummary = input.analysis.strengths
    .map((s) => `  - ${s.topic}: ${s.evidence}`)
    .join('\n');

  const p = input.prefs ?? {};
  const prefLines = [
    p.moreTalk ? '  - The family wants MORE conversation — bias each day toward more talk_to_bobo practice and richer talkSystemPrompt.' : '',
    p.moreWords ? '  - The family wants MORE vocabulary — you may push toward 6-7 words/day where age-appropriate.' : '',
    p.difficulty === 'easier' ? '  - The family wants it EASIER — shorter sentences, gentler ramp, more review.' : '',
    p.difficulty === 'harder' ? '  - The family wants it HARDER — longer sentences, faster ramp, fewer review words.' : '',
  ].filter(Boolean).join('\n');

  return `You are a curriculum designer for Söz, a children's language-learning app. You create personalized weekly lesson plans for individual children based on their progress.

CHILD PROFILE:
- Name: ${input.childName}
- Age: ${input.childAge}
- CEFR level: ${input.level}
- Learning: ${lang}

${ageBandGuidance(input.ageBand)}
${goalGuidance(input.goals) ? `\n${goalGuidance(input.goals)}\n` : ''}
WHAT THE CHILD ALREADY DOES WELL:
${strongSummary || '  (no data yet)'}

WHAT NEEDS WORK:
${weakSummary || '  (no major weaknesses yet)'}

CHILD'S INTERESTS (mentioned in conversations):
${input.analysis.interests.map((i) => `  - ${i}`).join('\n') || '  (none yet)'}

VOCABULARY TO REINFORCE:
${input.analysis.vocabularyToReview.join(', ') || '  (none flagged)'}

THEMES ALREADY COVERED IN PREVIOUS 4 WEEKS — DO NOT REPEAT:
${input.recentThemes.length ? input.recentThemes.join(', ') : '  (this is week 1 of generated content)'}
${prefLines ? `\nFAMILY PREFERENCES (the parent set these — honor them):\n${prefLines}\n` : ''}
SEASON: ${input.season}
${input.activeDaysPerWeek ? `\nSTUDY RHYTHM: the learner studies about ${input.activeDaysPerWeek} day(s) per week.` : ''}

DAY FOCUS — give every day a "focus" that decides its hero activity:
- "story_listen" → a listening day (the learner listens to a short story, then answers).
- "conversation" → a speaking day (the learner talks with their companion about the theme).
- "vocab_grammar" → the default all-rounder day (new words + grammar + a little of everything).
- "review" → consolidation of earlier vocabulary/grammar.
${dayCount >= 4 ? `DISTRIBUTION RULE (important): across these ${dayCount} days include AT LEAST ONE "story_listen" day AND AT LEAST ONE "conversation" day. Spread them out (don't put them back-to-back). Make the rest "vocab_grammar", with a "review" day late in the week if useful. Bias the mix toward the learner's goal/focus (e.g. a "communication"/"move" goal → more "conversation" days). Every day still includes all fields below — "focus" only decides which one leads.${['teen', 'adult'].includes(input.ageBand ?? '') || ['pre_intermediate', 'intermediate'].includes(input.level) ? ` MATURE LEARNER RULE: this learner is a teen/adult or B1+ — they learn through real conversation and texts, not drills. Include AT LEAST TWO "conversation" days and lean the rest toward "story_listen"; keep pure "vocab_grammar" days to a minimum.` : ''}` : `For this short range use "vocab_grammar" focus unless the theme strongly calls for another. Every day still includes all fields below — "focus" only decides which one leads.`}
${dayCount === 1 && input.startDay === 1 ? `\nTHIS IS THE LEARNER'S VERY FIRST LESSON: make it a warm, welcoming introduction that instantly hooks their interests — the day that decides whether they come back tomorrow.\n` : ''}
YOUR TASK:
Generate ${dayCount === 1 ? `ONE lesson for day ${input.startDay}` : `a coherent ${dayCount}-day learning plan for days ${input.startDay} to ${input.endDay}`}. ${dayCount > 1 ? 'Each day must build pedagogically. ' : ''}The plan should:

1. Reinforce 1-2 weak areas through varied practice (not drills — use the child's interests as hooks)
2. Introduce 1-2 fresh themes the child hasn't seen
3. Include 30% review vocabulary (from "vocabulary to reinforce") + 70% new words
${dayCount > 1 ? `4. Gradually increase difficulty across the ${dayCount} days` : '4. Keep difficulty gentle — an inviting first step'}
5. Use the child's interests (${input.analysis.interests.join(', ') || 'general'}) to make themes engaging
6. Match the season (e.g. ${input.season} — relevant themes welcome)
7. Assign each day a "focus" per the rule above

OUTPUT — STRICT JSON, no markdown fences, no prose:

{
  "weekRationale": "2-4 sentence explanation for the parent: which weaknesses we target, which interests we leverage, how the week progresses",
  "lessons": [
    {
      "day": ${input.startDay},
      "theme": "<2-4 word theme in ${lang}>",
      "themeEmoji": "<single emoji>",
      "focus": "<one of: story_listen | conversation | vocab_grammar | review>",
      "vocabulary": ["<5 ${lang} words>"],
      "story": [
        { "text": "<short ${lang} sentence advancing a mini-scene on this theme, age-appropriate per the register above>", "emoji": "<single emoji>" },
        { "text": "<...>", "emoji": "<...>" },
        { "text": "<...>", "emoji": "<...>" }
      ],
      "wordGame": [
        { "emoji": "<emoji clue>", "correct": "<vocab word>", "options": ["<correct>", "<distractor1>", "<distractor2>", "<distractor3>"] },
        { "...": "..." },
        { "...": "..." }
      ],
      "grammar": [
        { "kind": "fill_blank", "prompt": "<${lang} sentence with ___>", "options": ["<3-4 options>"], "correct": "<correct option>" },
        { "kind": "order_words", "prompt": "<instruction in ${lang}>", "options": ["<words shuffled>"], "correct": ["<words in correct order>"] }
      ],
      "talkSystemPrompt": "<2-4 sentence Bobo system prompt for this lesson, anchoring vocabulary + theme + tone — KEEP IT IN ${lang}>",
      "reward": { "stars": <14-22>, "message": "<encouraging ${lang} message>" },
      "reasoning": "<1-2 sentence explanation in ${lang} for the parent: why this day, what gets practiced>"
    }${dayCount > 1 ? `,
    ... ${dayCount - 1} more day(s) ...` : ''}
  ]
}

CRITICAL RULES:
- Vocabulary: exactly 5 words per day, in ${lang}, age-appropriate.
- Word-game options: each round needs exactly 4 options including the correct one.
- Grammar: exactly 2 exercises per day. Mix fill_blank and order_words.
- order_words: "options" MUST contain EXACTLY the same words as "correct", just shuffled — no missing words, no extras. A sentence that needs a word not present among the tiles is unsolvable.
- Grammar difficulty MUST match CEFR level "${input.level}": beginner → to-be/word order/simple present; elementary → articles, plurals, simple past; pre_intermediate → mixed tenses, modals, comparatives; intermediate → conditionals, passive voice, reported speech, natural collocations. NEVER give a pre_intermediate/intermediate learner trivial sentences like "My name is..." — for them order_words needs 6+ words with a real grammatical challenge.
- Story: exactly 3 scenes per day, each as a short ${lang} sentence + emoji.
- Stars: 14 weekday, 18-22 for "harder" days, max 24.
- talkSystemPrompt: written as a system prompt for the AI companion ("You are {{companion}}..."), telling it what theme/words/tone to work with for this day. Keep it age-appropriate per the register above.
- All human-readable text in ${lang}. Vocabulary stays in target language.
- Do NOT repeat themes from the "do not repeat" list.
- Output VALID JSON. No comments. No trailing commas. No markdown fences.`;
}

// ── Main entry ───────────────────────────────────────────────────────────────

export async function generateWeekPlan(input: GeneratorInput): Promise<WeekPlan> {
  const prompt = buildGeneratorPrompt(input);

  const response = await client().chat.completions.create({
    model: MODEL,
    ...completionLimits(MODEL, 6000),
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You are a meticulous curriculum designer. Output strict valid JSON only — no prose, no fences.',
      },
      { role: 'user', content: prompt },
    ],
  });

  trackLlmUsage(MODEL, response.usage);
  const raw = response.choices[0]?.message?.content?.trim() ?? '{}';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`generator_invalid_json: ${(e as Error).message}`);
  }

  // Inject day numbers if AI forgot — defensive
  if (parsed && typeof parsed === 'object' && 'lessons' in parsed) {
    const lessons = (parsed as { lessons: GeneratedLesson[] }).lessons;
    if (Array.isArray(lessons)) {
      lessons.forEach((l, i) => {
        if (typeof l.day !== 'number') l.day = input.startDay + i;
      });
    }
  }

  const validated = WeekPlanSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`generator_schema_mismatch: ${validated.error.message.slice(0, 500)}`);
  }

  // The requested day range dictates the exact lesson count (7 for a full week,
  // 1 for the fast first lesson, 6 for week-1 completion).
  const expected = input.endDay - input.startDay + 1;
  if (validated.data.lessons.length !== expected) {
    throw new Error(
      `generator_wrong_lesson_count: expected ${expected}, got ${validated.data.lessons.length}`,
    );
  }

  // Solvability guard: an order_words whose tiles don't cover the correct
  // answer ("...soccer in summer" with no "in" tile) can never be solved and
  // strands the child. Rebuild the tiles from the answer instead of failing
  // the whole week.
  for (const lesson of validated.data.lessons) {
    for (const ex of lesson.grammar) {
      if (ex.kind !== 'order_words') continue;
      const key = (a: string[]) => a.map((w) => w.trim()).sort().join('\u0001');
      if (key(ex.options) !== key(ex.correct)) {
        ex.options = [...ex.correct].sort(() => Math.random() - 0.5);
      }
    }
  }

  return validated.data;
}

export const GENERATOR_MODEL = MODEL;

export function currentSeason(date: Date = new Date()): GeneratorInput['season'] {
  const m = date.getMonth(); // 0-based
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'autumn';
  return 'winter';
}
