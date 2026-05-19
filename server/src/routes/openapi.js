// Smith — OpenAPI spec + interactive docs
//
// Serves three things:
//   GET /api/openapi.yaml   — the spec, as YAML (the source-of-truth artifact)
//   GET /api/openapi.json   — the spec, as JSON (convenient for tooling)
//   GET /api/docs           — Swagger UI page that consumes the spec
//
// Why this lives in the API rather than as static files: the spec is a
// first-class deliverable. Mobile devs, integration partners, and Claude in
// future sessions can fetch it without needing the repo. Putting it behind
// `/api/openapi.yaml` makes the URL guessable and stable.
//
// The Swagger UI is loaded from the unpkg CDN — keeps Smith's bundle small
// and means we don't ship the UI assets. If unpkg is ever down, the spec
// is still browsable directly via the YAML or JSON endpoints.

import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// docs/ lives at the repo root, two levels up from this file.
const SPEC_PATH = path.resolve(__dirname, '..', '..', '..', 'docs', 'api.yaml');

const router = Router();

// Cache the YAML in memory on first read. The spec is rarely changed during
// a server process's lifetime, so this avoids repeated disk reads.
let _yamlCache = null;
function readSpecYaml() {
  if (!_yamlCache) _yamlCache = fs.readFileSync(SPEC_PATH, 'utf8');
  return _yamlCache;
}

// Lazy JSON conversion — only when /api/openapi.json is hit. We use the
// js-yaml library if available, else fall back to a basic message. We don't
// require js-yaml as a hard dep just for this endpoint; the YAML version is
// the canonical one.
let _jsonCache = null;
async function readSpecJson() {
  if (_jsonCache) return _jsonCache;
  try {
    const yaml = await import('js-yaml');
    _jsonCache = yaml.load(readSpecYaml());
    return _jsonCache;
  } catch {
    return null; // js-yaml not installed — caller will get a 501.
  }
}

router.get('/openapi.yaml', (_req, res) => {
  try {
    res.setHeader('Content-Type', 'application/yaml; charset=utf-8');
    res.send(readSpecYaml());
  } catch (e) {
    res.status(500).json({ error: 'Could not read spec', detail: e.message });
  }
});

router.get('/openapi.json', async (_req, res) => {
  const json = await readSpecJson();
  if (!json) {
    return res.status(501).json({
      error: 'JSON conversion requires js-yaml. Use /api/openapi.yaml instead.',
    });
  }
  res.json(json);
});

// Minimal Swagger UI page. We pull the assets from unpkg so we don't have to
// bundle them. The spec URL is relative so this works in dev and prod.
router.get('/docs', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Smith API · Docs</title>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; font-family: -apple-system, system-ui, sans-serif; background: #fafaf7; }
    .topbar { display: none; } /* Swagger's branded bar; we serve our own. */
    .smith-bar {
      background: #1d1611; color: #f5efe1; padding: 14px 24px;
      display: flex; align-items: baseline; gap: 14px;
      border-bottom: 1px solid #2a2218;
    }
    .smith-bar h1 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }
    .smith-bar .sub { color: #b3a78a; font-size: 12px; font-style: italic; }
    .smith-bar a { color: #d2a574; text-decoration: none; font-size: 12px; margin-left: auto; }
    #swagger-ui { max-width: 1200px; margin: 0 auto; }
  </style>
</head>
<body>
  <div class="smith-bar">
    <h1>Smith API</h1>
    <span class="sub">additive-only · see docs/API_COMMANDMENT.md</span>
    <a href="/api/openapi.yaml">openapi.yaml</a>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/openapi.yaml',
        dom_id: '#swagger-ui',
        deepLinking: true,
        docExpansion: 'none',
        defaultModelsExpandDepth: -1,
        tryItOutEnabled: true,
        persistAuthorization: true,
      });
    };
  </script>
</body>
</html>`);
});

export default router;
