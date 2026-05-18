// Smith — Minimal hash-based router
// Hash routing avoids needing server-side rewrites and keeps deps zero.
// Routes look like #/feed, #/profile, #/profile/123, #/auth/signin, etc.

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const RouterCtx = createContext({ path: '/', params: {}, navigate: () => {} });

function parseHash() {
  const raw = (window.location.hash || '').replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const params = {};
  if (qs) for (const kv of qs.split('&')) {
    const [k, v] = kv.split('=');
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
  }
  return { path: path || '/', params };
}

export function RouterProvider({ children }) {
  const [{ path, params }, setState] = useState(parseHash());

  useEffect(() => {
    const onHash = () => setState(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((to, opts = {}) => {
    if (typeof to !== 'string') return;
    if (opts.replace) {
      const url = `${window.location.pathname}#${to.startsWith('/') ? to : '/' + to}`;
      window.history.replaceState(null, '', url);
      // replaceState doesn't fire hashchange — manually sync.
      setState(parseHash());
    } else {
      window.location.hash = to.startsWith('/') ? to : '/' + to;
    }
    // Always scroll to top on navigation.
    window.scrollTo(0, 0);
  }, []);

  return (
    <RouterCtx.Provider value={{ path, params, navigate }}>
      {children}
    </RouterCtx.Provider>
  );
}

export const useRouter = () => useContext(RouterCtx);

/**
 * Match the current path against simple patterns like '/profile/:id'.
 * Returns matched params, or null if no match.
 */
export function match(pattern, path) {
  const pParts = pattern.split('/').filter(Boolean);
  const aParts = path.split('/').filter(Boolean);
  if (pParts.length !== aParts.length) return null;
  const out = {};
  for (let i = 0; i < pParts.length; i++) {
    if (pParts[i].startsWith(':')) out[pParts[i].slice(1)] = aParts[i];
    else if (pParts[i] !== aParts[i]) return null;
  }
  return out;
}
