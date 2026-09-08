/**
 * Server-side crisis escalation.
 *
 * Before this, the parent alert was a LOCAL notification fired by the CHILD's own
 * device (`notifyParentSensitive` in app/talk.tsx). That meant the alert was lost
 * whenever the child closed the app right after the disclosure — which is exactly
 * what a distressed child does — or had notifications denied, or was on a device
 * the parent never looks at. The server already knew about the crisis and did
 * nothing with it.
 *
 * Now the server owns escalation: it persists an auditable record and emails the
 * parent, independent of the app's lifecycle. The local notification stays as an
 * immediate nudge for the case where the parent is holding the device.
 */

import { and, desc, eq, gt } from 'drizzle-orm';

import { getDb, isDbAvailable } from '../db/client.js';
import { children, safetyAlerts, users } from '../db/schema.js';

import { crisisAlertEmail, crisisOperatorEmail, sendEmail } from './email.js';

/**
 * A second crisis turn minutes after the first is the same episode, not new news.
 * Every alert is still persisted — only the email is suppressed — so the parent
 * report and operator triage keep the full picture.
 */
const EMAIL_COOLDOWN_MS = 6 * 60 * 60 * 1000;

/** Guest trials get a synthetic `@guest.invalid` address (RFC 2606) that can
 *  never receive mail. Nothing to escalate to until the parent registers. */
function isUndeliverable(email: string): boolean {
  return email.endsWith('@guest.invalid');
}

export interface CrisisAlertInput {
  childId: string;
  language: string;
  category: string;
  conversationId?: string;
  degraded?: boolean;
}

export interface CrisisAlertOutcome {
  alertId: string | null;
  emailStatus: 'sent' | 'failed' | 'skipped_guest' | 'skipped_throttled' | 'not_recorded';
}

/**
 * Record the crisis and notify the parent. Never throws — a failure here must not
 * turn into a 500 that hides the calm safe reply from the child.
 */
export async function raiseCrisisAlert(input: CrisisAlertInput): Promise<CrisisAlertOutcome> {
  if (!isDbAvailable()) return { alertId: null, emailStatus: 'not_recorded' };

  try {
    const db = getDb();

    const [row] = await db
      .select({
        userId: children.userId,
        childName: children.name,
        email: users.email,
      })
      .from(children)
      .innerJoin(users, eq(users.id, children.userId))
      .where(eq(children.id, input.childId))
      .limit(1);

    if (!row) {
      console.error('[safety] crisis for unknown child', input.childId);
      return { alertId: null, emailStatus: 'not_recorded' };
    }

    // Persist FIRST. The record is the part that must survive; the email is a
    // best-effort delivery on top of it. If the send dies, the row still shows a
    // parent was owed an alert and the status says why it never arrived.
    const [alert] = await db
      .insert(safetyAlerts)
      .values({
        childId: input.childId,
        userId: row.userId,
        kind: 'crisis',
        category: input.category,
        language: input.language,
        conversationId: input.conversationId ?? null,
        degraded: input.degraded ? 1 : 0,
        emailStatus: 'pending',
      })
      .returning({ id: safetyAlerts.id });

    const alertId = alert?.id ?? null;
    if (!alertId) return { alertId: null, emailStatus: 'not_recorded' };

    const status = await deliverAlert({
      alertId,
      childId: input.childId,
      childName: row.childName,
      email: row.email,
      category: input.category,
      language: input.language,
      degraded: !!input.degraded,
    });

    await db
      .update(safetyAlerts)
      .set({ emailStatus: status.emailStatus, emailError: status.error ?? null })
      .where(eq(safetyAlerts.id, alertId));

    console.log(
      `[safety] crisis alert ${alertId} child=${input.childId} category=${input.category} email=${status.emailStatus}`,
    );
    return { alertId, emailStatus: status.emailStatus };
  } catch (e) {
    // Loudly — a swallowed failure here means a child disclosed a crisis and no
    // adult was ever told.
    console.error('[safety] FAILED to raise crisis alert', input.childId, e);
    return { alertId: null, emailStatus: 'not_recorded' };
  }
}

async function deliverAlert(args: {
  alertId: string;
  childId: string;
  childName: string;
  email: string;
  category: string;
  language: string;
  degraded: boolean;
}): Promise<{ emailStatus: CrisisAlertOutcome['emailStatus']; error?: string }> {
  // The operator copy is independent of the parent one: it must go out even when
  // the parent email is throttled or undeliverable, because it is the only path
  // that surfaces a guest-account crisis to a human at all.
  const operator = process.env.SAFETY_OPERATOR_EMAIL;
  if (operator) {
    const tpl = crisisOperatorEmail({
      alertId: args.alertId,
      childId: args.childId,
      category: args.category,
      language: args.language,
      degraded: args.degraded,
    });
    sendEmail({ to: operator, ...tpl, timeoutMs: 8_000 }).catch(() => {
      /* operator copy is best-effort — the parent path is what we report on */
    });
  }

  if (isUndeliverable(args.email)) return { emailStatus: 'skipped_guest' };

  if (await recentlyEmailed(args.childId)) return { emailStatus: 'skipped_throttled' };

  const tpl = crisisAlertEmail(args.childName);
  const res = await sendWithOneFastRetry({ to: args.email, ...tpl });
  if (!res.ok) return { emailStatus: 'failed', error: res.reason?.slice(0, 300) };
  return { emailStatus: 'sent' };
}

const SEND_TIMEOUT_MS = 8_000;
/** Only retry a failure that came back quickly. */
const FAST_FAILURE_MS = 2_000;

/**
 * The child is waiting on this request — the crisis reply is not returned until
 * escalation settles — so the send cannot retry freely. A failure that came back
 * fast (connection reset, a 5xx) is worth one more try and costs little; a
 * failure that took the full timeout means the provider is hanging, and trying
 * again would just double how long a distressed child stares at a silent screen.
 */
async function sendWithOneFastRetry(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const start = Date.now();
  const first = await sendEmail({ ...args, timeoutMs: SEND_TIMEOUT_MS });
  if (first.ok) return first;

  if (Date.now() - start > FAST_FAILURE_MS) return first;
  console.warn('[safety] crisis email failed fast, retrying once:', first.reason);
  return sendEmail({ ...args, timeoutMs: SEND_TIMEOUT_MS });
}

/**
 * Was a crisis email already DELIVERED for this child inside the cooldown?
 *
 * Deliberately keyed on 'sent' rather than on any alert row: a throttled or
 * undeliverable attempt must not start a cooldown of its own, or one guest-era
 * alert would mute the parent's first real one.
 */
async function recentlyEmailed(childId: string): Promise<boolean> {
  try {
    const since = new Date(Date.now() - EMAIL_COOLDOWN_MS);
    const rows = await getDb()
      .select({ id: safetyAlerts.id })
      .from(safetyAlerts)
      .where(
        and(
          eq(safetyAlerts.childId, childId),
          eq(safetyAlerts.emailStatus, 'sent'),
          gt(safetyAlerts.createdAt, since),
        ),
      )
      .limit(1);
    return rows.length > 0;
  } catch {
    // Unknown throttle state — send. A duplicate email is a far smaller failure
    // than a missing one.
    return false;
  }
}

/** Crisis alerts for a child, newest first — parent transparency view. */
export async function getSafetyAlerts(childId: string, limit = 20) {
  if (!isDbAvailable()) return [];
  try {
    return await getDb()
      .select({
        id: safetyAlerts.id,
        category: safetyAlerts.category,
        language: safetyAlerts.language,
        emailStatus: safetyAlerts.emailStatus,
        createdAt: safetyAlerts.createdAt,
      })
      .from(safetyAlerts)
      .where(eq(safetyAlerts.childId, childId))
      .orderBy(desc(safetyAlerts.createdAt))
      .limit(limit);
  } catch {
    return [];
  }
}
