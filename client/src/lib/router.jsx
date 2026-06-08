// Smith — Minimal hash-based router
// Hash routing avoids needing server-side rewrites and keeps deps zero.
// Routes look like #/feed, #/profile, #/profile/123, #/auth/signin, etc.
//
// Clean-URL entry: the server SPA fallback serves index.html for any non-/api
// path, and some shareable links (notably /profile/:slug from VisibilityCard)
// are generated without a hash. When the app boots at such a URL we promote
// the pathname into the hash so the rest of the routing tree just works.

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const RouterCtx = createContext({ path: '/', params: {}, navigate: () => {} });

function parseHash() {
  let raw = (window.location.hash || '').replace(/^#/, '');
  // Clean-URL fallback: no hash, but the server served us at /something —
  // treat the pathname as the route. Lets /profile/:slug (shared link)
  // reach the slug-matching branches in App.jsx.
  if (!raw && window.location.pathname && window.location.pathname !== '/') {
    raw = window.location.pathname + (window.location.search || '');
  }
  raw = raw || '/';
  const [path, qs] = raw.split('?');
  const params = {};
  if (qs) for (const kv of qs.split('&')) {
    const [k, v] = kv.split('=');
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
  }
  return { path: path || '/', params };
}

export function RouterProvider({ children }) {
  const [{ path, params }, setState] = useState(() => {
    // Canonicalize a clean-URL entry to a hash route on boot. Without this,
    // a visit to /profile/:slug followed by navigate('/feed') would leave
    // the URL as /profile/:slug#/feed (hash changes, pathname doesn't).
    if (typeof window !== 'undefined'
        && !window.location.hash
        && window.location.pathname
        && window.location.pathname !== '/') {
      const target = window.location.pathname + (window.location.search || '');
      window.history.replaceState(null, '', '/#' + target);
    }
    return parseHash();
  });

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
