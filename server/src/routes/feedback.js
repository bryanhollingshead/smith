// Smith — Feedback Signal endpoint
//
// One endpoint, one adapter (server/src/linear.js). The widget POSTs a
// Signal payload + optional annotated PNG; we re-derive `source` from
// req.user.is_pm (never trust the client), then hand the signal off to
// the Linear adapter. Swapping backends later is a one-function change in
// linear.js; this route and the widget stay the same.

import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware.js';
import { createSignalInLinear } from '../linear.js';

const router = Router();

// Screenshots cap at 5MB. Higher than necessary, lower than abusive.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

function withUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ error: err.message || 'Upload failed.' });
    }
    next();
  });
}

const TYPES = new Set(['bug', 'idea', 'question', 'other']);

// POST /api/feedback
// multipart/form-data:
//   - file:    annotated PNG (optional)
//   - payload: JSON string of { type, comment, helpRequest?, context }
// Server adds source from req.user.is_pm and forwards to Linear.
router.post('/', requireAuth, withUpload, async (req, res) => {
  let payload;
  try {
    payload = JSON.parse(req.body?.payload || '{}');
  } catch {
    return res.status(400).json({ error: 'payload must be valid JSON' });
  }

  const type = String(payload.type || '').toLowerCase();
  if (!TYPES.has(type)) return res.status(400).json({ error: 'invalid type' });

  const comment = String(payload.comment || '').trim();
  const helpRequest = payload.helpRequest ? String(payload.helpRequest).trim() : '';
  if (!comment && !helpRequest) {
    return res.status(400).json({ error: 'comment or helpRequest required' });
  }

  // Re-derive source server-side. The client value is ignored on purpose:
  // anyone could craft a fetch and lie about their role.
  const source = req.user?.is_pm ? 'pm' : 'customer';

  // Trust the client's context block as informational — it's UA/route/viewport
  // metadata the user already had on their screen. We stamp userId and
  // userName from req.user so they can't be spoofed.
  const ctxIn = payload.context || {};
  const name = `${req.user?.first_name || ''} ${req.user?.last_name || ''}`.trim();
  const context = {
    userId: String(req.user?.id || ''),
    userName: name,
    role: req.user?.is_pm ? 'pm'
        : (ctxIn.role || ''),
    url: String(ctxIn.url || ''),
    route: String(ctxIn.route || ''),
    appVersion: String(ctxIn.appVersion || ''),
    viewport: ctxIn.viewport && Number.isFinite(ctxIn.viewport.w) && Number.isFinite(ctxIn.viewport.h)
      ? { w: ctxIn.viewport.w, h: ctxIn.viewport.h }
      : null,
    userAgent: String(req.headers['user-agent'] || ''),
    timestamp: new Date().toISOString(),
  };

  // Structured annotation marks from the full-window overlay, when used.
  // Each entry is { kind: 'pin'|'box'|'arrow', x, y, w?, h?, x2?, y2?, comment? }.
  // The PNG already has the marks burned in; this lets Linear render them as
  // a numbered list under the screenshot so triagers can quote them.
  let marks = [];
  if (Array.isArray(payload.marks)) {
    marks = payload.marks
      .filter(m => m && typeof m === 'object' && ['pin', 'box', 'arrow'].includes(m.kind))
      .slice(0, 64);  // belt + suspenders on payload size
  }

  const signal = { source, type, comment, helpRequest, context, marks };

  try {
    const { issueUrl, identifier } = await createSignalInLinear(signal, req.file?.buffer);
    res.status(201).json({ ok: true, issueUrl, identifier });
  } catch (e) {
    console.error('[feedback] linear adapter failed:', e);
    res.status(502).json({ error: 'Could not file the feedback. Try again in a moment.' });
  }
});

// POST /api/feedback/help
// Stub for the AI "Get help" path. The widget keeps the field enabled but
// surfaces the disabled response so we can't accidentally route real help
// requests into the void. TODO: wire to a real Claude-backed Agent Smith
// endpoint when it lands.
router.post('/help', requireAuth, (req, res) => {
  res.status(503).json({
    disabled: true,
    message: 'The Get-help agent is not wired yet. Your question was not sent.',
  });
});

export default router;
