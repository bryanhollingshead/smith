// Smith — Mock email
// In production this would dispatch via SES/Postmark/etc. In dev we write to the
// mock_emails table and log to stdout, so tests + the dev UI can read what was sent.

import { q } from './db.js';

export async function sendMockEmail({ to, subject, body, kind, meta }) {
  await q(
    `INSERT INTO mock_emails (to_email, subject, body, kind, meta) VALUES ($1,$2,$3,$4,$5)`,
    [to, subject, body, kind, meta || null]
  );
  if (process.env.NODE_ENV !== 'test') {
    console.log(`\n[mock-email] → ${to}  ${subject}\n${body}\n`);
  }
}

export async function sendVerificationEmail(to, code) {
  return sendMockEmail({
    to,
    subject: 'Your Smith verification code',
    body:
      `Welcome to Smith.\n\n` +
      `Your 6-digit verification code is: ${code}\n` +
      `It expires in 15 minutes.\n\n` +
      `— The Smith team`,
    kind: 'verification',
    meta: { code },
  });
}

export async function sendResetEmail(to, token, clientOrigin) {
  const link = `${clientOrigin}/auth/reset?token=${token}`;
  return sendMockEmail({
    to,
    subject: 'Reset your Smith password',
    body:
      `We got a request to reset your Smith password.\n\n` +
      `Open this link to set a new password (valid for 30 minutes):\n${link}\n\n` +
      `If you didn't ask for this, you can ignore this message.`,
    kind: 'reset',
    meta: { token, link },
  });
}
