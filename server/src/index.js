// Smith — API server entry
//
// In dev (NODE_ENV !== 'production') this serves ONLY the API. Vite runs the
// frontend on port 5173 and proxies /api → here on 4000.
//
// In production (NODE_ENV === 'production'), this serves the API AND the
// built React app from ../../client/dist. Two domains-of-concern collapse
// into one — same origin for the React bundle and the API it calls. This
// is why we keep the API rooted under /api: anything that doesn't match
// /api/* falls through to serving the SPA, which lets the React router
// handle client-side routes like /profile/1, /messages, etc.

import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';

import authRouter from './routes/auth.js';
import profilesRouter from './routes/profiles.js';
import companiesRouter from './routes/companies.js';
import connectionsRouter from './routes/connections.js';
import postsRouter from './routes/posts.js';
import miscRouter from './routes/misc.js';
import newsRouter from './routes/news.js';
import credentialDocsRouter from './routes/credential-docs.js';
import messagesRouter from './routes/messages.js';
import { attachMessagingWS } from './routes/messages-ws.js';
import openapiRouter from './routes/openapi.js';
import photosRouter from './routes/photos.js';
import filesRouter from './routes/files.js';
import { readClientVersion } from './middleware-version.js';
import { ingestAll } from './ingest-news.js';
import { ingestAllJobs } from './ingest-jobs.js';
import jobsRouter from './routes/jobs.js';
import applicationsRouter from './routes/applications.js';
import publicRouter from './routes/public.js';
import hireMeRouter from './routes/hire-me.js';
import homesRouter from './routes/homes.js';
import projectsRouter from './routes/projects.js';
import adminUsersRouter from './routes/admin-users.js';
import seoRouter from './routes/seo.js';
import feedbackRouter from './routes/feedback.js';
import { createSpaMeta } from './spa-meta.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const IS_PROD = process.env.NODE_ENV === 'production';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(readClientVersion);
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: false,
}));

// Tiny request logger so dev sessions show what's hitting the API.
app.use((req, _res, next) => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`${new Date().toISOString()}  ${req.method} ${req.url}`);
  }
  next();
});

app.get('/api/health', (_req, res) => res.json({ ok: true, t: Date.now() }));

app.use('/api/auth', authRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api', companiesRouter);     // mounts /companies, /work-history, /jobsites at top level
app.use('/api/connections', connectionsRouter);
app.use('/api/posts', postsRouter);
app.use('/api', miscRouter);          // /search, /notifications, /trades
app.use('/api', newsRouter);          // /news, /news/categories, /admin/news/...
app.use('/api', credentialDocsRouter); // /credential-docs upload + serve
app.use('/api/messages', messagesRouter); // /threads, /threads/:id/messages, /unread-count
app.use('/api', openapiRouter);       // /openapi.yaml, /openapi.json, /docs
app.use('/api/photos', photosRouter); // /avatar, /cover  (POST + DELETE)
app.use('/api', filesRouter);         // /files/*  (serves storage objects)
app.use('/api', jobsRouter);          // /admin/jobs/*  (phase 2); /jobs/* feed lands in phase 3
app.use('/api', applicationsRouter);  // /jobs/:id/draft, /applications/*  (phase 4)
app.use('/api/public', publicRouter); // public profile + search + hire-me submit + magic-link reply (phase 5)
app.use('/api', hireMeRouter);        // /hire-me/inbox, /hire-me/:id  (phase 5, authed)
app.use('/api', homesRouter);         // /places/autocomplete (public), /homes/* (authed)  (phase 6, homeowner entry)
app.use('/api', projectsRouter);      // /projects/* (authed, homeowner spec flow)
app.use('/api', adminUsersRouter);    // /admin/demo-users, /admin/users/:id/{impersonate,password}  (admin-only)
app.use('/api/feedback', feedbackRouter); // Signal payloads → Linear (feedback widget)

// SEO + AI-discoverability surface — mounted at root (not /api). These are
// reachable by humans, crawlers, and LLM agents. Order matters: they must
// register BEFORE the SPA fallback below so /robots.txt etc. don't fall
// through to index.html. The .md digests and meta-injection handlers are
// likewise registered before the catch-all.
app.use('/', seoRouter);

// ── Static SPA serving (production only) ────────────────────────────────
// The React build lands at ../../client/dist relative to this file. We:
//   1. Serve every file in dist verbatim (JS, CSS, fonts, etc.)
//   2. For any non-/api path that doesn't match a file, return index.html
//      so the React router can handle the route client-side.
//
// In dev this whole block is skipped — Vite serves the frontend on 5173
// and proxies /api here.
const clientDist = path.resolve(__dirname, '..', '..', 'client', 'dist');
const haveBuild  = fs.existsSync(path.join(clientDist, 'index.html'));

if (IS_PROD && haveBuild) {
  // Static assets — long cache for the hashed files Vite emits.
  app.use(express.static(clientDist, {
    index: false, // we handle index.html via the SPA fallback below
    maxAge: '7d',
    setHeaders: (res, filepath) => {
      // index.html shouldn't be cached (the references inside it change
      // every build). Hashed JS/CSS can cache for a long time.
      if (filepath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));

  // Per-route meta + JSON-LD injection for the public SEO surfaces.
  // Registered BEFORE the bare SPA fallback so /company/:slug and
  // /profile/:slug get hydrated head sections that AI crawlers can read.
  app.use('/', createSpaMeta(clientDist));

  // SPA fallback: everything that isn't an API route → serve index.html.
  // We do this AFTER the API routes are registered so /api/* still 404s
  // through the JSON handler below if a route doesn't exist.
  app.get(/^(?!\/api(\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else if (IS_PROD && !haveBuild) {
  console.warn(
    `[server] NODE_ENV=production but no client build found at ${clientDist}. ` +
    `Did the build step run? The API will work, but the frontend won't be served.`
  );
}

// 404 — only matched by /api/* misses (the SPA fallback above catches
// non-API misses in production).
app.use((req, res) => res.status(404).json({ error: 'Not found', path: req.url }));

// Error handler — JSON, never HTML.
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(err.status || 500).json({
    error: err.publicMessage || (process.env.NODE_ENV === 'production' ? 'Server error' : err.message),
  });
});

const PORT = parseInt(process.env.PORT || '4000', 10);
const server = app.listen(PORT, () => {
  console.log(`\n🛠  Smith API listening on http://localhost:${PORT}`);
  console.log(`    Health: http://localhost:${PORT}/api/health`);
  if (IS_PROD && haveBuild) {
    console.log(`    Serving SPA from ${clientDist}`);
  }
  console.log();
});

// Messaging websocket — same HTTP server, /api/ws path.
attachMessagingWS(server);

// ── News ingestion scheduler ────────────────────────────────────────────
// In production, kick off ingestion 30 seconds after startup (so the server
// is settled before pulling external feeds) and then every hour after that.
// Failures are swallowed and logged — ingestion errors should never crash
// the server. Skipped entirely in dev/test (we run `npm run ingest`
// manually there).
//
// One hour is the right cadence for a launch-stage app: RSS feeds typically
// update no more than a few times per day, so polling more often wastes
// bandwidth without surfacing fresher news. We can tighten this later when
// the user base wants real-time-ish news.
if (IS_PROD) {
  const HOUR_MS = 60 * 60 * 1000;
  const runIngest = async () => {
    const startedAt = new Date();
    try {
      const summary = await ingestAll();
      const totals = summary.reduce(
        (acc, r) => ({
          inserted: acc.inserted + (r.inserted || 0),
          errors:   acc.errors + (r.error ? 1 : 0),
        }),
        { inserted: 0, errors: 0 }
      );
      const duration = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(
        `[ingest] cycle done — ${summary.length} feeds, ` +
        `${totals.inserted} new articles, ${totals.errors} errors, ${duration}s`
      );
    } catch (e) {
      console.error('[ingest] cycle threw:', e.message || e);
    }
  };
  // 30s delay on startup so the server has time to settle and pass the
  // initial health check before we start chewing on external HTTP calls.
  setTimeout(runIngest, 30_000);
  setInterval(runIngest, HOUR_MS);
  console.log(`[ingest] scheduler armed — first run in 30s, then every ${HOUR_MS / 60_000}m`);

  // ── Jobs ingestion scheduler (mirrors the news one) ─────────────────────
  // Sources without credentials (ADZUNA_APP_ID/ADZUNA_APP_KEY) error fast and
  // record the reason to job_sources.last_status — the loop keeps running so
  // adding creds later "just works" without a redeploy. The seed Adzuna
  // source ships with enabled=FALSE; flip it on after wiring credentials.
  const runJobsIngest = async () => {
    const startedAt = new Date();
    try {
      const summary = await ingestAllJobs();
      const totals = summary.reduce(
        (acc, r) => ({
          inserted: acc.inserted + (r.inserted || 0),
          updated:  acc.updated  + (r.updated  || 0),
          errors:   acc.errors   + (r.error ? 1 : 0),
        }),
        { inserted: 0, updated: 0, errors: 0 }
      );
      const duration = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(
        `[ingest-jobs] cycle done — ${summary.length} sources, ` +
        `${totals.inserted} new, ${totals.updated} updated, ${totals.errors} errors, ${duration}s`
      );
    } catch (e) {
      console.error('[ingest-jobs] cycle threw:', e.message || e);
    }
  };
  // Offset by 60s vs the news ingest so we don't slam external APIs in the
  // same window on every cycle.
  setTimeout(runJobsIngest, 90_000);
  setInterval(runJobsIngest, HOUR_MS);
  console.log(`[ingest-jobs] scheduler armed — first run in 90s, then every ${HOUR_MS / 60_000}m`);
}

// Graceful shutdown so docker-compose / CI doesn't hang.
const shutdown = () => {
  console.log('\n[server] shutting down');
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;
