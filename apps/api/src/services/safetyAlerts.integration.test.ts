/**
 * Server-side crisis escalation, against a REAL database.
 *
 * The behaviour under test is "an adult actually gets told", and every part of it
 * is a database interaction: the alert row must exist even when the email cannot
 * be delivered, the per-child cooldown is a query over previously *sent* rows,
 * and a guest trial has no deliverable address at all. Mocking the db would test
 * none of that.
 *
 * Requires DATABASE_URL (the dev Neon branch is fine — it only creates rows it
 * then deletes). Skipped automatically when unset.
 *
 *   pnpm --filter @soz/api test
 */

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import 'dotenv/config';
import { eq } from 'drizzle-orm';

import { closeDb, getDb, isDbAvailable } from '../db/client.js';
import { children, safetyAlerts, users } from '../db/schema.js';

// services/email.ts снимает RESEND_API_KEY один раз при загрузке модуля и без
// него уходит в dev-путь: печатает письмо в stdout и рапортует успех. Именно
// этот записанный исход здесь и проверяется, поэтому набор не должен зависеть
// от того, лежит ли у разработчика настоящий ключ в .env — с ключом Resend
// отвечает 422 на адреса @example.com ниже, и assert'ы переворачиваются.
// Удаляем ДО загрузки email.ts, а сам модуль тянем динамическим импортом,
// иначе статический импорт всплыл бы выше этой строки и снимок был бы сделан
// раньше. Тот же приём, что в spend.test.ts.
delete process.env.RESEND_API_KEY;

const { getSafetyAlerts, raiseCrisisAlert } = await import('./safetyAlerts.js');

const hasDb = isDbAvailable();

describe('crisis escalation', { skip: hasDb ? false : 'DATABASE_URL not set' }, () => {
  const stamp = Date.now();
  let parentUserId: string;
  let parentChildId: string;
  let guestUserId: string;
  let guestChildId: string;

  const makeFamily = async (email: string, isGuest: number) => {
    const db = getDb();
    const [u] = await db
      .insert(users)
      .values({ email, passwordHash: 'x', isGuest })
      .returning({ id: users.id });
    const [kid] = await db
      .insert(children)
      .values({ userId: u!.id, name: 'Test', age: 8, learningLanguages: ['en'] })
      .returning({ id: children.id });
    return { userId: u!.id, childId: kid!.id };
  };

  before(async () => {
    // A registered parent: RESEND_API_KEY is deleted above, so sendEmail takes
    // its dev path and reports success — which is what we want to assert, that
    // the send was attempted and its outcome recorded.
    const parent = await makeFamily(`test-crisis-${stamp}@example.com`, 0);
    parentUserId = parent.userId;
    parentChildId = parent.childId;

    const guest = await makeFamily(`test-crisis-guest-${stamp}@guest.invalid`, 1);
    guestUserId = guest.userId;
    guestChildId = guest.childId;
  });

  after(async () => {
    const db = getDb();
    // children and alerts cascade from users
    await db.delete(users).where(eq(users.id, parentUserId));
    await db.delete(users).where(eq(users.id, guestUserId));
    await closeDb();
  });

  it('persists the alert and emails the parent', async () => {
    const out = await raiseCrisisAlert({
      childId: parentChildId,
      language: 'ru',
      category: 'abuse',
      conversationId: `conv-${stamp}`,
    });

    assert.ok(out.alertId, 'an alert row was created');
    assert.equal(out.emailStatus, 'sent');

    const [row] = await getDb()
      .select()
      .from(safetyAlerts)
      .where(eq(safetyAlerts.id, out.alertId!));

    assert.equal(row!.childId, parentChildId);
    assert.equal(row!.userId, parentUserId, 'the alert is bound to the owning parent');
    assert.equal(row!.category, 'abuse');
    assert.equal(row!.emailStatus, 'sent', 'the delivery outcome is written back');
    assert.equal(row!.emailError, null);
    assert.equal(row!.degraded, 0);
  });

  it('records a second crisis but does not email again within the cooldown', async () => {
    const out = await raiseCrisisAlert({
      childId: parentChildId,
      language: 'ru',
      category: 'self_harm',
    });

    assert.ok(out.alertId, 'the episode is still recorded in full');
    assert.equal(out.emailStatus, 'skipped_throttled', 'the parent is not mailed twice');

    const alerts = await getSafetyAlerts(parentChildId);
    assert.equal(alerts.length, 2, 'both alerts are visible to the parent');
  });

  it('records the degraded flag when the keyword fallback raised it', async () => {
    const out = await raiseCrisisAlert({
      childId: guestChildId,
      language: 'en',
      category: 'keyword_fallback',
      degraded: true,
    });

    const [row] = await getDb()
      .select()
      .from(safetyAlerts)
      .where(eq(safetyAlerts.id, out.alertId!));
    assert.equal(row!.degraded, 1, 'triage can tell a classifier flag from a keyword one');
  });

  it('has no deliverable address for a guest trial, and says so', async () => {
    const out = await raiseCrisisAlert({
      childId: guestChildId,
      language: 'en',
      category: 'self_harm',
    });

    assert.ok(out.alertId, 'still recorded — the crisis happened either way');
    assert.equal(
      out.emailStatus,
      'skipped_guest',
      'a @guest.invalid address can never receive mail; the row shows why nobody was told',
    );
  });

  it('never throws for an unknown child', async () => {
    const out = await raiseCrisisAlert({
      childId: '00000000-0000-4000-8000-000000000000',
      language: 'en',
      category: 'self_harm',
    });
    assert.equal(out.alertId, null);
    assert.equal(out.emailStatus, 'not_recorded');
  });
});
