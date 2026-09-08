/**
 * Verify that email actually leaves the building.
 *
 * `sendEmail` falls back to printing to stdout and returning ok:true when
 * RESEND_API_KEY is unset — which is convenient in dev and dangerous in prod: a
 * password reset, an email verification and now a crisis alert all "succeed"
 * while delivering nothing. Nothing in the app can tell the difference, so this
 * script exists to check it against the real provider before launch.
 *
 *   pnpm --filter @soz/api exec tsx src/scripts/check-email.ts you@example.com
 *   pnpm --filter @soz/api exec tsx src/scripts/check-email.ts you@example.com crisis
 *
 * Sends a real message. Costs one email from the Resend quota.
 */

import 'dotenv/config';

import { crisisAlertEmail, emailVerificationEmail, sendEmail } from '../services/email.js';

const to = process.argv[2];
const kind = process.argv[3] ?? 'verification';

if (!to || !to.includes('@')) {
  console.error('usage: tsx src/scripts/check-email.ts <address> [verification|crisis]');
  process.exit(1);
}

if (!process.env.RESEND_API_KEY?.trim()) {
  console.error('✗ RESEND_API_KEY is not set.');
  console.error('  sendEmail would log to stdout and report success — which is exactly');
  console.error('  the failure this script exists to catch. Set the key and re-run.');
  process.exit(1);
}

const tpl = kind === 'crisis' ? crisisAlertEmail('Тест') : emailVerificationEmail('123456', 'Тест');

console.log(`from:    ${process.env.RESEND_FROM ?? 'Söz <hello@YOUR-DOMAIN>'}`);
console.log(`to:      ${to}`);
console.log(`subject: ${tpl.subject}\n`);

const res = await sendEmail({ to, ...tpl });

if (res.ok) {
  console.log('✓ Resend accepted the message.');
  console.log('  Now CHECK THE INBOX — acceptance is not delivery. A sending domain');
  console.log('  that is not verified in Resend gets accepted and then dropped, and');
  console.log('  an unverified from-address lands in spam.');
  process.exit(0);
}

console.error(`✗ send failed: ${res.reason}`);
process.exit(1);
