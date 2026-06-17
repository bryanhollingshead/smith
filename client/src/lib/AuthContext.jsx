// Smith — Auth context
// Holds the signed-in user profile in memory + localStorage token. Fetches
// /api/auth/me on boot. Exposes signIn / signOut / refresh helpers.

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, auth } from './api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booted, setBooted] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!auth.get()) { setUser(null); return; }
    try {
      const { user } = await api.get('/auth/me');
      setUser(user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setBooted(true));
  }, [refresh]);

  const signIn = async (email, password) => {
    setLoading(true);
    try {
      const data = await api.post('/auth/signin', { email, password });
      auth.set(data.token);
      setUser(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async ({ email, password, first_name, last_name, role, hiring_context, invite_token }) => {
    setLoading(true);
    try {
      const data = await api.post('/auth/signup', {
        email, password, first_name, last_name, role, hiring_context, invite_token,
      });
      auth.set(data.token);
      setUser(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    auth.clear();
    setUser(null);
  };

  // Switch the persisted active mode. Server returns the updated user plus
  // `needs_setup: true` when the target mode has no underlying profile yet
  // (no home for homeowner; no trades for tradesman) — the caller routes to
  // a setup flow in that case before the new shell can render properly.
  const switchMode = async (mode) => {
    const data = await api.patch('/auth/me/mode', { mode });
    setUser(data.user);
    return { user: data.user, needsSetup: !!data.needs_setup };
  };

  return (
    <AuthCtx.Provider value={{
      user, booted, loading,
      signIn, signUp, signOut, refresh, setUser, switchMode,
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
