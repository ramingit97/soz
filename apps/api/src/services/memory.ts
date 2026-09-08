/**
 * Bobo memory — persists what Bobo knows about a child across talk sessions.
 *
 * Two layers:
 * - `childMemory` (existing): static facts + free-form follow-up notes, keyed by
 *   (childId, language). Loaded before each talk request to enrich the prompt.
 * - `memoryThreads` (new): timed, lifecycle-tracked follow-ups — events, promises,
 *   emotions, goals — read cross-call by childId. This is what lets Хани bring
 *   something up later at the right moment ("how was going out with friends?").
 *
 * Flow:
 * - `getChildMemory` / `buildMemoryString` / `buildTimeContext` — read + format for the prompt
 * - `updateChildMemory` — fire-and-forget every ~4 turns (and on session end). Extracts
 *   static facts (as before) AND timed threads, computing WHEN to follow up.
 * - `getDueThread` / `getThreadById` / `markThreadAsked` / `markThreadResolved` /
 *   `buildThreadContext` — drive the proactive "Хани wants to ask you something" loop.
 */

import { and, asc, desc, eq, lte } from 'drizzle-orm';

import { getDb, isDbAvailable } from '../db/client.js';
import {
  childMemory,
  memoryThreads,
  type ChildFact,
  type MemorySentiment,
  type MemoryThreadStatus,
  type MemoryThreadType,
} from '../db/schema.js';
import { generateBoboReply } from '../ai/llm.js';

export interface ChildMemoryRecord {
  facts: ChildFact[];
  thingsToAskBack: string[];
  lastInteractionDate: string | null;
}

const EMPTY_MEMORY: ChildMemoryRecord = {
  facts: [],
  thingsToAskBack: [],
  lastInteractionDate: null,
};

// Maximum facts to prevent unbounded growth — drop oldest when over limit
const MAX_FACTS = 40;
const MAX_THINGS_TO_ASK = 5;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getChildMemory(
  childId: string,
  language: string,
): Promise<ChildMemoryRecord> {
  if (!isDbAvailable()) return EMPTY_MEMORY;

  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(childMemory)
      .where(and(eq(childMemory.childId, childId), eq(childMemory.language, language)))
      .limit(1);

    if (!row) return EMPTY_MEMORY;

    return {
      facts: row.facts ?? [],
      thingsToAskBack: row.thingsToAskBack ?? [],
      lastInteractionDate: row.lastInteractionDate ?? null,
    };
  } catch {
    return EMPTY_MEMORY;
  }
}

// ── Timed threads ────────────────────────────────────────────────────────────

interface ExtractedThread {
  type: MemoryThreadType;
  text: string;
  category?: string;
  sentiment?: MemorySentiment;
  sensitive?: boolean;
  eventDate?: string | null;
}

export interface MemoryThreadRecord {
  id: string;
  /** Owning child — callers that resolve a thread by a client-supplied id must
   *  confirm this matches the child they are serving before using its content. */
  childId: string;
  language: string;
  type: MemoryThreadType;
  text: string;
  category: string | null;
  sentiment: MemorySentiment | null;
  sensitive: boolean;
  status: MemoryThreadStatus;
  mentionedAt: string;
  eventDate: string | null;
  followUpAt: string | null;
}

/**
 * Decide WHEN Хани should proactively bring an item back up.
 * Returns an ISO date, or null when the item should only enrich the prompt
 * (facts / goals) or must never be pushed (sensitive items go to the parent).
 */
export function computeFollowUpAt(item: ExtractedThread, today: Date): string | null {
  if (item.sensitive) return null; // surfaced to a parent, never a cheerful push
  if (item.eventDate) {
    const d = new Date(item.eventDate);
    if (!Number.isNaN(d.getTime())) {
      d.setDate(d.getDate() + 1); // ask the day after the event happened
      return isoDate(d);
    }
  }
  const plusDays = (n: number): string => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return isoDate(d);
  };
  switch (item.type) {
    case 'event':
      return plusDays(2);
    case 'promise':
      return plusDays(3);
    case 'emotion':
      return plusDays(1);
    default:
      return null; // 'fact' | 'goal' — inject into the prompt, but don't schedule a callback
  }
}

export async function updateChildMemory(
  childId: string,
  language: string,
  childName: string,
  recentTurns: { role: 'child' | 'bobo'; text: string }[],
  existing: ChildMemoryRecord,
): Promise<void> {
  if (!isDbAvailable() || recentTurns.length < 2) return;

  try {
    const langLabel = language === 'en' ? 'English' : 'Russian';
    const childTurns = recentTurns
      .filter((t) => t.role === 'child')
      .map((t) => t.text)
      .join('\n');

    const existingFactsJson = JSON.stringify(existing.facts.slice(-20));
    const now = new Date();
    const today = isoDate(now);

    // The fast tier extracts static facts AND timed threads to follow up on —
    // this is JSON for the code, not words for the child.
    const result = await generateBoboReply({
      tier: 'fast',
      systemPrompt: `You extract memory about a child/learner from a ${langLabel} conversation with Bobo.

Return ONLY valid JSON with this exact structure:
{
  "newFacts": [
    {"category": "interests|family|pets|routine|recent_event|preferences", "fact": "string"}
  ],
  "thingsToAskBack": ["string"],
  "threads": [
    {"type": "event|promise|emotion|goal", "text": "string", "category": "string", "sentiment": "pos|neu|neg", "sensitive": true|false, "eventDate": "YYYY-MM-DD or null"}
  ]
}

Rules:
- Extract ONLY things the child/learner explicitly said (not Bobo's words).
- newFacts: stable facts like "loves drawing", "has a cat named Murka". Max 3.
- thingsToAskBack: 1-2 specific follow-up questions for next time.
- threads: timed or emotional items worth bringing up LATER. Max 3.
  - "event": something happening on/around a date ("going out with friends tomorrow", "trip to grandma on Sunday").
  - "promise": something they said they would do.
  - "emotion": a notable feeling worth gently checking on later.
  - "goal": a learning or life goal (especially adults).
  - "eventDate": resolve relative dates ("tomorrow", "on Saturday") to an absolute YYYY-MM-DD using TODAY=${today}. Use null if there is no date.
  - "sensitive": true for fear, bullying, conflict, sadness, or anything distressing — these are flagged to a parent and NEVER used for a cheerful follow-up.
- Skip facts already known: ${existingFactsJson}
- If nothing was shared, return empty arrays. No PII beyond first name.`,
      history: [],
      childMessage: `Name: ${childName}\nToday: ${today}\nWhat they said:\n${childTurns}`,
    });

    let parsed: {
      newFacts?: ChildFact[];
      thingsToAskBack?: string[];
      threads?: ExtractedThread[];
    };
    try {
      const raw = result.text.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(raw);
    } catch {
      return; // graceful failure — don't corrupt existing memory
    }

    const db = getDb();

    // 1. Static facts + ask-back notes (existing childMemory behavior, unchanged)
    const newFacts = (parsed.newFacts ?? []).map((f) => ({
      ...f,
      mentionedAt: today,
    }));

    const merged = [...existing.facts, ...newFacts]
      .filter(
        (f, idx, arr) =>
          arr.findIndex(
            (x) => x.fact.toLowerCase().trim() === f.fact.toLowerCase().trim(),
          ) === idx,
      )
      .slice(-MAX_FACTS);

    const mergedAsk = [
      ...(parsed.thingsToAskBack ?? []),
      ...existing.thingsToAskBack,
    ]
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, MAX_THINGS_TO_ASK);

    await db
      .insert(childMemory)
      .values({
        childId,
        language,
        facts: merged,
        thingsToAskBack: mergedAsk,
        lastInteractionDate: today,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [childMemory.childId, childMemory.language],
        set: {
          facts: merged,
          thingsToAskBack: mergedAsk,
          lastInteractionDate: today,
          updatedAt: now,
        },
      });

    // 2. Timed threads (new) — the proactive "bring it up later" layer
    const threads = (parsed.threads ?? []).slice(0, 3);
    if (threads.length > 0) {
      // Dedupe against still-open threads so re-extracting the same event every
      // 4 turns doesn't create duplicate follow-ups.
      let existingOpen = new Set<string>();
      try {
        const open = await db
          .select({ text: memoryThreads.text })
          .from(memoryThreads)
          .where(
            and(
              eq(memoryThreads.childId, childId),
              eq(memoryThreads.language, language),
              eq(memoryThreads.status, 'open'),
            ),
          );
        existingOpen = new Set(open.map((o) => o.text.toLowerCase().trim()));
      } catch {
        /* dedupe is best-effort */
      }

      for (const item of threads) {
        if (!item?.text || !item?.type) continue;
        const key = item.text.toLowerCase().trim();
        if (existingOpen.has(key)) continue;
        existingOpen.add(key);

        const followUpAt = computeFollowUpAt(item, now);
        await db.insert(memoryThreads).values({
          childId,
          language,
          type: item.type,
          text: item.text,
          category: item.category ?? null,
          sentiment: item.sentiment ?? null,
          sensitive: item.sensitive ? 1 : 0,
          status: 'open',
          mentionedAt: today,
          eventDate: item.eventDate ?? null,
          followUpAt,
          priority: item.sensitive ? 2 : item.eventDate ? 1 : 0,
        });
      }
    }
  } catch {
    // Memory update is non-critical — never block the main talk flow
  }
}

function rowToThread(row: typeof memoryThreads.$inferSelect): MemoryThreadRecord {
  return {
    id: row.id,
    childId: row.childId,
    language: row.language,
    type: row.type,
    text: row.text,
    category: row.category,
    sentiment: row.sentiment,
    sensitive: row.sensitive === 1,
    status: row.status,
    mentionedAt: row.mentionedAt,
    eventDate: row.eventDate,
    followUpAt: row.followUpAt,
  };
}

/**
 * The single best thread to bring up now: an open, non-sensitive thread whose
 * follow-up date has arrived. Prefers higher priority, then the oldest due date.
 * (Threads with a null followUpAt are excluded — lte() never matches null.)
 */
export async function getDueThread(
  childId: string,
  language: string,
  today: string = isoDate(new Date()),
): Promise<MemoryThreadRecord | null> {
  if (!isDbAvailable()) return null;
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(memoryThreads)
      .where(
        and(
          eq(memoryThreads.childId, childId),
          eq(memoryThreads.language, language),
          eq(memoryThreads.status, 'open'),
          eq(memoryThreads.sensitive, 0),
          lte(memoryThreads.followUpAt, today),
        ),
      )
      .orderBy(desc(memoryThreads.priority), asc(memoryThreads.followUpAt))
      .limit(1);
    return row ? rowToThread(row) : null;
  } catch {
    return null;
  }
}

/**
 * All open, non-sensitive threads with a scheduled follow-up date, for a given
 * language. Powers the client's local proactive-push scheduling and the
 * "Хани wants to ask you something" home banner. Ordered by due date.
 */
export async function getOpenThreads(
  childId: string,
  language: string,
): Promise<MemoryThreadRecord[]> {
  if (!isDbAvailable()) return [];
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(memoryThreads)
      .where(
        and(
          eq(memoryThreads.childId, childId),
          eq(memoryThreads.language, language),
          eq(memoryThreads.status, 'open'),
          eq(memoryThreads.sensitive, 0),
        ),
      )
      .orderBy(asc(memoryThreads.followUpAt));
    return rows.filter((r) => r.followUpAt).map(rowToThread);
  } catch {
    return [];
  }
}

export async function getThreadById(id: string): Promise<MemoryThreadRecord | null> {
  if (!isDbAvailable()) return null;
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(memoryThreads)
      .where(eq(memoryThreads.id, id))
      .limit(1);
    return row ? rowToThread(row) : null;
  } catch {
    return null;
  }
}

export async function markThreadAsked(id: string): Promise<void> {
  if (!isDbAvailable()) return;
  try {
    const db = getDb();
    await db
      .update(memoryThreads)
      .set({ status: 'asked', askedAt: isoDate(new Date()), updatedAt: new Date() })
      .where(eq(memoryThreads.id, id));
  } catch {
    /* non-critical */
  }
}

export async function markThreadResolved(id: string): Promise<void> {
  if (!isDbAvailable()) return;
  try {
    const db = getDb();
    await db
      .update(memoryThreads)
      .set({ status: 'resolved', resolvedAt: isoDate(new Date()), updatedAt: new Date() })
      .where(eq(memoryThreads.id, id));
  } catch {
    /* non-critical */
  }
}

/** All threads (any status, incl. sensitive) for a child — parent transparency view. */
export async function getAllThreads(
  childId: string,
  language: string,
): Promise<MemoryThreadRecord[]> {
  if (!isDbAvailable()) return [];
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(memoryThreads)
      .where(and(eq(memoryThreads.childId, childId), eq(memoryThreads.language, language)))
      .orderBy(desc(memoryThreads.mentionedAt));
    return rows.map(rowToThread);
  } catch {
    return [];
  }
}

/** Immediately record a sensitive thread when the real-time safety screen flags a
 * crisis — so the parent sees it and the alert fires without waiting for extraction. */
export async function recordSensitiveThread(
  childId: string,
  language: string,
  text: string,
): Promise<void> {
  if (!isDbAvailable()) return;
  try {
    const db = getDb();
    const today = isoDate(new Date());
    await db.insert(memoryThreads).values({
      childId,
      language,
      type: 'emotion',
      text: text.slice(0, 300),
      category: 'safety',
      sentiment: 'neg',
      sensitive: 1, // never pushed; surfaces to parent only
      status: 'open',
      mentionedAt: today,
      followUpAt: null,
      priority: 3,
    });
  } catch {
    /* non-critical */
  }
}

/** How many sensitive threads were captured for this child today (any language).
 * Drives the real-time "Хани noticed something" parent alert. */
export async function countSensitiveToday(childId: string): Promise<number> {
  if (!isDbAvailable()) return 0;
  try {
    const db = getDb();
    const today = isoDate(new Date());
    const rows = await db
      .select({ id: memoryThreads.id })
      .from(memoryThreads)
      .where(
        and(
          eq(memoryThreads.childId, childId),
          eq(memoryThreads.sensitive, 1),
          eq(memoryThreads.mentionedAt, today),
        ),
      );
    return rows.length;
  } catch {
    return 0;
  }
}

/** "Forget"/"stop asking" — mark a thread dismissed so it is never raised or pushed. */
export async function dismissThread(id: string): Promise<void> {
  if (!isDbAvailable()) return;
  try {
    const db = getDb();
    await db
      .update(memoryThreads)
      .set({ status: 'dismissed', updatedAt: new Date() })
      .where(eq(memoryThreads.id, id));
  } catch {
    /* non-critical */
  }
}

/** Remove a single static fact from childMemory (privacy "forget this"). */
export async function forgetFact(
  childId: string,
  language: string,
  fact: string,
): Promise<void> {
  if (!isDbAvailable()) return;
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(childMemory)
      .where(and(eq(childMemory.childId, childId), eq(childMemory.language, language)))
      .limit(1);
    if (!row) return;
    const target = fact.toLowerCase().trim();
    const facts = (row.facts ?? []).filter((f) => f.fact.toLowerCase().trim() !== target);
    await db
      .update(childMemory)
      .set({ facts, updatedAt: new Date() })
      .where(and(eq(childMemory.childId, childId), eq(childMemory.language, language)));
  } catch {
    /* non-critical */
  }
}

/** A line that tells the opener prompt to lead with this remembered thread. */
export function buildThreadContext(thread: MemoryThreadRecord, language: string): string {
  return language === 'en'
    ? `LEAD WITH THIS (genuine curiosity, not neediness): the child mentioned "${thread.text}". Open by warmly asking how it went / about it, then invite them to tell you more — in English.`
    : `НАЧНИ ИМЕННО С ЭТОГО (искренний интерес, без нужды): ребёнок упоминал "${thread.text}". Тепло спроси как всё прошло / об этом, потом пригласи рассказать подробнее — по-русски.`;
}

export function buildMemoryString(
  memory: ChildMemoryRecord,
  childName: string,
  language: string,
): string {
  const parts: string[] = [];

  if (memory.facts.length > 0) {
    const factLines = memory.facts
      .slice(-20) // last 20 most relevant facts
      .map((f) => `- ${f.fact}`)
      .join('\n');

    parts.push(language === 'en' ? `Facts about ${childName}:\n${factLines}` : `Факты о ${childName}:\n${factLines}`);
  }

  if (memory.thingsToAskBack.length > 0) {
    const askLines = memory.thingsToAskBack.map((q) => `- ${q}`).join('\n');
    parts.push(language === 'en' ? `Ask about this (if natural):\n${askLines}` : `Спроси об этом (если уместно):\n${askLines}`);
  }

  return parts.join('\n\n');
}

export function buildTimeContext(
  memory: ChildMemoryRecord,
  language: string,
): string {
  const now = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayNamesRu = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const dayIndex = now.getDay();
  const hour = now.getHours();
  const isEn = language === 'en';

  const dayName = isEn ? dayNames[dayIndex] : dayNamesRu[dayIndex];
  const isWeekend = dayIndex === 0 || dayIndex === 6;
  const isFriday = dayIndex === 5;
  const isMonday = dayIndex === 1;

  const lines: string[] = [
    isEn ? `Today is ${dayName}, ${hour}:00` : `Сегодня ${dayName}, ${hour}:00`,
  ];

  if (memory.lastInteractionDate) {
    const lastDate = new Date(memory.lastInteractionDate);
    const daysAgo = Math.round((now.getTime() - lastDate.getTime()) / 86400000);
    if (daysAgo === 0) {
      lines.push(isEn ? 'You talked earlier today.' : 'Вы уже разговаривали сегодня.');
    } else if (daysAgo === 1) {
      lines.push(isEn ? 'Last talked yesterday.' : 'Последний разговор был вчера.');
    } else {
      lines.push(
        isEn ? `Last talked ${daysAgo} days ago — greet them warmly.` : `Последний разговор был ${daysAgo} дней назад — тепло поздоровайся.`,
      );
    }
  } else {
    lines.push(isEn ? "This is your first conversation." : 'Это первый разговор.');
  }

  if (isFriday) {
    lines.push(
      isEn
        ? 'Tip: It is Friday — naturally ask about weekend plans.'
        : 'Подсказка: сейчас пятница — естественно спроси о планах на выходные.',
    );
  } else if (isMonday && memory.lastInteractionDate) {
    lines.push(
      isEn
        ? 'Tip: It is Monday — ask how the weekend was.'
        : 'Подсказка: сейчас понедельник — спроси как прошли выходные.',
    );
  } else if (isWeekend) {
    lines.push(
      isEn
        ? 'Tip: It is the weekend — great chance to ask what they are up to!'
        : 'Подсказка: сейчас выходные — отличный момент спросить чем занимается.',
    );
  }

  return lines.join('\n');
}
