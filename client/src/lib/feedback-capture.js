// Smith — Feedback capture helper
//
// Snapshots the current viewport (not the whole document) and returns a
// PNG data URL sized to window.innerWidth × innerHeight at devicePixelRatio.
// html-to-image draws document.body at body size; we crop that to the
// scrolled viewport so the screenshot reflects what the user was actually
// looking at when they hit "Capture this screen."
//
// The widget filter callback excludes the FeedbackWidget itself from the
// snapshot via the data-feedback-widget="true" attribute so the floating
// button + open sidebar don't show up in the captured frame.

import { toPng } from 'html-to-image';

export async function captureViewportPng() {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  const fullPng = await toPng(document.body, {
    cacheBust: true,
    pixelRatio,
    filter: (node) => {
      if (node?.getAttribute && node.getAttribute('data-feedback-widget') === 'true') return false;
      return true;
    },
  });

  // Decode the full-body PNG and crop to the viewport rectangle.
  const img = await loadImage(fullPng);

  const sx = Math.round(window.scrollX * pixelRatio);
  const sy = Math.round(window.scrollY * pixelRatio);
  const sw = Math.round(window.innerWidth * pixelRatio);
  const sh = Math.round(window.innerHeight * pixelRatio);

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL('image/png');
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
