import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { and, eq } from 'drizzle-orm';

import { getLesson } from '@soz/content';
import { LANGUAGE_CODES, LEVELS } from '@soz/shared-types';

import { appendTurn, getHistory } from '../ai/conversations.js';
import { sttCost, ttsCost } from '../ai/cost.js';
import { generateBoboReply } from '../ai/llm.js';
import { transcribe } from '../ai/stt.js';
import { companionKind, companionName as resolveCompanionName } from '../ai/persona.js';
import { safeCrisisReply, screenChildMessage } from '../ai/safety.js';
import { buildSystemPrompt } from '../ai/system-prompts.js';
import { synthesizeBobo } from '../ai/tts.js';
import { getDb, isDbAvailable } from '../db/client.js';
import {
  aiReports,
  childCurricula,
  children,
  generatedWeeks,
  lessonTemplates,
  type LessonContent,
} from '../db/schema.js';
import { isPremium } from '../auth/entitlement.js';
import { requireAuth } from '../auth/middleware.js';
import { requireChild, requireThread } from '../auth/ownership.js';
import { peekRateLimit, rateLimit } from '../middleware/rateLimit.js';
import {
  buildMemoryString,
  buildThreadContext,
  buildTimeContext,
  countSensitiveToday,
  dismissThread,
  forgetFact,
  getAllThreads,
  getChildMemory,
  getDueThread,
  getOpenThreads,
  getThreadById,
  markThreadAsked,
  recordSensitiveThread,
  updateChildMemory,
} from '../services/memory.js';
import { getSafetyAlerts, raiseCrisisAlert } from '../services/safetyAlerts.js';
import { recordSpend } from '../services/spend.js';

interface ResolvedLesson {
  theme: string;
  vocabulary: string[];
  targetPhrases: string[];
}

async function resolveLessonContext(args: {
  childId: string;
  language: 'en' | 'ru';
  level: string;
  day: number;
}): Promise<ResolvedLesson> {
  // 1. Try @soz/content (only has day-1 beginner currently)
  const contentLesson = getLesson(args.language, args.level as never, args.day);
  if (contentLesson) {
    const talkActivity = contentLesson.activities.find((a) => a.type === 'talk_to_bobo');
    if (talkActivity && talkActivity.type === 'talk_to_bobo') {
      return {
        theme: contentLesson.theme,
        vocabulary: contentLesson.vocabulary,
        targetPhrases: talkActivity.targetPhrases,
      };
    }
  }

  // 2. Try child's assembled curriculum (days 1-30 from lesson_templates).
  // try/catch: a guest childId is not a UUID and would fail the query — lesson
  // context is nice-to-have, never worth 500-ing the whole talk turn.
  if (isDbAvailable() && args.day <= 30) {
    try {
      const db = getDb();
      const [row] = await db
        .select({ content: lessonTemplates.content })
        .from(childCurricula)
        .innerJoin(lessonTemplates, eq(childCurricula.templateId, lessonTemplates.id))
        .where(
          and(
            eq(childCurricula.childId, args.childId),
            eq(childCurricula.language, args.language),
            eq(childCurricula.day, args.day),
          ),
        )
        .limit(1);
      if (row) {
        const c = row.content as LessonContent;
        return {
          theme: c.theme,
          vocabulary: c.vocabulary,
          targetPhrases: c.vocabulary.slice(0, 3),
        };
      }
    } catch (e) {
      console.warn('[talk] curriculum lookup failed, falling back:', (e as Error).message);
    }
  }

  // 3. Try AI-generated weeks (days 31+)
  if (isDbAvailable() && args.day > 30) {
    try {
      const db = getDb();
      const weeks = await db
        .select()
        .from(generatedWeeks)
        .where(
          and(
            eq(generatedWeeks.childId, args.childId),
            eq(generatedWeeks.language, args.language),
          ),
        );
      for (const w of weeks) {
        const lesson = w.lessons.find((l) => l.day === args.day);
        if (lesson) {
          return {
            theme: lesson.theme,
            vocabulary: lesson.vocabulary,
            targetPhrases: lesson.vocabulary.slice(0, 3),
          };
        }
      }
    } catch (e) {
      console.warn('[talk] generated-weeks lookup failed, falling back:', (e as Error).message);
    }
  }

  // 4. Generic fallback — Bobo can still chat about general kid-friendly topics
  return {
    theme: args.language === 'en' ? 'Free chat' : 'Свободный разговор',
    vocabulary: [],
    targetPhrases: [],
  };
}

// Stated interests from onboarding — authoritative, server-side (never trust the
// client for this). Cheap single-column lookup; safe to call once per turn/opener.
// Kid-chosen companion name — server-side authoritative so EVERY conversation
// (free chat, topics, AND structured lessons that don't send it) uses the name.
/** Pet name and exact age — the age decides bear (≤10) vs robot, see ai/persona.ts. */
async function getChildPersonaInfo(childId: string): Promise<{ petName?: string; age?: number }> {
  if (!isDbAvailable()) return {};
  try {
    const db = getDb();
    const [row] = await db
      .select({ petName: children.petName, age: children.age })
      .from(children)
      .where(eq(children.id, childId))
      .limit(1);
    return { petName: row?.petName ?? undefined, age: row?.age ?? undefined };
  } catch {
    return {};
  }
}

async function getChildInterests(childId: string): Promise<string[]> {
  if (!isDbAvailable()) return [];
  try {
    const db = getDb();
    const [row] = await db
      .select({ interests: children.interests })
      .from(children)
      .where(eq(children.id, childId))
      .limit(1);
    return row?.interests ?? [];
  } catch {
    return [];
  }
}

export const talkRoute = new Hono();

// EVERY /talk endpoint requires a token — including the anonymous trial, which
// gets a real guest account via POST /auth/guest. Before this, the whole route
// was open: /talk, /opener, /hint, /session-end and /word-check each spent money
// on STT/LLM/TTS for anyone who could reach the URL, the rate limiter fell back
// to an IP key (trivially rotated), and /talk read back any conversation whose
// deterministic id (`<childId>-d<day>-<lang>`) the caller could construct.
//
// This also replaces five hand-rolled copies of the same bearer-token dance that
// used to live inside individual handlers — the endpoints that DIDN'T have one
// are exactly the ones that were exposed.
talkRoute.use('*', requireAuth);

// /talk is the most expensive endpoint (STT + LLM + TTS = ~$0.01-0.05/call), so
// it carries the actual paywall for conversation: the store page promises free
// users a limit and subscribers unlimited talk. Free accounts (trial included)
// get a modest daily allowance; subscribers get a loose ceiling that only exists
// to catch a runaway client.
// Daily conversation allowance. FREE is the product's free tier; PREMIUM is an
// abuse ceiling, not a feature. Mirrored to the parent UI through GET /talk/quota
// so the number the parent sees is the number being enforced.
const TALK_WINDOW_MS = 24 * 60 * 60 * 1000;
const TALK_CAPACITY_FREE = 30;
const TALK_CAPACITY_PREMIUM = 600;
const talkCapacity = async (userId: string) =>
  (await isPremium(userId)) ? TALK_CAPACITY_PREMIUM : TALK_CAPACITY_FREE;

talkRoute.use(
  '/',
  rateLimit({
    name: 'talk',
    capacity: TALK_CAPACITY_FREE,
    windowMs: TALK_WINDOW_MS,
    capacityOf: (c) => talkCapacity(c.get('userId')),
  }),
);

// GET /talk/quota — conversation turns this account has left today. Reads the
// same in-memory bucket the limiter enforces, so it is exact for the machine
// that answers; with min_machines_running = 1 that is the only machine.
talkRoute.get('/quota', async (c) => {
  const userId = c.get('userId');
  const capacity = await talkCapacity(userId);
  const q = peekRateLimit({ name: 'talk', capacity, windowMs: TALK_WINDOW_MS, key: `u:${userId}` });
  return c.json({ ...q, premium: capacity === TALK_CAPACITY_PREMIUM });
});
// Hint endpoint cheaper but still LLM — 30/hour
talkRoute.use('/hint', rateLimit({ name: 'talk_hint', capacity: 30, windowMs: 60 * 60 * 1000 }));
// Session-end flush triggers one extraction LLM call — 30/hour is plenty
talkRoute.use('/session-end', rateLimit({ name: 'talk_session_end', capacity: 30, windowMs: 60 * 60 * 1000 }));

const talkRequestSchema = z.object({
  childId: z.string().uuid(),
  conversationId: z.string().min(1),
  language: z.enum(LANGUAGE_CODES),
  level: z.enum(LEVELS).default('beginner'),
  // Tolerate null / NaN-serialized-as-null / out-of-range from the client
  // (e.g. an unhydrated currentDay) — day is non-critical, fall back to 1.
  day: z.preprocess(
    (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined),
    z.number().int().min(1).max(120).default(1),
  ),
  // nullish (not optional): the mobile client sends `null` for "not provided",
  // and z.optional() rejects null → 400 before any work. Accept both.
  childName: z.string().max(40).nullish(),
  ageBand: z.enum(['young', 'mid', 'teen', 'adult']).nullish(),
  scenario: z.string().max(1000).nullish(), // adult talk-hub mode / topic coaching instruction (not user-facing text)
  // Conversation micro-goals (topic checklist). Detection criteria in English,
  // e.g. "The learner named a school subject they like". 1-based indices returned in objectivesDone.
  objectives: z.array(z.string().min(1).max(200)).max(5).nullish(),
  companionName: z.string().max(40).nullish(),
  nativeLanguage: z.enum(['ru', 'az']).nullish(), // learner L1 → corrections explained in their own language
  // Conversation-lesson timing: when set, the prompt tells Бобо the planned
  // session length so it wraps up warmly on its own (marker [[wrap]] → the
  // client shows the "finish" banner). Sent only for graded conversation days.
  sessionElapsedSec: z.number().int().min(0).max(7200).nullish(),
  sessionTargetSec: z.number().int().min(60).max(3600).nullish(),
  audioBase64: z.string().min(1),
  audioMimeType: z.string().default('audio/m4a'),
});

talkRoute.post(
  '/',
  zValidator('json', talkRequestSchema, (result, c) => {
    if (!result.success) {
      console.error('[talk] validation failed:', JSON.stringify(result.error.issues));
      return c.json({ success: false, error: result.error }, 400);
    }
  }),
  async (c) => {
  const body = c.req.valid('json');

  const denied = await requireChild(c, body.childId);
  if (denied) return denied;

  // Adult learners aren't on the kid curriculum — never pull a kid lesson (colors/numbers)
  // into an adult prompt. Free chat / scenario-driven instead.
  const lessonCtx = body.ageBand === 'adult'
    ? { theme: body.scenario ? 'Roleplay' : 'Free chat', vocabulary: [], targetPhrases: [] }
    : await resolveLessonContext({
        // Resolve with multi-source fallback (content pkg → DB curriculum → AI weeks → generic)
        childId: body.childId,
        language: body.language,
        level: body.level,
        day: body.day,
      });

  const audioBuffer = Buffer.from(body.audioBase64, 'base64');

  // 1. STT — what did the child say?
  // Code-switch mode when the learner's L1 differs from the lesson language:
  // they may weave native words into target-language speech ("...but рынок
  // сейчас сдох") and Бобо must understand + translate rather than mishear.
  // Default the L1 to 'ru' when the client didn't send one (audience is ru/az;
  // an unset parentUILanguage on device must never silently disable this).
  const native = body.nativeLanguage ?? 'ru';
  const codeSwitch = native !== body.language ? native : null;
  console.log('[talk] codeSwitch=', codeSwitch, 'lang=', body.language, 'native(sent)=', body.nativeLanguage ?? 'none');
  const stt = await transcribe(audioBuffer, body.language, body.audioMimeType, { codeSwitch });

  if (!stt.transcript) {
    return c.json(
      {
        transcript: '',
        responseText:
          body.language === 'en'
            ? "I didn't hear that — can you say it again?"
            : 'Я не расслышал — скажи ещё раз?',
        audioBase64: '',
        audioMimeType: 'audio/mpeg',
        ttsStubbed: true,
        cost: { sttUsd: 0, llmUsd: 0, ttsUsd: 0, totalUsd: 0 },
        timings: { sttMs: stt.durationMs, llmMs: 0, ttsMs: 0 },
      },
      200,
    );
  }

  // 1b. Pronunciation feedback — if Deepgram confidence is low, gently ask to repeat
  // Threshold 0.7 strikes balance: avoids false positives but catches real misses.
  // Skip if we got a perfectly normal short utterance (kids speak quietly).
  const LOW_CONF = 0.7;
  const unclearWords = stt.words.filter((w) => w.confidence < LOW_CONF);
  // Cyrillic inside an EN-lesson transcript = deliberately code-switched Russian,
  // not unclear pronunciation — never nag "say it clearer" about a word the child
  // said in their own language; let Бобо understand and translate it instead.
  // (The az code-switch path returns words=[] so this gate never fires there.)
  const codeSwitched = codeSwitch === 'ru' && body.language === 'en' && /[Ѐ-ӿ]/.test(stt.transcript);
  if (
    !codeSwitched &&
    stt.confidence < LOW_CONF &&
    stt.transcript.split(' ').length >= 2 &&
    unclearWords.length > 0
  ) {
    const wordsToTry = unclearWords
      .slice(0, 2)
      .map((w) => w.word)
      .filter(Boolean);
    const isEn = body.language === 'en';
    const tryAgainText = isEn
      ? `Almost! Try again, slowly: ${wordsToTry.join(', ')}`
      : `Почти получилось! Попробуй ещё раз, медленно: ${wordsToTry.join(', ')}`;

    // Synthesize Bobo's gentle re-prompt
    const tts = await synthesizeBobo({ text: tryAgainText, language: body.language });
    return c.json({
      transcript: stt.transcript,
      responseText: tryAgainText,
      audioBase64: tts.audioBase64,
      audioMimeType: tts.mimeType,
      ttsStubbed: tts.stubbed,
      ttsReason: tts.reason,
      pronunciationHint: { confidence: stt.confidence, unclearWords: wordsToTry },
      cost: { sttUsd: 0, llmUsd: 0, ttsUsd: 0, totalUsd: 0 },
      timings: { sttMs: stt.durationMs, llmMs: 0, ttsMs: tts.durationMs },
    });
  }

  // 1c. Real-time safety screen — runs BEFORE Bobo replies, independent of the
  // retrospective memory extraction. A crisis on turn 1 is caught even if the app
  // closes right after. On crisis: calm safe reply + immediate sensitive thread.
  const [safety, personaInfo] = await Promise.all([
    screenChildMessage(stt.transcript, body.language),
    getChildPersonaInfo(body.childId),
  ]);
  if (safety.crisis) {
    const meta = { childId: body.childId, language: body.language, day: body.day };
    await appendTurn(body.conversationId, { role: 'child', text: stt.transcript }, meta);

    // Escalate from the SERVER. The parent alert used to be a local notification
    // that this response asked the CHILD's device to fire — so closing the app
    // (what a distressed child does) meant no adult was ever told. Both the
    // parent-visible record and the email now start here, run alongside the TTS
    // the child is waiting through anyway, and are awaited before we reply: a
    // crash in between must not be able to drop the alert.
    const escalation = Promise.all([
      recordSensitiveThread(body.childId, body.language, stt.transcript),
      raiseCrisisAlert({
        childId: body.childId,
        language: body.language,
        category: safety.category,
        conversationId: body.conversationId,
        degraded: safety.degraded,
      }),
    ]);

    const safeText = safeCrisisReply(body.language, companionKind(personaInfo.age, body.ageBand));
    await appendTurn(body.conversationId, { role: 'bobo', text: safeText }, meta);
    const tts = await synthesizeBobo({ text: safeText, language: body.language });
    await escalation.catch((e) => console.error('[safety] escalation failed', e));
    return c.json({
      transcript: stt.transcript,
      responseText: safeText,
      audioBase64: tts.audioBase64,
      audioMimeType: tts.mimeType,
      ttsStubbed: tts.stubbed,
      crisis: true,
      cost: { sttUsd: 0, llmUsd: 0, ttsUsd: 0, totalUsd: 0 },
      timings: { sttMs: stt.durationMs, llmMs: 0, ttsMs: tts.durationMs },
    });
  }

  // 2. LLM — what does Bobo say back?
  // Load Bobo's memory of this child (non-blocking — returns empty if DB unavailable)
  const memory = await getChildMemory(body.childId, body.language);
  const memoryString = buildMemoryString(memory, body.childName ?? 'friend', body.language);
  const timeContext = buildTimeContext(memory, body.language);
  // Adult learners don't get the kid interest-hooks (they drive their own topics)
  const interests = body.ageBand === 'adult' ? [] : await getChildInterests(body.childId);

  const systemPrompt = buildSystemPrompt({
    language: body.language,
    childName: body.childName ?? undefined,
    level: body.level,
    ageBand: body.ageBand ?? undefined,
    theme: lessonCtx.theme,
    vocabulary: lessonCtx.vocabulary,
    targetPhrases: lessonCtx.targetPhrases,
    interests,
    memory: memoryString || undefined,
    timeContext,
    scenario: body.scenario ?? undefined,
    objectives: body.objectives ?? undefined,
    companionName: body.companionName ?? personaInfo.petName,
    childAge: personaInfo.age,
    nativeLanguage: body.nativeLanguage ?? undefined,
    sessionElapsedSec: body.sessionElapsedSec ?? undefined,
    sessionTargetSec: body.sessionTargetSec ?? undefined,
  });

  const conversationMeta = { childId: body.childId, language: body.language, day: body.day };
  const history = await getHistory(body.conversationId, body.childId);
  await appendTurn(body.conversationId, { role: 'child', text: stt.transcript }, conversationMeta);

  // Time's up on a conversation lesson → a must-obey instruction placed AFTER
  // the child's message (recency wins with gpt-4o-mini; the same rule inside the
  // long system prompt gets ignored in favor of "always end with a question").
  const timeIsUp =
    body.sessionTargetSec != null && (body.sessionElapsedSec ?? 0) >= body.sessionTargetSec;
  const wrapCommand = timeIsUp
    ? body.language === 'en'
      ? 'TIME IS UP for this session. In this reply: react warmly to what they just said, praise something SPECIFIC they did well today, and say this is a perfect stopping point for today. End with a warm goodbye — NOT a question. Then append the marker [[wrap]] as the very last characters.'
      : 'ВРЕМЯ СЕССИИ ВЫШЛО. В этом ответе: тепло отреагируй на сказанное, похвали что-то КОНКРЕТНОЕ из сегодняшнего разговора и скажи, что на сегодня отличная остановка. Закончи тёплым прощанием — БЕЗ вопроса. Then append the marker [[wrap]] as the very last characters.'
    : undefined;

  const llm = await generateBoboReply({
    systemPrompt,
    history,
    childMessage: stt.transcript,
    postInstruction: wrapCommand,
  });

  // Strip the objective-completion marker BEFORE the reply reaches history, TTS
  // or the client — a marker left in history teaches the model to echo it, and
  // one left in the text gets read aloud. Runs unconditionally (fail-open):
  // a hallucinated marker without objectives is still scrubbed.
  let replyText = llm.text;
  let objectivesDone: number[] = [];
  let wrapSuggested = false;
  // End markers can stack ("Great job! [[done:2]] [[wrap]]") — peel until clean.
  for (;;) {
    const marker = replyText.match(/\[\[(done:[\d,\s]+|wrap)\]\]\s*$/i);
    if (!marker) break;
    replyText = replyText.slice(0, marker.index).trim();
    const inner = (marker[1] ?? '').toLowerCase();
    if (inner === 'wrap') {
      wrapSuggested = true;
    } else if (body.objectives?.length) {
      const max = body.objectives.length;
      objectivesDone = [...new Set([
        ...objectivesDone,
        ...inner
          .slice('done:'.length)
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => Number.isInteger(n) && n >= 1 && n <= max),
      ])];
    }
  }

  await appendTurn(body.conversationId, { role: 'bobo', text: replyText }, conversationMeta);

  // After every 4th child turn, extract and persist memory (fire-and-forget, non-blocking)
  const allTurns = await getHistory(body.conversationId, body.childId);
  const childTurnCount = allTurns.filter((t) => t.role === 'child').length;
  if (childTurnCount > 0 && childTurnCount % 4 === 0) {
    updateChildMemory(
      body.childId,
      body.language,
      body.childName ?? 'friend',
      allTurns.slice(-10),
      memory,
    ).catch(() => {});
  }

  // 3. TTS — Bobo's voice
  const tts = await synthesizeBobo({
    text: replyText,
    language: body.language,
  });

  // Audio length estimate: assume the recording is ~mid-range short clip.
  // Real STT durationMs measures API call time, not audio length, so we
  // approximate audio length from buffer size (rough: 16KB/sec for m4a).
  const approxAudioMs = Math.max(1000, Math.round((audioBuffer.byteLength / 16_000) * 1000));

  const costStt = sttCost(approxAudioMs);
  const costLlm = llm.usd; // recorded inside generateBoboReply
  const costTts = tts.stubbed ? 0 : ttsCost(replyText.length, tts.reason === 'openai' ? 'openai' : 'elevenlabs');
  recordSpend('stt', costStt);
  if (costTts > 0) recordSpend('tts', costTts);

  return c.json({
    transcript: stt.transcript,
    responseText: replyText,
    objectivesDone,
    wrapSuggested,
    audioBase64: tts.audioBase64,
    audioMimeType: tts.mimeType,
    ttsStubbed: tts.stubbed,
    ttsReason: tts.reason,
    cost: {
      sttUsd: round4(costStt),
      llmUsd: round4(costLlm),
      ttsUsd: round4(costTts),
      totalUsd: round4(costStt + costLlm + costTts),
    },
    timings: {
      sttMs: stt.durationMs,
      llmMs: llm.durationMs,
      ttsMs: tts.durationMs,
    },
    tokens: {
      inputTokens: llm.inputTokens,
      outputTokens: llm.outputTokens,
    },
  });
});

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ── Opener endpoint — Bobo initiates the session with a contextual greeting ──
// Called when Talk screen mounts. Returns text + TTS audio for Bobo to play first.

const openerSchema = z.object({
  childId: z.string().uuid(),
  language: z.enum(LANGUAGE_CODES),
  // nullish (not optional): the mobile client sends `null` for "not provided",
  // and z.optional() rejects null → 400 before any work. Accept both.
  childName: z.string().max(40).nullish(),
  ageBand: z.enum(['young', 'mid', 'teen', 'adult']).nullish(),
  level: z.enum(LEVELS).default('beginner'),
  theme: z.string().nullish(),
  scenario: z.string().max(1000).nullish(), // adult talk-hub mode / topic coaching instruction (not user-facing text)
  companionName: z.string().max(40).nullish(),
  // When the session is opened from a proactive callback (push tap / home banner),
  // the specific thread to bring up. Omitted → the opener picks the due thread itself.
  threadId: z.string().nullish(),
});

talkRoute.post('/opener', zValidator('json', openerSchema), async (c) => {
  const { childId, language, childName, ageBand = 'mid', level, theme, scenario, threadId, companionName } = c.req.valid('json');

  const denied = await requireChild(c, childId);
  if (denied) return denied;

  const bot = resolveCompanionName(companionName?.trim() || (await getChildPersonaInfo(childId)).petName, language);

  const memory = await getChildMemory(childId, language);
  const memoryString = buildMemoryString(memory, childName ?? 'friend', language);
  const timeContext = buildTimeContext(memory, language);
  const name = childName ?? 'friend';
  const likes = ageBand === 'adult' ? [] : await getChildInterests(childId);
  const interestsBlock = likes.length
    ? language === 'en'
      ? `What ${name} loves: ${likes.join(', ')} — naturally bring one of these into your greeting.\n`
      : `Что обожает ${name}: ${likes.join(', ')} — естественно вплети одно из этого в приветствие.\n`
    : '';

  // Proactive recall: lead with a specific remembered thread when one is due
  // (or explicitly requested). This is the "how was going out with friends?" moment.
  //
  // An explicitly requested threadId comes from the client (push tap / home
  // banner), so it must be confirmed to belong to THIS child — otherwise another
  // child's remembered thread would be read aloud in the greeting. Falls back to
  // the due-thread lookup, which is already scoped by childId.
  const requestedThread = threadId ? await getThreadById(threadId) : null;
  const dueThread =
    requestedThread && requestedThread.childId === childId
      ? requestedThread
      : threadId
        ? null
        : await getDueThread(childId, language);
  const threadContext =
    dueThread && dueThread.status !== 'resolved' ? buildThreadContext(dueThread, language) : '';
  // NOTE: we do NOT mark the thread "asked" here — the client marks it via
  // POST /talk/threads/:id/asked only after the opener actually plays, so a
  // TTS/network failure doesn't silently burn the memory.

  const hasPastMemory = memory.facts.length > 0 || memory.thingsToAskBack.length > 0;
  const isFirstEver = !memory.lastInteractionDate && !threadContext;

  const prompt = language === 'en'
    ? `You are ${bot}, the AI friend of ${name}. Generate a single warm, natural opening greeting for a new chat session.

${threadContext ? `${threadContext}\n` : ''}${scenario ? `Roleplay scenario: ${scenario}\n- Open by setting the scene and starting your role.\n` : ''}${interestsBlock}${memoryString ? `What you remember about ${name}:\n${memoryString}\n` : ''}${timeContext ? `Time context:\n${timeContext}\n` : ''}
Rules:
- LANGUAGE — CRITICAL: write the greeting in English ONLY (the learner is here to learn English). Your memory notes above may be written in Russian or Azerbaijani — use their MEANING, but your greeting itself must be English. Never open in another language.
- 1-2 sentences max
- If you have memories, reference something specific: "Last time you told me about X — how did that go?"
- If it's Monday, ask about the weekend. If it's Friday, hint at weekend plans.
- If first ever session: just say a warm hello and ask what ${name} is up to today.
- End with a question to invite them to speak.
- Age style: ${ageBand === 'young' ? 'Very simple, enthusiastic, lots of energy!' : ageBand === 'teen' ? 'Cool and natural, like a real friend.' : ageBand === 'adult' ? 'Natural and warm, like a thoughtful adult friend and language coach — no childish energy.' : 'Warm, curious, playful.'}`
    : `Ты — ${bot}, AI-друг ${name}. Сгенерируй одно тёплое естественное приветствие для начала нового сеанса общения.

${threadContext ? `${threadContext}\n` : ''}${scenario ? `Сценарий ролевой игры: ${scenario}\n- Начни с того, что задаёшь сцену и входишь в свою роль.\n` : ''}${interestsBlock}${memoryString ? `Что ты помнишь о ${name}:\n${memoryString}\n` : ''}${timeContext ? `Контекст времени:\n${timeContext}\n` : ''}
Правила:
- ЯЗЫК — КРИТИЧНО: приветствие ТОЛЬКО на русском (ученик учит русский). Заметки памяти выше могут быть на другом языке — используй их СМЫСЛ, но само приветствие только по-русски.
- Максимум 1-2 предложения
- Если есть воспоминания — упомяни что-то конкретное: "В прошлый раз ты говорил о X — как всё прошло?"
- Если понедельник — спроси про выходные. Если пятница — намекни на предстоящие выходные.
- Если это первый сеанс: просто тепло поздоровайся и спроси чем занимается ${name} сегодня.
- Заканчивай вопросом чтобы ребёнок захотел ответить.
- Стиль для возраста: ${ageBand === 'young' ? 'Очень просто, с энтузиазмом, много энергии!' : ageBand === 'teen' ? 'Круто и естественно, как настоящий друг.' : ageBand === 'adult' ? 'Естественно и тепло, как вдумчивый взрослый друг и языковой коуч — без детской энергии.' : 'Тёплый, любопытный, игривый.'}`;

  const llm = await generateBoboReply({
    systemPrompt: prompt,
    history: [],
    childMessage: threadContext
      ? (language === 'en'
          ? 'Greet me by warmly bringing up the thing you remembered.'
          : 'Поздоровайся, тепло заведя разговор о том, что ты вспомнил.')
      : scenario
      ? (language === 'en' ? 'Start the roleplay scene.' : 'Начни сцену ролевой игры.')
      : isFirstEver
        ? (language === 'en' ? 'Start the conversation.' : 'Начни разговор.')
        : hasPastMemory
          ? (language === 'en' ? 'Greet me referencing something from our past.' : 'Поздоровайся упомянув что-то из прошлого.')
          : (language === 'en' ? 'Greet me warmly.' : 'Поздоровайся тепло.'),
  });

  const tts = await synthesizeBobo({ text: llm.text, language });

  return c.json({
    text: llm.text,
    audioBase64: tts.audioBase64,
    audioMimeType: tts.mimeType,
    ttsStubbed: tts.stubbed,
    hasMemory: hasPastMemory,
    thread: dueThread ? { id: dueThread.id, text: dueThread.text } : null,
  });
});

// ── Session-end flush — extract memory for short sessions ────────────────────
//
// updateChildMemory normally runs only every 4th turn, so 1-3 turn sessions
// would lose any event/promise mentioned. The client calls this when the Talk
// screen unmounts so nothing said is dropped before it can become a thread.

const sessionEndSchema = z.object({
  childId: z.string().uuid(),
  conversationId: z.string().min(1),
  language: z.enum(LANGUAGE_CODES),
  childName: z.string().max(40).optional(),
});

talkRoute.post('/session-end', zValidator('json', sessionEndSchema), async (c) => {
  const { childId, conversationId, language, childName } = c.req.valid('json');

  const denied = await requireChild(c, childId);
  if (denied) return denied;

  let sensitive = false;
  try {
    const turns = await getHistory(conversationId, childId);
    if (turns.length >= 2) {
      const memory = await getChildMemory(childId, language);
      await updateChildMemory(childId, language, childName ?? 'friend', turns.slice(-10), memory);
    }
    // Real-time signal: did anything sensitive surface today? (client raises a
    // neutral parent alert — no details, privacy-safe)
    sensitive = (await countSensitiveToday(childId)) > 0;
  } catch {
    /* non-critical — never block */
  }
  return c.json({ ok: true, sensitive });
});

// ── Threads endpoint — open follow-up threads for proactive scheduling/banner ─

talkRoute.get('/threads/:childId', async (c) => {
  if (!isDbAvailable()) return c.json({ threads: [] });

  const childId = c.req.param('childId');
  const denied = await requireChild(c, childId);
  if (denied) return denied;

  const language = (c.req.query('language') ?? 'en') as 'en' | 'ru';
  const scope = c.req.query('scope');

  // scope=all → parent transparency (every thread + status); default → open due/upcoming for scheduling
  const threads = scope === 'all'
    ? await getAllThreads(childId, language)
    : await getOpenThreads(childId, language);
  return c.json({ threads });
});

// GET /talk/alerts/:childId — crisis alerts raised for this child, newest first.
//
// The read path for what the server escalated: it lets a parent confirm an alert
// was actually sent (and see any that failed to deliver) instead of taking the
// email's word for it. Carries no transcript — the disclosure itself stays in the
// threads view.
talkRoute.get('/alerts/:childId', async (c) => {
  const childId = c.req.param('childId');
  const denied = await requireChild(c, childId);
  if (denied) return denied;

  return c.json({ alerts: await getSafetyAlerts(childId) });
});

// POST /talk/threads/:threadId/asked — client marks a thread asked AFTER the opener
// actually played (so a failed opener doesn't burn the memory). Idempotent, benign.
talkRoute.post('/threads/:threadId/asked', async (c) => {
  const threadId = c.req.param('threadId');
  const denied = await requireThread(c, threadId);
  if (denied) return denied;

  await markThreadAsked(threadId);
  return c.json({ ok: true });
});

// POST /talk/report — a user flagged one of Бобо's AI replies as inappropriate or
// wrong. Google Play's Generative-AI policy requires an in-app way to report AI
// content. Any signed-in caller can report (the trial included — guests hold a
// real token now). Surfaced in the API log so the operator sees flagged content,
// and persisted below so it survives a restart.
talkRoute.post('/report', async (c) => {
  let body: {
    childId?: string;
    conversationId?: string;
    messageText?: string;
    reason?: string;
  } = {};
  try {
    body = await c.req.json();
  } catch {
    /* tolerate empty/malformed body */
  }
  const messageText =
    typeof body.messageText === 'string' ? body.messageText.slice(0, 2000) : null;
  // Keep the log line — the founder watches the API stdout during QA.
  console.warn(
    '[report] AI content flagged',
    JSON.stringify({
      childId: body.childId ?? null,
      conversationId: body.conversationId ?? null,
      reason: body.reason ?? 'unspecified',
      messageText: messageText ? messageText.slice(0, 500) : null,
      at: new Date().toISOString(),
    }),
  );
  // Persist so the flagged reply is reviewable (Play GenAI policy) instead of
  // vanishing on restart. Best-effort: a DB hiccup must never fail the report.
  if (isDbAvailable()) {
    try {
      await getDb()
        .insert(aiReports)
        .values({
          childId: body.childId ?? null,
          conversationId: body.conversationId ?? null,
          reason: body.reason ?? null,
          messageText,
        });
    } catch (e) {
      console.error('[report] failed to persist:', e);
    }
  }
  return c.json({ ok: true });
});

// DELETE /talk/threads/:threadId — "forget" / stop asking about a thread
talkRoute.delete('/threads/:threadId', async (c) => {
  if (!isDbAvailable()) return c.json({ ok: true });

  const threadId = c.req.param('threadId');
  const denied = await requireThread(c, threadId);
  if (denied) return denied;

  await dismissThread(threadId);
  return c.json({ ok: true });
});

// POST /talk/memory/:childId/forget — remove a single remembered fact
talkRoute.post(
  '/memory/:childId/forget',
  zValidator('json', z.object({ language: z.enum(LANGUAGE_CODES), fact: z.string().min(1).max(300) })),
  async (c) => {
    if (!isDbAvailable()) return c.json({ ok: true });

    const childId = c.req.param('childId');
    const denied = await requireChild(c, childId);
    if (denied) return denied;

    const { language, fact } = c.req.valid('json');

    await forgetFact(childId, language, fact);
    return c.json({ ok: true });
  },
);

// ── Word-check endpoint — Quest mode: did the child say the right word? ──────

const wordCheckSchema = z.object({
  childId: z.string().uuid(),
  language: z.enum(LANGUAGE_CODES),
  expectedWord: z.string().min(1).max(60),
  audioBase64: z.string().min(1),
  audioMimeType: z.string().default('audio/m4a'),
});

talkRoute.post('/word-check', zValidator('json', wordCheckSchema), async (c) => {
  const { childId, language, expectedWord, audioBase64, audioMimeType } = c.req.valid('json');

  const denied = await requireChild(c, childId);
  if (denied) return denied;

  const audioBuffer = Buffer.from(audioBase64, 'base64');
  const stt = await transcribe(audioBuffer, language, audioMimeType);

  const heard = stt.transcript?.trim().toLowerCase() ?? '';
  const target = expectedWord.trim().toLowerCase();

  // Match logic: direct inclusion OR close enough by edit distance
  const matched = heard.includes(target) || levenshtein(heard, target) <= 2;

  return c.json({
    heard: stt.transcript ?? '',
    matched,
    confidence: stt.confidence,
  });
});

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const row = dp[i]!;
      const prevRow = dp[i - 1]!;
      row[j] = a[i - 1] === b[j - 1]
        ? prevRow[j - 1]!
        : 1 + Math.min(prevRow[j]!, row[j - 1]!, prevRow[j - 1]!);
    }
  }
  return dp[m]![n]!;
}

// ── Hint endpoint — gives child a fallback phrase to say ─────────────────────

const hintSchema = z.object({
  language: z.enum(LANGUAGE_CODES),
  day: z.number().int().min(1).max(120),
  level: z.enum(LEVELS).default('beginner'),
  childName: z.string().max(40).nullable().optional(),
  recentBoboLine: z.string().max(500).nullable().optional(),
});

// GET /talk/transcripts/:childId — list all conversations for the parent dashboard
talkRoute.get('/transcripts/:childId', async (c) => {
  const { getDb, isDbAvailable } = await import('../db/client.js');
  if (!isDbAvailable()) return c.json({ conversations: [] });

  const childId = c.req.param('childId');
  const denied = await requireChild(c, childId);
  if (denied) return denied;

  const { conversations: convsT } = await import('../db/schema.js');
  const { and, desc, eq } = await import('drizzle-orm');
  const db = getDb();

  const language = c.req.query('language') as 'en' | 'ru' | undefined;

  const rows = await db
    .select()
    .from(convsT)
    .where(
      language
        ? and(eq(convsT.childId, childId), eq(convsT.language, language))
        : eq(convsT.childId, childId),
    )
    .orderBy(desc(convsT.updatedAt))
    .limit(50);

  return c.json({ conversations: rows });
});

// ── Memory endpoint — what Bobo remembers about the child ────────────────────
//
// Surfaces the differentiating "Bobo as friend with memory" feature so the
// child can see proof that Bobo remembers them.

talkRoute.get('/memory/:childId', async (c) => {
  const { isDbAvailable } = await import('../db/client.js');
  if (!isDbAvailable()) {
    return c.json({ facts: [], thingsToAskBack: [], lastInteractionDate: null });
  }

  const childId = c.req.param('childId');
  const denied = await requireChild(c, childId);
  if (denied) return denied;

  const language = (c.req.query('language') ?? 'en') as 'en' | 'ru';

  const memory = await getChildMemory(childId, language);
  return c.json({
    facts: memory.facts,
    thingsToAskBack: memory.thingsToAskBack,
    lastInteractionDate: memory.lastInteractionDate,
  });
});

talkRoute.post('/hint', zValidator('json', hintSchema), async (c) => {
  const { language, day, level, childName, recentBoboLine } = c.req.valid('json');
  const lesson = getLesson(language, level, day);

  // Build a simple prompt to suggest a kid-friendly response phrase
  // Falls back to empty vocab if lesson not found in @soz/content
  const vocab = lesson?.vocabulary?.join(', ') ?? '';
  const langLabel = language === 'ru' ? 'Russian' : 'English';

  const { generateBoboReply } = await import('../ai/llm.js');
  const result = await generateBoboReply({
    systemPrompt: `You help a child aged 8-12 (level: ${level}) come up with a SHORT phrase to say to Bobo in ${langLabel}. Today's vocabulary: ${vocab}. Output ONLY the suggested phrase in ${langLabel} (2-8 words), no quotes, no prefix. Make it natural — what a real kid might say.`,
    history: [],
    childMessage: recentBoboLine
      ? `Bobo just said: "${recentBoboLine}". Suggest what ${childName ?? 'the child'} could reply.`
      : `Suggest something ${childName ?? 'the child'} could say to start a conversation about today's topic.`,
  });

  return c.json({ suggestion: result.text.replace(/^["']|["']$/g, '').trim() });
});
