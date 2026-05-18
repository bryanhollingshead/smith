// Smith — Messages context
//
// Owns:
//   1. The single websocket connection used by the whole app for live updates.
//   2. The global unread count (drives the nav badge).
//   3. A pub/sub for incoming message events, so the Messages page can react
//      to live deliveries without each page needing its own socket.
//
// Why a context (not a hook used per-page): we want exactly ONE socket per
// tab. A per-page hook would open/close on every nav. The provider is mounted
// once in App.jsx, inside the auth-gated tree.

import React, {
  createContext, useContext, useEffect, useRef, useState, useCallback,
} from 'react';
import { api, auth } from './api.js';
import { useAuth } from './AuthContext.jsx';

const MessagesCtx = createContext({
  unread: 0,
  subscribe: () => () => {},
  refreshUnread: async () => {},
});

export function MessagesProvider({ children }) {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const subscribersRef = useRef(new Set());
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  const refreshUnread = useCallback(async () => {
    try {
      const data = await api.get('/messages/unread-count');
      setUnread(data.unread);
    } catch { /* silent — nav badge isn't critical */ }
  }, []);

  // Subscribe to live events. Returns an unsubscribe.
  const subscribe = useCallback((fn) => {
    subscribersRef.current.add(fn);
    return () => subscribersRef.current.delete(fn);
  }, []);

  // Open / re-open the socket. Called on mount and after auth-recoverable drops.
  const connect = useCallback(() => {
    const token = auth.get();
    if (!token) return;

    // Pick ws:// vs wss:// based on current page protocol. Same host/port as
    // the API — Vite proxies WS upgrades just like HTTP.
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/api/ws?token=${encodeURIComponent(token)}`;

    let ws;
    try { ws = new WebSocket(url); }
    catch { scheduleReconnect(); return; }

    ws.onopen = () => {
      // Refresh unread count on (re)connect — we may have missed events while
      // the socket was down.
      refreshUnread();
    };

    ws.onmessage = (evt) => {
      let data;
      try { data = JSON.parse(evt.data); } catch { return; }
      if (data.type === 'message:new') {
        // Bump global unread (the message is FROM someone else; if it were our
        // own send, the server doesn't broadcast back to us).
        setUnread(n => n + 1);
      }
      // Fan out to any page-level subscribers.
      for (const fn of subscribersRef.current) {
        try { fn(data); } catch { /* keep going for others */ }
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      scheduleReconnect();
    };
    ws.onerror = () => {
      // The browser will fire onclose immediately after onerror; reconnect
      // logic lives there. Nothing to do here.
    };

    wsRef.current = ws;
  }, [refreshUnread]);

  // Exponential-ish backoff: 1s, then 3s, then 6s, capped. Each successful
  // open resets the attempt count.
  const attemptRef = useRef(0);
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) return;
    const attempt = attemptRef.current++;
    const delay = Math.min(6000, 1000 + attempt * 2000);
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      connect();
    }, delay);
  }, [connect]);

  // Lifecycle — open the socket when the user is signed in.
  useEffect(() => {
    if (!user) return;
    attemptRef.current = 0;
    connect();
    refreshUnread();
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        try { wsRef.current.close(); } catch { /* ignore */ }
        wsRef.current = null;
      }
    };
  }, [user, connect, refreshUnread]);

  return (
    <MessagesCtx.Provider value={{ unread, subscribe, refreshUnread, setUnread }}>
      {children}
    </MessagesCtx.Provider>
  );
}

export const useMessages = () => useContext(MessagesCtx);
