// Smith — Minimal history-API router
//
// Clean URLs (no #) so the server-side meta-tag injection in spa-meta.js
// actually fires for /company/:slug and /profile/:slug — crawlers and AI
// agents read what's in <head>, and the head differs per route only when the
// path reaches the server. The SPA fallback in server/src/index.js sends
// index.html for any non-/api path, and Vite's dev server does the same in
// development, so history mode "just works" on both sides.
//
// Legacy magic links and bookmarks point to /#/<route> from when this app
// used a hash router. On boot, we detect that shape and replaceState to the
// clean path so existing URLs keep landing on the right screen without
// triggering a double-fetch.
//
// navigate() uses pushState; popstate keeps the React state in sync with
// browser back/forward.

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const RouterCtx = createContext({ path: '/', params: {}, navigate: () => {} });

function parseLocation() {
  const path = window.location.pathname || '/';
  const params = {};
  const search = window.location.search || '';
  if (search.startsWith('?')) {
    for (const kv of search.slice(1).split('&')) {
      const [k, v] = kv.split('=');
      if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    }
  }
  return { path, params };
}

// One-shot migration: if the URL still uses the old #/<route> shape (from
// existing magic links, old bookmarks, etc.), rewrite it cleanly so the rest
// of the routing tree never has to think about hash routes.
function migrateLegacyHashUrl() {
  if (typeof window === 'undefined') return;
  const hash = window.location.hash || '';
  if (!hash.startsWith('#/')) return;
  const target = hash.slice(1); // strip the #
  const cleanUrl = target + (window.location.search || '');
  window.history.replaceState(null, '', cleanUrl);
}

export function RouterProvider({ children }) {
  const [{ path, params }, setState] = useState(() => {
    migrateLegacyHashUrl();
    return parseLocation();
  });

  useEffect(() => {
    const onPop = () => setState(parseLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to, opts = {}) => {
    if (typeof to !== 'string') return;
    // Strip a leading hash if a caller still passes one — defensive against
    // older call sites that haven't been migrated.
    if (to.startsWith('#')) to = to.slice(1);
    const target = to.startsWith('/') ? to : '/' + to;
    if (opts.replace) {
      window.history.replaceState(null, '', target);
    } else {
      window.history.pushState(null, '', target);
    }
    setState(parseLocation());
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
