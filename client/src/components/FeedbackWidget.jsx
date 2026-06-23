// Smith — Feedback widget (Signal v1)
//
// A floating button at bottom-right opens a slide-out sidebar that lets the
// user capture a still of the current screen, optionally annotate it
// (rectangle, pin) with a short text label, write a comment, pick a type,
// and (optionally) ask for help. Submission POSTs a Signal-shaped payload
// to /api/feedback; the server stamps the source (pm vs customer) from the
// authenticated user and files a Linear issue via the linear.js adapter.
//
// Architecture notes:
// - html-to-image is used to snapshot document.body. This is DOM-to-canvas,
//   not a real browser screenshot — it's lossy for cross-origin images,
//   WebGL/canvas content, and some CSS (filters, complex blend modes).
//   Acceptable tradeoff for v1; we get zero permission prompts.
// - Annotations are baked into the exported PNG. Coordinate overlays
//   surfaced on the Linear issue would be a v2 nicety.
// - The widget reads the signed-in user + current route from existing
//   context (useAuth, useRouter). No extra fetches, no extra storage.
// - The widget itself is hidden during snapshot via a data attribute the
//   html-to-image filter callback excludes — otherwise the floating button
//   shows up on every screenshot.

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from './Icon.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { useRouter } from '../lib/router.jsx';
import { captureViewportPng } from '../lib/feedback-capture.js';
import { AnnotateOverlay } from './AnnotateOverlay.jsx';

// VITE_FEEDBACK_FULL_ANNOTATE defaults to ON. Flip to 'false' in env to
// fall back to the inline editor.
const FULL_ANNOTATE = import.meta.env.VITE_FEEDBACK_FULL_ANNOTATE !== 'false';

const TYPES = [
  { k: 'bug',      label: 'Bug',      icon: 'hardhat' },
  { k: 'idea',     label: 'Idea',     icon: 'award' },
  { k: 'question', label: 'Question', icon: 'message' },
  { k: 'other',    label: 'Other',    icon: 'edit' },
];

export function FeedbackWidget() {
  const { user } = useAuth();
  const { path } = useRouter();
  const [open, setOpen] = useState(false);

  // Hide the widget when the user is mid-screenshot — set on snapshot start,
  // cleared when done. We use a data attribute that html-to-image's filter
  // callback can read, so the widget vanishes from the captured frame without
  // a visible flicker in the live UI.
  const widgetRef = useRef(null);

  if (!user) return null;

  return (
    <div
      ref={widgetRef}
      data-feedback-widget="true"
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1000 }}
    >
      {/* Floating button — re-enables pointer events for itself only. */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Send feedback"
          style={{
            position: 'absolute', bottom: 24, right: 24,
            width: 52, height: 52, borderRadius: '50%',
            background: B.text, color: B.surface, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', pointerEvents: 'auto',
            boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
          }}
        >
          <Icon name="message" size={22}/>
        </button>
      )}

      {open && (
        <FeedbackSidebar
          user={user}
          path={path}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────
function FeedbackSidebar({ user, path, onClose }) {
  const [stage, setStage] = useState('compose');  // compose | sending | done | error
  const [type, setType] = useState('bug');
  const [comment, setComment] = useState('');
  const [helpRequest, setHelpRequest] = useState('');
  const [helpDisabled, setHelpDisabled] = useState(true);  // stub: AI agent not wired
  const [screenshot, setScreenshot] = useState(null);   // dataURL — raw capture (viewport-cropped)
  const [annotated, setAnnotated] = useState(null);     // dataURL — annotated PNG to upload
  const [marks, setMarks] = useState([]);               // structured marks for the Linear description
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [annotating, setAnnotating] = useState(false);  // full-window overlay open

  // Screenshot capture. We hide the widget for the duration via the data
  // attribute the filter callback excludes inside captureViewportPng. The
  // resulting PNG is cropped to the user's actual viewport at capture time.
  const capture = async () => {
    setError(null);
    setCapturing(true);
    try {
      const dataUrl = await captureViewportPng();
      setScreenshot(dataUrl);
      setAnnotated(dataUrl);
      setMarks([]);
    } catch (e) {
      console.error('[feedback] capture failed', e);
      setError('Could not capture the screen. Try again.');
    } finally {
      setCapturing(false);
    }
  };

  const clearShot = () => {
    setScreenshot(null);
    setAnnotated(null);
    setMarks([]);
  };

  const submit = async () => {
    if (!comment.trim() && !helpRequest.trim()) return;
    setStage('sending');
    setError(null);
    try {
      const fd = new FormData();
      if (annotated) {
        const blob = await (await fetch(annotated)).blob();
        fd.append('file', blob, 'signal.png');
      }
      const payload = {
        type,
        comment: comment.trim(),
        helpRequest: helpRequest.trim() || undefined,
        marks,                       // structured pins/boxes/arrows from the overlay
        context: buildContext(user, path),
      };
      fd.append('payload', JSON.stringify(payload));
      const res = await api.upload('/feedback', fd);
      setResult(res);
      setStage('done');
    } catch (e) {
      setError(e.data?.error || 'Could not send. Try again in a moment.');
      setStage('error');
    }
  };

  const canSend = (comment.trim() || helpRequest.trim()) && stage !== 'sending';

  return (
    <>
      {annotating && screenshot && (
        <AnnotateOverlay
          screenshot={screenshot}
          initialMarks={marks}
          onCancel={() => setAnnotating(false)}
          onDone={(dataUrl, ms) => {
            setAnnotated(dataUrl);
            setMarks(ms);
            setAnnotating(false);
          }}
        />
      )}
      <div
        onClick={annotating ? undefined : onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(42,31,23,0.25)',
          pointerEvents: annotating ? 'none' : 'auto',
        }}
      />
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0,
          width: 420, maxWidth: '95vw',
          background: B.surface, borderLeft: `1px solid ${B.line}`,
          display: 'flex', flexDirection: 'column',
          pointerEvents: 'auto',
          boxShadow: '-12px 0 36px rgba(0,0,0,0.12)',
        }}
        className="fade-in"
      >
        <header style={{
          padding: '18px 22px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', borderBottom: `1px solid ${B.line}`,
        }}>
          <div className="serif" style={{
            fontSize: 18, fontWeight: 600, color: B.text, letterSpacing: '-0.01em',
          }}>Send feedback</div>
          <button onClick={onClose} style={iconBtn} title="Close"><Icon name="x" size={18}/></button>
        </header>

        <div className="scroll-thin" style={{ padding: '18px 22px', overflowY: 'auto', flex: 1 }}>
          {stage === 'done' && (
            <DoneState result={result} onAgain={() => {
              setStage('compose'); setResult(null);
              setComment(''); setHelpRequest('');
              setScreenshot(null); setAnnotated(null);
            }}/>
          )}

          {stage !== 'done' && (
            <>
              {/* Type picker */}
              <Label>Type</Label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {TYPES.map(t => (
                  <button
                    key={t.k}
                    onClick={() => setType(t.k)}
                    style={{
                      flex: 1, padding: '8px 4px',
                      background: type === t.k ? B.accentSoft : B.bg,
                      color: type === t.k ? B.accent : B.text,
                      border: `1px solid ${type === t.k ? B.accent : B.line}`,
                      borderRadius: 4, cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      fontSize: 11, fontWeight: 600,
                    }}>
                    <Icon name={t.icon} size={14}/>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Screenshot capture / annotation */}
              <Label>Screenshot</Label>
              {!screenshot && (
                <button
                  onClick={capture}
                  disabled={capturing}
                  style={{
                    width: '100%', padding: '14px',
                    background: B.bg, border: `1px dashed ${B.line}`, borderRadius: 4,
                    color: B.text, fontSize: 13, fontWeight: 600,
                    cursor: capturing ? 'wait' : 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                  <Icon name="image" size={15} style={{ color: B.accent }}/>
                  {capturing ? 'Capturing…' : 'Capture this screen'}
                </button>
              )}
              {screenshot && FULL_ANNOTATE && (
                <ScreenshotPreview
                  annotated={annotated}
                  marks={marks}
                  onAnnotate={() => setAnnotating(true)}
                  onClear={clearShot}
                />
              )}
              {screenshot && !FULL_ANNOTATE && (
                <AnnotationEditor
                  screenshot={screenshot}
                  onChange={setAnnotated}
                  onClear={clearShot}
                />
              )}

              {/* Comment */}
              <div style={{ marginTop: 16 }}>
                <Label>What's going on?</Label>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  rows={4}
                  placeholder={
                    type === 'bug'      ? 'What broke? What did you expect?' :
                    type === 'idea'     ? 'What would make this better?' :
                    type === 'question' ? 'What are you trying to figure out?' :
                                          'Anything we should know.'
                  }
                  style={textarea}
                />
              </div>

              {/* Get help (stub) */}
              <div style={{ marginTop: 16 }}>
                <Label>
                  Get help{' '}
                  <span style={{ color: B.faint, fontStyle: 'italic', fontWeight: 400, fontSize: 11 }}>
                    · coming soon
                  </span>
                </Label>
                <textarea
                  value={helpRequest}
                  onChange={e => setHelpRequest(e.target.value)}
                  rows={2}
                  placeholder={helpDisabled
                    ? 'Agent Smith is not wired yet. Your question will be filed with the feedback for now.'
                    : 'Ask Agent Smith — get an answer back inline.'}
                  style={textarea}
                />
              </div>

              {error && (
                <div style={{
                  marginTop: 14, color: B.danger, fontSize: 13,
                  background: B.bg, border: `1px solid ${B.danger}`, borderRadius: 4,
                  padding: '10px 14px',
                }}>{error}</div>
              )}
            </>
          )}
        </div>

        {stage !== 'done' && (
          <footer style={{
            padding: '14px 22px', borderTop: `1px solid ${B.line}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: 12,
          }}>
            <span style={{ color: B.faint, fontSize: 11, fontStyle: 'italic' }}>
              Filed as {user.is_pm ? 'team feedback' : 'customer feedback'}.
            </span>
            <button
              onClick={submit}
              disabled={!canSend}
              style={{
                background: canSend ? B.text : B.surface2,
                color: canSend ? B.surface : B.faint,
                border: canSend ? 'none' : `1px solid ${B.line}`,
                padding: '10px 22px', borderRadius: 100,
                fontSize: 13, fontWeight: 600,
                cursor: canSend ? 'pointer' : 'not-allowed',
              }}>
              {stage === 'sending' ? 'Sending…' : 'Send'}
            </button>
          </footer>
        )}
      </aside>
    </>
  );
}

// ── Screenshot preview (full-annotate mode) ──────────────────────────
// Shown after capture when VITE_FEEDBACK_FULL_ANNOTATE !== 'false'.
// Just a thumbnail + Annotate / Clear actions. The real editor lives in
// AnnotateOverlay (full-window).
function ScreenshotPreview({ annotated, marks, onAnnotate, onClear }) {
  const markCount = (marks || []).filter(m => m.kind !== 'arrow').length;
  return (
    <div style={{
      background: B.bg, border: `1px solid ${B.line}`, borderRadius: 4,
      padding: 12,
    }}>
      <div style={{
        overflow: 'hidden', borderRadius: 4, border: `1px solid ${B.line}`,
        background: '#000', marginBottom: 10,
      }}>
        <img
          src={annotated}
          alt="captured viewport"
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8,
      }}>
        <span style={{ color: B.faint, fontSize: 11, fontStyle: 'italic' }}>
          {markCount > 0
            ? `${markCount} comment${markCount === 1 ? '' : 's'} placed`
            : 'No annotations yet'}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onClear} style={miniBtn}>Clear</button>
          <button onClick={onAnnotate} style={{
            ...miniBtn,
            background: B.text, color: B.surface, border: 'none',
          }}>
            <Icon name="edit" size={11}/> Annotate
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Annotation editor ────────────────────────────────────────────────
// Loads the captured screenshot onto a canvas. Tools:
//   - rect:  click-drag draws a rectangle outline
//   - pin:   click drops a numbered pin
// Each mark gets the current label text drawn next to it. Editing the
// label text re-bakes the canvas. "Clear" wipes marks back to the original
// shot. Whatever the canvas currently shows is what gets uploaded.
function AnnotationEditor({ screenshot, onChange, onClear }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [tool, setTool] = useState('rect');
  const [marks, setMarks] = useState([]);
  const [labelText, setLabelText] = useState('');
  const [dragStart, setDragStart] = useState(null);

  // Load the image into a hidden img element. As soon as it's loaded, set
  // canvas size to match and do an initial paint. We use a sane max-width
  // so the canvas fits in the sidebar — visual scaling only, the export
  // re-paints at full resolution to keep the upload crisp.
  useEffect(() => {
    const img = new Image();
    img.onload = () => { imgRef.current = img; repaint(); };
    img.src = screenshot;
  }, [screenshot]);

  // Repaint whenever marks change.
  useEffect(() => { repaint(); }, [marks, labelText]);

  const repaint = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const maxWidth = 360;
    const scale = Math.min(1, maxWidth / img.naturalWidth);
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.style.width = `${img.naturalWidth * scale}px`;
    canvas.style.height = `${img.naturalHeight * scale}px`;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    ctx.lineWidth = Math.max(3, img.naturalWidth / 360);
    ctx.strokeStyle = '#d96a3a';
    ctx.fillStyle = '#d96a3a';
    ctx.font = `${Math.max(16, img.naturalWidth / 50)}px serif`;

    marks.forEach((m, i) => {
      if (m.kind === 'rect') {
        ctx.strokeRect(m.x, m.y, m.w, m.h);
        if (m.label) drawLabel(ctx, m.label, m.x, m.y - 8);
      } else if (m.kind === 'pin') {
        const r = Math.max(14, img.naturalWidth / 80);
        ctx.beginPath();
        ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), m.x, m.y + 1);
        ctx.fillStyle = '#d96a3a';
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
        if (m.label) drawLabel(ctx, m.label, m.x + r + 4, m.y + 4);
      }
    });

    // Push the freshly-painted canvas back up as the upload target.
    onChange(canvas.toDataURL('image/png'));
  };

  const drawLabel = (ctx, text, x, y) => {
    const padding = 6;
    const m = ctx.measureText(text);
    const h = parseInt(ctx.font, 10) + padding * 2;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillRect(x, y - h + padding, m.width + padding * 2, h);
    ctx.fillStyle = '#2a1f17';
    ctx.fillText(text, x + padding, y);
    ctx.restore();
  };

  // Translate a screen-space click into canvas-space coordinates.
  const eventToCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * sx,
      y: (e.clientY - rect.top) * sy,
    };
  };

  const onDown = (e) => {
    const p = eventToCanvasCoords(e);
    if (!p) return;
    if (tool === 'rect') {
      setDragStart(p);
    } else if (tool === 'pin') {
      setMarks(m => [...m, { kind: 'pin', x: p.x, y: p.y, label: labelText }]);
      setLabelText('');
    }
  };

  const onMove = (e) => {
    if (tool !== 'rect' || !dragStart) return;
    const p = eventToCanvasCoords(e);
    if (!p) return;
    setMarks(m => {
      const base = m.filter(x => !x.preview);
      return [...base, {
        kind: 'rect', preview: true,
        x: Math.min(dragStart.x, p.x), y: Math.min(dragStart.y, p.y),
        w: Math.abs(p.x - dragStart.x), h: Math.abs(p.y - dragStart.y),
        label: '',
      }];
    });
  };

  const onUp = (e) => {
    if (tool !== 'rect' || !dragStart) return;
    const p = eventToCanvasCoords(e);
    setDragStart(null);
    if (!p) return;
    if (Math.abs(p.x - dragStart.x) < 4 || Math.abs(p.y - dragStart.y) < 4) {
      // Tiny drag — cancel the preview.
      setMarks(m => m.filter(x => !x.preview));
      return;
    }
    setMarks(m => m.map(x => x.preview ? { ...x, preview: false, label: labelText } : x));
    setLabelText('');
  };

  const undo = () => setMarks(m => m.slice(0, -1));
  const reset = () => { setMarks([]); onClear(); };

  return (
    <div style={{
      background: B.bg, border: `1px solid ${B.line}`, borderRadius: 4,
      padding: 12,
    }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {[
          { k: 'rect', label: 'Box',  icon: 'edit' },
          { k: 'pin',  label: 'Pin',  icon: 'building' },
        ].map(t => (
          <button
            key={t.k}
            onClick={() => setTool(t.k)}
            style={{
              padding: '6px 12px', borderRadius: 100,
              background: tool === t.k ? B.accent : B.surface,
              color: tool === t.k ? '#fff' : B.text,
              border: `1px solid ${tool === t.k ? B.accent : B.line}`,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
            <Icon name={t.icon} size={12}/>
            {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }}/>
        <button onClick={undo} disabled={!marks.length} style={miniBtn}>Undo</button>
        <button onClick={reset} style={miniBtn}>Reset</button>
      </div>

      <input
        value={labelText}
        onChange={e => setLabelText(e.target.value)}
        placeholder="Optional label for the next mark…"
        style={{
          width: '100%', marginBottom: 10,
          background: B.surface, border: `1px solid ${B.line}`,
          borderRadius: 4, padding: '7px 10px', fontSize: 12, color: B.text,
          fontFamily: 'inherit', outline: 'none',
        }}
      />

      <div style={{ overflow: 'hidden', borderRadius: 2, border: `1px solid ${B.line}` }}>
        <canvas
          ref={canvasRef}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
          style={{ display: 'block', cursor: tool === 'rect' ? 'crosshair' : 'pointer' }}
        />
      </div>
    </div>
  );
}

// ── Done state ───────────────────────────────────────────────────────
function DoneState({ result, onAgain }) {
  return (
    <div style={{ textAlign: 'center', padding: '24px 12px' }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
        background: B.accentSoft,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: B.accent,
      }}>
        <Icon name="check" size={28} stroke={2.4}/>
      </div>
      <div className="serif" style={{
        fontSize: 20, fontWeight: 600, color: B.text, letterSpacing: '-0.01em',
      }}>Filed.</div>
      <p style={{ margin: '6px 0 18px', color: B.dim, fontSize: 13.5 }}>
        Thank you — we'll take a look.
      </p>
      {result?.identifier && (
        <p style={{ color: B.faint, fontSize: 12, fontStyle: 'italic' }}>
          Tracked as {result.identifier}.
        </p>
      )}
      <button onClick={onAgain} style={{
        marginTop: 14, background: 'transparent', border: `1px solid ${B.line}`,
        color: B.text, padding: '8px 18px', borderRadius: 100,
        fontSize: 13, fontWeight: 600, cursor: 'pointer',
      }}>Send another</button>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────
function buildContext(user, path) {
  const name = `${user?.first_name || ''} ${user?.last_name || ''}`.trim();
  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
  return {
    userId: String(user?.id || ''),
    userName: name,
    role: user?.role || '',
    url: window.location.href,
    route: path,
    appVersion,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
  };
}

// ── styles ───────────────────────────────────────────────────────────
function Label({ children }) {
  return (
    <div style={{
      color: B.text, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
      textTransform: 'uppercase', marginBottom: 8,
    }}>{children}</div>
  );
}

const iconBtn = {
  background: 'transparent', border: 'none', color: B.dim, cursor: 'pointer', padding: 4,
};
const textarea = {
  width: '100%', background: B.bg, border: `1px solid ${B.line}`,
  borderRadius: 4, padding: '10px 12px', fontSize: 13.5, lineHeight: 1.5,
  color: B.text, fontFamily: 'inherit', resize: 'vertical', outline: 'none',
};
const miniBtn = {
  background: 'transparent', border: `1px solid ${B.line}`, color: B.dim,
  padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600,
  cursor: 'pointer',
};
