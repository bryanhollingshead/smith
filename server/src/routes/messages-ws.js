// Smith — Messaging websocket server
//
// We attach a WebSocketServer to the same HTTP server that serves the REST
// API, listening on path /api/ws. Clients connect with their JWT in the
// query string (?token=...) since custom headers on browser WebSocket() are
// not supported.
//
// Once authenticated, we keep a per-user set of open sockets. The REST send
// handler calls broadcastToUser(userId, payload) to push 'message:new' events.
//
// Heartbeats: every 30s we ping each socket; if it doesn't pong by the next
// interval, we close it. This catches dead connections (laptop closed, wifi
// drop) that don't surface as TCP errors.
//
// Shutdown: on SIGINT/SIGTERM we clear the heartbeat timer + force-close every
// open socket so the Node process exits promptly instead of waiting for the
// last client to disconnect on its own.

import { WebSocketServer } from 'ws';
import { verifyToken } from '../auth-utils.js';

// userId → Set<ws>. A user can have multiple tabs/devices open.
const sockets = new Map();

// Module-level handles so the shutdown hook can clean them up.
let _wss = null;
let _heartbeat = null;

export function attachMessagingWS(httpServer) {
  const wss = new WebSocketServer({ noServer: true });
  _wss = wss;

  // Handle upgrade requests on /api/ws. We do auth here, BEFORE accepting
  // the websocket, so unauthenticated connections never complete the handshake.
  httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname !== '/api/ws') return; // Not for us; let other upgrade handlers (if any) take it.

    const token = url.searchParams.get('token');
    let userId = null;
    try {
      const payload = verifyToken(token);
      userId = payload.sub;
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.userId = userId;
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });

      if (!sockets.has(userId)) sockets.set(userId, new Set());
      sockets.get(userId).add(ws);

      ws.on('close', () => {
        const set = sockets.get(userId);
        if (set) {
          set.delete(ws);
          if (set.size === 0) sockets.delete(userId);
        }
      });

      // We don't expect inbound messages over the socket for v1 — all sends
      // go through HTTP — but we log incoming for debugging if any arrive.
      ws.on('message', (data) => {
        // No-op for now. Future: typing indicators would be inbound events.
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.type === 'ping') {
            // Application-level ping (in addition to the protocol-level ping).
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        } catch { /* ignore malformed */ }
      });

      // Greet the client so they know auth succeeded.
      ws.send(JSON.stringify({ type: 'hello', user_id: userId }));
    });
  });

  // Heartbeat loop. Closes sockets that don't pong back.
  // `unref()` lets Node exit if this timer is the only thing keeping the
  // event loop alive — critical for clean shutdown.
  _heartbeat = setInterval(() => {
    for (const set of sockets.values()) {
      for (const ws of set) {
        if (!ws.isAlive) { ws.terminate(); continue; }
        ws.isAlive = false;
        ws.ping();
      }
    }
  }, 30000);
  _heartbeat.unref();

  wss.on('close', () => {
    if (_heartbeat) { clearInterval(_heartbeat); _heartbeat = null; }
  });

  return wss;
}

// Called by the REST send handler. Best-effort: silently no-ops if the user
// has no open sockets (they'll see the message on next page load).
export function broadcastToUser(userId, payload) {
  const set = sockets.get(userId);
  if (!set) return;
  const str = JSON.stringify(payload);
  for (const ws of set) {
    if (ws.readyState === 1 /* OPEN */) ws.send(str);
  }
}

// Cleanly tear down all sockets + the heartbeat timer. Called from index.js
// on SIGINT/SIGTERM so the process can exit promptly.
export function closeMessagingWS() {
  if (_heartbeat) { clearInterval(_heartbeat); _heartbeat = null; }
  for (const set of sockets.values()) {
    for (const ws of set) {
      try { ws.terminate(); } catch { /* best effort */ }
    }
  }
  sockets.clear();
  if (_wss) { try { _wss.close(); } catch { /* best effort */ } _wss = null; }
}