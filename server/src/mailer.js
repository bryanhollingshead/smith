// Smith — Email dispatch
//
// Three behaviors, layered:
//
//   1. ALWAYS write to mock_emails table. This is our durable log + dev UI
//      backup. Even after we send via a real provider, we keep the trail.
//
//   2. ALWAYS console.log to stdout. Render Logs becomes a tail of every
//      email Smith has ever sent. Useful for debugging in prod.
//
//   3. WHEN RESEND_API_KEY is set, dispatch the email via Resend. If the
//      Resend call fails (network blip, quota exhausted, whatever), we log
//      the failure but DO NOT throw — the mock_emails row + logs are
//      enough for the user to recover via the admin path. Sign-up and
//      password-reset must NEVER crash because email had a hiccup.
//
// Function signatures (sendVerificationEmail, sendResetEmail) are UNCHANGED
// from the previous version. Callers in routes/auth.js need no edits.

import { q } from './db.js';

// Lazy Resend client — only initialized if RESEND_API_KEY is set. Keeps
// dev environments dependency-free; no failure if Resend isn't installed
// or configured.
let resendClient = null;
async function getResend() {
  if (resendClient) return resendClient;
  if (!process.env.RESEND_API_KEY) return null;
  try {
    const { Resend } = await import('resend');
    resendClient = new Resend(process.env.RESEND_API_KEY);
    return resendClient;
  } catch (err) {
    console.error('[mailer] resend package not installed; falling back to mock-only:', err.message);
    return null;
  }
}

// Where do we send from? Configurable via env var so we can switch from
// resend.dev sandbox sender → smith.app once domain is verified.
function getFromAddress() {
  return process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
}

// Send via Resend. Catches all errors — never throws to caller. Returns
// truthy on success, falsy on failure.
async function tryResendSend({ to, subject, html, text }) {
  const resend = await getResend();
  if (!resend) return false;

  try {
    const result = await resend.emails.send({
      from: getFromAddress(),
      to,
      subject,
      html,
      text,
    });
    if (result.error) {
      console.error(`[mailer] resend send failed for ${to}:`, result.error);
      return false;
    }
    console.log(`[mailer] resend sent to ${to} (id=${result.data?.id})`);
    return true;
  } catch (err) {
    console.error(`[mailer] resend send threw for ${to}:`, err.message);
    return false;
  }
}

// Core "send an email" function. Writes to mock_emails table, logs to
// stdout, and ALSO sends via Resend if configured. Never throws.
export async function sendMockEmail({ to, subject, body, kind, meta, html }) {
  // Always: write to mock_emails table. This is the source of truth for
  // "what did Smith try to send".
  await q(
    `INSERT INTO mock_emails (to_email, subject, body, kind, meta) VALUES ($1,$2,$3,$4,$5)`,
    [to, subject, body, kind, meta || null]
  );

  // Always: log to stdout for Render Logs / dev terminal visibility.
  if (process.env.NODE_ENV !== 'test') {
    console.log(`\n[mailer] → ${to}  ${subject}\n${body}\n`);
  }

  // Maybe: dispatch via Resend if configured.
  // We pass html when available — Resend sends both, and clients show whichever they prefer.
  await tryResendSend({
    to,
    subject,
    text: body,
    html: html || htmlFromText(body),
  });
}

// Translate the plain-text body into a minimal HTML email. We do this so
// modern email clients render it nicely without us having to write two
// versions of every message body. The result is plain prose in a
// constrained-width container with proper line wrapping.
function htmlFromText(text) {
  const escape = (s) =>
    s.replace(/&/g, '&amp;')
     .replace(/</g, '&lt;')
     .replace(/>/g, '&gt;');
  // Linkify https URLs so they're clickable in HTML clients.
  const linkify = (s) =>
    s.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" style="color:#C8731F">$1</a>');
  const paragraphs = escape(text)
    .split(/\n\n+/)
    .map(p => `<p style="margin:0 0 16px">${linkify(p.replace(/\n/g, '<br>'))}</p>`)
    .join('\n');
  return `<!doctype html>
<html><body style="font-family: -apple-system, system-ui, sans-serif; color:#2a1f17; background:#f4ede0; padding: 32px;">
<div style="max-width: 560px; margin: 0 auto; background: #fff8ee; padding: 32px; border-radius: 6px;">
<div style="font-weight:600; font-size:18px; color:#C8731F; margin-bottom:24px; letter-spacing:-0.01em;">Smith</div>
${paragraphs}
<p style="margin-top: 32px; font-size: 12px; color: #8a7a6a; font-style: italic;">— The Smith team</p>
</div></body></html>`;
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

// Reset link uses hash-routing format (#/auth/reset?token=...) because the
// React app uses hash routing on the client side. Without the # the path
// won't resolve to the reset page.
export async function sendResetEmail(to, token, clientOrigin) {
  // Normalize the origin: strip any trailing slash, ensure no path appended.
  const base = (clientOrigin || '').replace(/\/+$/, '');
  const link = `${base}/#/auth/reset?token=${token}`;
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
