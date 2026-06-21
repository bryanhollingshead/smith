// Smith — Annotate Overlay (full-window)
//
// Opens over the whole viewport. Renders the captured screenshot on a
// canvas, scaled to fit the available area. Toolbar offers Pin (numbered),
// Box (lettered), and Arrow (markup-only). When the user places a Pin or
// Box, a comment popover opens anchored to the mark in screen coordinates
// — the "inline edit, precisely placed" UX. Click any existing mark again
// to re-edit. Done bakes the marks into a fresh PNG, hands both the PNG
// and the structured marks back to the parent.
//
// Marks shape:
//   { id, kind: 'pin'|'box'|'arrow', x, y, w?, h?, x2?, y2?, comment? }
// Numbering/lettering is derived from order-in-array at render time so
// undo never leaves a numbering hole.

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from './Icon.jsx';

const ARROW_HEAD = 16;       // canvas-space arrowhead leg length
const PIN_RADIUS = 18;
const STROKE_WIDTH = 4;
const ORANGE = '#d96a3a';
const ORANGE_DIM = 'rgba(217,106,58,0.18)';

export function AnnotateOverlay({ screenshot, initialMarks = [], onCancel, onDone }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const imgRef = useRef(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [scale, setScale] = useState(1);     // CSS pixels per canvas pixel
  const [marks, setMarks] = useState(initialMarks);
  const [tool, setTool] = useState('pin');
  const [drag, setDrag] = useState(null);    // { kind, startX, startY, x, y, w, h, x2, y2 }
  const [selectedId, setSelectedId] = useState(null);

  // Load + paint the screenshot. The canvas's native size matches the
  // captured image pixel size; CSS size scales it to fit.
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = screenshot;
  }, [screenshot]);

  // Recompute CSS scale on resize.
  useEffect(() => {
    if (!imgSize.w) return;
    const fit = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const padding = 32;
      const availW = wrap.clientWidth - padding * 2;
      const availH = wrap.clientHeight - padding * 2;
      const s = Math.min(availW / imgSize.w, availH / imgSize.h, 1);
      setScale(s);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [imgSize]);

  // Repaint when marks, drag, or selection change.
  useEffect(() => {
    paint(canvasRef.current, imgRef.current, marks, drag);
  }, [marks, drag, imgSize]);

  const pinIndex = useMemo(() => {
    const m = new Map();
    let n = 1;
    for (const k of marks) if (k.kind === 'pin') m.set(k.id, n++);
    return m;
  }, [marks]);

  const boxIndex = useMemo(() => {
    const m = new Map();
    let n = 0;
    for (const k of marks) if (k.kind === 'box') m.set(k.id, n++);
    return m;
  }, [marks]);

  const eventToCanvas = (e) => {
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

  // Hit-test marks (last drawn first so the topmost wins).
  const hitMark = (px, py) => {
    for (let i = marks.length - 1; i >= 0; i--) {
      const m = marks[i];
      if (m.kind === 'pin') {
        const dx = px - m.x;
        const dy = py - m.y;
        if (dx * dx + dy * dy <= PIN_RADIUS * PIN_RADIUS) return m;
      } else if (m.kind === 'box') {
        if (px >= m.x && px <= m.x + m.w && py >= m.y && py <= m.y + m.h) return m;
      }
    }
    return null;
  };

  const onMouseDown = (e) => {
    e.preventDefault();
    const p = eventToCanvas(e);
    if (!p) return;

    // Existing-mark selection wins over draw on tap/click.
    const hit = hitMark(p.x, p.y);
    if (hit && (tool === 'pin' || tool === 'box')) {
      setSelectedId(hit.id);
      return;
    }

    if (tool === 'pin') {
      const id = newId();
      setMarks(arr => [...arr, { id, kind: 'pin', x: p.x, y: p.y, comment: '' }]);
      setSelectedId(id);
      return;
    }
    if (tool === 'box') {
      setDrag({ kind: 'box', startX: p.x, startY: p.y, x: p.x, y: p.y, w: 0, h: 0 });
      setSelectedId(null);
      return;
    }
    if (tool === 'arrow') {
      setDrag({ kind: 'arrow', startX: p.x, startY: p.y, x2: p.x, y2: p.y });
      setSelectedId(null);
      return;
    }
  };

  const onMouseMove = (e) => {
    if (!drag) return;
    const p = eventToCanvas(e);
    if (!p) return;
    if (drag.kind === 'box') {
      setDrag(d => ({
        ...d,
        x: Math.min(d.startX, p.x),
        y: Math.min(d.startY, p.y),
        w: Math.abs(p.x - d.startX),
        h: Math.abs(p.y - d.startY),
      }));
    } else if (drag.kind === 'arrow') {
      setDrag(d => ({ ...d, x2: p.x, y2: p.y }));
    }
  };

  const onMouseUp = (e) => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (d.kind === 'box') {
      if (d.w < 8 || d.h < 8) return;  // ignore tiny accidental drags
      const id = newId();
      setMarks(arr => [...arr, { id, kind: 'box', x: d.x, y: d.y, w: d.w, h: d.h, comment: '' }]);
      setSelectedId(id);
    } else if (d.kind === 'arrow') {
      const dx = d.x2 - d.startX;
      const dy = d.y2 - d.startY;
      if (dx * dx + dy * dy < 8 * 8) return;
      const id = newId();
      setMarks(arr => [...arr, { id, kind: 'arrow', x: d.startX, y: d.startY, x2: d.x2, y2: d.y2 }]);
    }
  };

  const updateComment = (id, text) => {
    setMarks(arr => arr.map(m => m.id === id ? { ...m, comment: text } : m));
  };

  const deleteMark = (id) => {
    setMarks(arr => arr.filter(m => m.id !== id));
    setSelectedId(null);
  };

  const undo = () => setMarks(arr => arr.slice(0, -1));
  const reset = () => { setMarks([]); setSelectedId(null); };

  const finish = () => {
    // Export the current canvas (it's painted with the marks). Strip the
    // transient drag preview before export.
    paint(canvasRef.current, imgRef.current, marks, null);
    const dataUrl = canvasRef.current.toDataURL('image/png');
    // Strip ids from the payload — they're only useful inside the editor.
    const clean = marks.map(({ id, ...rest }) => rest);
    onDone(dataUrl, clean);
  };

  // Active popover position in CSS pixels relative to the canvas wrapper.
  const selected = marks.find(m => m.id === selectedId) || null;
  const popoverStyle = useMemo(() => {
    if (!selected || !canvasRef.current) return null;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width / canvas.width;
    const sy = rect.height / canvas.height;
    let anchorX, anchorY;
    if (selected.kind === 'pin') {
      anchorX = (selected.x + PIN_RADIUS) * sx;
      anchorY = selected.y * sy;
    } else if (selected.kind === 'box') {
      anchorX = (selected.x + selected.w) * sx;
      anchorY = selected.y * sy;
    } else {
      return null;
    }
    return {
      position: 'absolute',
      // rect-relative coords inside the wrap, with rect offset from wrap.
      left: rect.left - (wrapRef.current?.getBoundingClientRect().left || 0) + anchorX + 12,
      top:  rect.top  - (wrapRef.current?.getBoundingClientRect().top  || 0) + anchorY,
      zIndex: 5,
    };
  }, [selected, scale]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(20,12,8,0.92)',
      display: 'flex', flexDirection: 'column',
    }} data-feedback-widget="true">
      <Toolbar
        tool={tool} setTool={setTool}
        undo={undo} reset={reset}
        canUndo={marks.length > 0}
        onCancel={onCancel}
        onDone={finish}
      />

      <div ref={wrapRef} style={{
        flex: 1, position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {imgSize.w > 0 && (
          <canvas
            ref={canvasRef}
            width={imgSize.w}
            height={imgSize.h}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            style={{
              width: imgSize.w * scale, height: imgSize.h * scale,
              cursor: tool === 'pin' ? 'crosshair' : 'crosshair',
              borderRadius: 6,
              boxShadow: '0 18px 60px rgba(0,0,0,0.5)',
              background: '#000',
            }}
          />
        )}
        {selected && popoverStyle && (
          <CommentPopover
            style={popoverStyle}
            mark={selected}
            number={pinIndex.get(selected.id)}
            letter={boxIndex.has(selected.id) ? letterAt(boxIndex.get(selected.id)) : null}
            onChange={(text) => updateComment(selected.id, text)}
            onDelete={() => deleteMark(selected.id)}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────
function Toolbar({ tool, setTool, undo, reset, canUndo, onCancel, onDone }) {
  return (
    <div style={{
      padding: '12px 18px',
      display: 'flex', alignItems: 'center', gap: 10,
      borderBottom: `1px solid rgba(255,255,255,0.08)`,
      background: 'rgba(0,0,0,0.4)',
    }}>
      <div className="serif" style={{
        color: '#fff', fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em',
        marginRight: 12,
      }}>Annotate</div>
      {[
        { k: 'pin',   icon: 'building', label: 'Pin' },
        { k: 'box',   icon: 'edit',     label: 'Box' },
        { k: 'arrow', icon: 'send',     label: 'Arrow' },
      ].map(t => (
        <button
          key={t.k}
          onClick={() => setTool(t.k)}
          style={{
            background: tool === t.k ? ORANGE : 'transparent',
            border: `1px solid ${tool === t.k ? ORANGE : 'rgba(255,255,255,0.18)'}`,
            color: tool === t.k ? '#fff' : 'rgba(255,255,255,0.85)',
            padding: '7px 12px', borderRadius: 100,
            fontSize: 12, fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          <Icon name={t.icon} size={13}/> {t.label}
        </button>
      ))}
      <div style={{ flex: 1 }}/>
      <button onClick={undo} disabled={!canUndo} style={ghostDark}>Undo</button>
      <button onClick={reset} style={ghostDark}>Reset</button>
      <button onClick={onCancel} style={ghostDark}>Cancel</button>
      <button onClick={onDone} style={{
        background: '#fff', color: B.text, border: 'none',
        padding: '8px 18px', borderRadius: 100, fontSize: 13, fontWeight: 700,
        cursor: 'pointer',
      }}>Done</button>
    </div>
  );
}

// ── Comment popover ───────────────────────────────────────────────────
function CommentPopover({ style, mark, number, letter, onChange, onDelete, onClose }) {
  const [text, setText] = useState(mark.comment || '');
  const textareaRef = useRef(null);
  useEffect(() => { textareaRef.current?.focus(); }, [mark.id]);

  const commit = () => {
    onChange(text);
    onClose();
  };

  const label = mark.kind === 'pin' ? `#${number}` : mark.kind === 'box' ? letter : '';

  return (
    <div style={{
      ...style,
      width: 280, background: B.surface, border: `1px solid ${B.line}`,
      borderRadius: 6, padding: 12,
      boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
    }} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
          color: B.accent,
        }}>{mark.kind} {label}</span>
        <button onClick={onDelete} title="Delete" style={{
          background: 'transparent', border: 'none', color: B.faint, cursor: 'pointer',
          padding: 0,
        }}><Icon name="x" size={14}/></button>
      </div>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="What's going on here?"
        rows={3}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            commit();
          }
        }}
        style={{
          width: '100%', background: B.bg, border: `1px solid ${B.line}`,
          borderRadius: 4, padding: '8px 10px', fontSize: 13, lineHeight: 1.5,
          color: B.text, fontFamily: 'inherit', resize: 'vertical', outline: 'none',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, gap: 6 }}>
        <button onClick={onClose} style={ghostBtn}>Close</button>
        <button onClick={commit} style={{
          background: B.text, color: B.surface, border: 'none',
          padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600,
          cursor: 'pointer',
        }}>Save</button>
      </div>
    </div>
  );
}

// ── Canvas painting ────────────────────────────────────────────────────
function paint(canvas, img, marks, drag) {
  if (!canvas || !img) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  ctx.lineWidth = STROKE_WIDTH;
  ctx.strokeStyle = ORANGE;
  ctx.fillStyle = ORANGE;
  ctx.font = `${Math.max(20, canvas.width / 60)}px serif`;

  let pinN = 1;
  let boxN = 0;

  for (const m of marks) {
    if (m.kind === 'pin') {
      drawPin(ctx, m.x, m.y, pinN);
      pinN += 1;
    } else if (m.kind === 'box') {
      drawBox(ctx, m.x, m.y, m.w, m.h, letterAt(boxN));
      boxN += 1;
    } else if (m.kind === 'arrow') {
      drawArrow(ctx, m.x, m.y, m.x2, m.y2);
    }
  }

  // Drag preview.
  if (drag) {
    ctx.save();
    ctx.setLineDash([10, 6]);
    if (drag.kind === 'box') {
      drawBox(ctx, drag.x, drag.y, drag.w, drag.h, '');
    } else if (drag.kind === 'arrow') {
      drawArrow(ctx, drag.startX, drag.startY, drag.x2, drag.y2);
    }
    ctx.restore();
  }
}

function drawPin(ctx, x, y, n) {
  ctx.save();
  ctx.fillStyle = ORANGE;
  ctx.beginPath();
  ctx.arc(x, y, PIN_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.max(18, PIN_RADIUS * 1.1)}px serif`;
  ctx.fillText(String(n), x, y + 1);
  ctx.restore();
}

function drawBox(ctx, x, y, w, h, letter) {
  ctx.save();
  ctx.lineWidth = STROKE_WIDTH;
  ctx.strokeStyle = ORANGE;
  ctx.fillStyle = ORANGE_DIM;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  if (letter) {
    ctx.fillStyle = '#fff';
    ctx.font = `bold 18px serif`;
    const pad = 4;
    const tw = ctx.measureText(letter).width + pad * 2;
    const th = 24;
    ctx.fillStyle = ORANGE;
    ctx.fillRect(x, y, tw, th);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, x + tw / 2, y + th / 2 + 1);
  }
  ctx.restore();
}

function drawArrow(ctx, x1, y1, x2, y2) {
  ctx.save();
  ctx.strokeStyle = ORANGE;
  ctx.fillStyle = ORANGE;
  ctx.lineWidth = STROKE_WIDTH;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = ARROW_HEAD;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function letterAt(n) {
  // A, B, C, ..., Z, AA, AB, ...
  let s = '';
  n = n + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

let _id = 0;
function newId() {
  return `m${Date.now()}-${++_id}`;
}

const ghostDark = {
  background: 'transparent', border: `1px solid rgba(255,255,255,0.2)`,
  color: 'rgba(255,255,255,0.85)', padding: '7px 14px', borderRadius: 100,
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
};
const ghostBtn = {
  background: 'transparent', border: 'none', color: B.dim,
  padding: '6px 10px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
};
