/**
 * Lightweight email sender. Uses Resend (https://resend.com) when RESEND_API_KEY
 * is set, otherwise logs to console (useful in dev / staging).
 *
 * Resend has a free tier of 3,000 emails/month — plenty for early users.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM ?? 'Söz <hello@YOUR-DOMAIN>';
// Where a parent's reply lands. The From address must be on a domain verified
// in Resend (a gmail.com sender is rejected), so the human inbox is separate.
const REPLY_TO = process.env.RESEND_REPLY_TO?.trim() || undefined;

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Abort the request after this long. The crisis alert is sent while a child is
   *  waiting for Хани to answer, so an unbounded fetch would stall that reply. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

export async function sendEmail({ to, subject, html, text, timeoutMs }: SendArgs): Promise<{ ok: boolean; reason?: string }> {
  if (!RESEND_API_KEY) {
    console.log('\n[email:dev]');
    console.log(`  to: ${to}`);
    console.log(`  subject: ${subject}`);
    console.log(`  ${text ?? html.replace(/<[^>]+>/g, ' ')}\n`);
    return { ok: true, reason: 'logged_in_dev' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        ...(REPLY_TO ? { reply_to: REPLY_TO } : {}),
        subject,
        html,
        text: text ?? html.replace(/<[^>]+>/g, ' '),
      }),
      signal: AbortSignal.timeout(timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[email] resend error:', res.status, body);
      return { ok: false, reason: `${res.status} ${body}` };
    }
    return { ok: true };
  } catch (e) {
    console.error('[email] send failed:', e);
    return { ok: false, reason: e instanceof Error ? e.message : 'unknown' };
  }
}

// ── Templates ────────────────────────────────────────────────────────────────

export function passwordResetEmail(code: string): { subject: string; html: string; text: string } {
  return {
    subject: 'Söz — код для сброса пароля',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #7C5CFF;">Söz — Сброс пароля</h2>
        <p>Введите этот код в приложении, чтобы создать новый пароль:</p>
        <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; background: #FFF8F0; padding: 16px; text-align: center; border-radius: 12px; color: #1A1330;">
          ${code}
        </div>
        <p style="color: #888; font-size: 13px; margin-top: 16px;">
          Код действует 15 минут. Если вы не запрашивали сброс — просто проигнорируйте это письмо.
        </p>
      </div>
    `,
    text: `Söz — код для сброса пароля: ${code}. Код действует 15 минут.`,
  };
}

export function emailVerificationEmail(code: string, childName?: string): { subject: string; html: string; text: string } {
  const greeting = childName ? `Привет! Подтвердите email для ${childName}` : 'Подтвердите ваш email';
  return {
    subject: `Söz — ${greeting}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #7C5CFF;">Söz — Подтверждение email</h2>
        <p>Введите этот код в приложении, чтобы подтвердить email:</p>
        <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; background: #FFF8F0; padding: 16px; text-align: center; border-radius: 12px; color: #1A1330;">
          ${code}
        </div>
        <p style="color: #888; font-size: 13px; margin-top: 16px;">
          Код действует 24 часа. Если вы не регистрировались — просто проигнорируйте это письмо.
        </p>
      </div>
    `,
    text: `Söz — код подтверждения email: ${code}. Код действует 24 часа.`,
  };
}

/**
 * Neutral crisis alert to the parent.
 *
 * Deliberately carries NO details — not the transcript, not even the category.
 * Two reasons. Privacy: email is an unencrypted channel that lands in inboxes the
 * child may also read on a shared device. Safety: when the flagged category is
 * abuse, the parent reading this may be the person the child is afraid of, and a
 * specific accusation delivered to them can put the child at greater risk than
 * saying nothing. The details stay in the app behind the parent's login.
 *
 * Bilingual (ru + az) because the server does not know the parent's UI language —
 * that setting lives in the app's local store and is never sent up.
 */
export function crisisAlertEmail(childName: string): { subject: string; html: string; text: string } {
  const safeName = childName.replace(/[<>&]/g, '').slice(0, 40) || 'вашего ребёнка';
  return {
    subject: '💛 Söz — пожалуйста, поговорите с ребёнком сегодня',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #7C5CFF;">Söz</h2>
        <p style="font-size: 16px; line-height: 1.5;">
          Во время разговора с Хани ${safeName} упомянул(а) что-то важное и тревожное.
          Мы не приводим подробности в письме — откройте раздел «Отчёт для родителя»
          в приложении и мягко, без давления поговорите с ребёнком сегодня.
        </p>
        <p style="font-size: 14px; line-height: 1.5; color: #444;">
          Если ребёнок в опасности — детская горячая линия Азербайджана
          <strong>116 111</strong> (круглосуточно, бесплатно, анонимно).
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 15px; line-height: 1.5;">
          Хani ilə söhbətdə ${safeName} narahatlıq doğuran bir şey danışdı.
          Təfərrüatları məktubda göstərmirik — tətbiqdəki «Valideyn hesabatı»
          bölməsinə baxın və bu gün uşaqla mehribanca danışın.
        </p>
        <p style="font-size: 14px; line-height: 1.5; color: #444;">
          Təhlükə varsa — Uşaq qaynar xətti <strong>116 111</strong> (24/7, pulsuz, anonim).
        </p>
        <p style="color: #888; font-size: 12px; margin-top: 20px;">
          Хани — ИИ-помощник, а не специалист. Это письмо отправлено автоматически.
        </p>
      </div>
    `,
    text:
      `Söz: во время разговора с Хани ${safeName} упомянул(а) что-то важное и тревожное. ` +
      `Откройте «Отчёт для родителя» в приложении и мягко поговорите с ребёнком сегодня. ` +
      `Детская горячая линия Азербайджана: 116 111 (круглосуточно, бесплатно).\n\n` +
      `Хani ilə söhbətdə ${safeName} narahatlıq doğuran bir şey danışdı. Tətbiqdəki ` +
      `«Valideyn hesabatı» bölməsinə baxın. Uşaq qaynar xətti: 116 111.`,
  };
}

/** Operator copy — carries the category so triage can prioritise. Only sent when
 * SAFETY_OPERATOR_EMAIL is set; never contains the child's words. */
export function crisisOperatorEmail(args: {
  alertId: string;
  childId: string;
  category: string;
  language: string;
  degraded: boolean;
}): { subject: string; html: string; text: string } {
  const body =
    `alert=${args.alertId}\nchild=${args.childId}\ncategory=${args.category}\n` +
    `language=${args.language}\nmode=${args.degraded ? 'keyword-fallback (classifier down)' : 'classifier'}`;
  return {
    subject: `[Söz safety] crisis flagged — ${args.category}`,
    html: `<pre style="font-family: ui-monospace, monospace; font-size: 13px;">${body}</pre>`,
    text: body,
  };
}
