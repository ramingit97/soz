import { and, eq } from 'drizzle-orm';

import { getDb, isDbAvailable } from '../db/client.js';
import { conversations } from '../db/schema.js';
import type { ConversationTurn } from './llm.js';

// ── In-memory fallback (when no DB) ──────────────────────────────────────────

interface MemConversation {
  id: string;
  turns: ConversationTurn[];
  updatedAt: number;
}

const memStore = new Map<string, MemConversation>();
const MAX_TURNS = 16;
const TTL_MS = 60 * 60 * 1000;

setInterval(() => {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, c] of memStore) {
    if (c.updatedAt < cutoff) memStore.delete(id);
  }
}, 5 * 60 * 1000).unref();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Turns for a conversation.
 *
 * `childId` scopes the lookup and is not optional in practice: conversation ids
 * are built client-side from a predictable template (`<childId>-d<day>-<lang>`),
 * so an id alone is a guessable handle, not a capability. Matching on the owning
 * child means a caller cannot read back a conversation belonging to someone else
 * by passing their own childId alongside a borrowed conversationId.
 */
export async function getHistory(
  conversationId: string,
  childId?: string,
): Promise<ConversationTurn[]> {
  if (!isDbAvailable()) {
    return (memStore.get(conversationId)?.turns ?? []).slice(-MAX_TURNS);
  }

  try {
    const db = getDb();
    const [row] = await db
      .select({ turns: conversations.turns })
      .from(conversations)
      .where(
        childId
          ? and(eq(conversations.id, conversationId), eq(conversations.childId, childId))
          : eq(conversations.id, conversationId),
      )
      .limit(1);

    if (!row) return [];
    return (row.turns as ConversationTurn[]).slice(-MAX_TURNS);
  } catch {
    return (memStore.get(conversationId)?.turns ?? []).slice(-MAX_TURNS);
  }
}

export async function appendTurn(
  conversationId: string,
  turn: ConversationTurn,
  meta?: { childId?: string; language?: string; day?: number },
): Promise<void> {
  // Always update in-memory (for resilience)
  const now = Date.now();
  const existing = memStore.get(conversationId);
  if (existing) {
    existing.turns.push(turn);
    existing.updatedAt = now;
  } else {
    memStore.set(conversationId, { id: conversationId, turns: [turn], updatedAt: now });
  }

  if (!isDbAvailable()) return;

  try {
    const db = getDb();
    const [row] = await db
      .select({ turns: conversations.turns, childId: conversations.childId })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    const newTurn = { role: turn.role, text: turn.text };

    if (row) {
      // Never write turns into a conversation owned by a different child: ids are
      // client-supplied and predictable, so this is the last line of defence.
      if (meta?.childId && row.childId && row.childId !== meta.childId) {
        console.warn('[conversations] childId mismatch — refusing to append', { conversationId });
        return;
      }

      const updatedTurns = [...(row.turns as ConversationTurn[]), newTurn];
      await db
        .update(conversations)
        .set({
          turns: updatedTurns,
          updatedAt: new Date(),
          // Adopt only an UNOWNED row. Rows written before childId was threaded
          // through all landed with child_id NULL, which left the parent
          // transcripts screen (queried by childId) permanently empty. Claiming
          // an already-owned row here would instead hand one child's
          // conversation to another.
          ...(meta?.childId && !row.childId ? { childId: meta.childId } : {}),
        })
        .where(eq(conversations.id, conversationId));
    } else {
      await db.insert(conversations).values({
        id: conversationId,
        childId: meta?.childId ?? null,
        language: meta?.language ?? 'en',
        day: meta?.day ?? 1,
        turns: [newTurn],
      });
    }
  } catch (e) {
    console.warn('[conversations] DB write failed (in-memory only):', e);
  }
}

export function resetConversation(conversationId: string): void {
  memStore.delete(conversationId);
}
