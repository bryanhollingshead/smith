// Smith — API server entry
import 'dotenv/config';
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

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
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

// 404
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
  console.log(`    Health: http://localhost:${PORT}/api/health\n`);
});

// Messaging websocket — same HTTP server, /api/ws path.
attachMessagingWS(server);

// Graceful shutdown so docker-compose / CI doesn't hang.
const shutdown = () => {
  console.log('\n[server] shutting down');
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;
