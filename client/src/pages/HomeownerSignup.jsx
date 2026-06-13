// Smith — Homeowner self-serve signup (homeowner-acquisition path #2 &
// shared landing for the hire-me path's account-creation step).
//
// Route: /auth/homeowner — public. Query params allow the hire-me path to
// pre-fill the address + smuggle entry_source + pro slug through:
//   ?place_id=…&address=…&entry_source=hire-me&pro=marcus-…
//
// Submits create a homeowner account, mint the seed home, then route to
// /home/:id/confirm.

import React, { useEffect, useState } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from '../components/Icon.jsx';
import { EntryShell, EntryInput, AddressField, HiringContextChoice } from '../components/HomeownerEntry.jsx';
import { useAuth } from '../lib/AuthContext.jsx';
import { useRouter } from '../lib/router.jsx';
import { api } from '../lib/api.js';

export function HomeownerSignupPage() {
  const { signUp } = useAuth();
  const { navigate, params } = useRouter();

  const incomingAddress = params.address || '';
  const incomingPlaceId = params.place_id || null;
  const entrySource = params.entry_source === 'hire-me' ? 'hire-me' : 'self-serve';
  const proSlug = params.pro || null;

  const [picked, setPicked] = useState(
    incomingPlaceId
      ? { place_id: incomingPlaceId, main: incomingAddress.split(',')[0] || incomingAddress, sub: incomingAddress.split(',').slice(1).join(',').trim() }
      : null
  );
  const [addressText, setAddressText] = useState(incomingAddress);
  // One-tap hiring-context declaration. Drives the DISPLAYED mode label
  // ("Homeowner" vs "Property manager") — never stored as a label string,
  // only as this enum. Default = own_home so the user can blow past it in
  // one click if they're claiming their own house.
  const [hiringContext, setHiringContext] = useState('own_home');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const onSubmit = async () => {
    setError(null);
    if (!picked) { setError('Pick an address from the suggestions.'); return; }
    if (!email.trim()) { setError('Email is required.'); return; }
    if (!password || password.length < 12) { setError('Password must be at least 12 characters.'); return; }
    if (!terms) { setError('Please agree to the terms.'); return; }

    setBusy(true);
    try {
      await signUp({
        email: email.trim(), password,
        role: 'homeowner',
        hiring_context: hiringContext,
      });
      // Mint the seed home using the picked place + the records the server
      // has on file (so the AddressFound screen has facts to show).
      const { home } = await api.post('/homes', {
        place_id: picked.place_id,
        entry_source: entrySource,
        pending_pro_slug: proSlug,
      });
      navigate(`/home/${home.id}/confirm`);
    } catch (e) {
      setError(e.data?.error || e.message || 'Could not create your account.');
    } finally {
      setBusy(false);
    }
  };

  const headline = entrySource === 'hire-me'
    ? 'One step before you continue.'
    : 'Claim your home.';
  const subhead = entrySource === 'hire-me'
    ? 'Create your account and we\'ll route you to the pro you came from.'
    : 'Two minutes to start. Add the rest whenever you like.';

  return (
    <EntryShell
      maxW={460}
      sideKind="frame"
      side={
        <div style={{ color: '#fff', maxWidth: 400 }}>
          <div style={{ fontSize: 12, fontStyle: 'italic', opacity: 0.85, marginBottom: 16 }}>
            Smith — for the home
          </div>
          <div className="serif" style={{
            fontSize: 34, fontWeight: 500, lineHeight: 1.12, letterSpacing: '-0.025em',
          }}>
            Your house, finally documented.
          </div>
          <div style={{ fontSize: 14.5, opacity: 0.85, marginTop: 18, lineHeight: 1.6 }}>
            Start with your address. Smith builds a living profile of your home — systems, history, what's behind the walls — so every future project is faster, cheaper, and yours to keep.
          </div>
          <div style={{ display: 'flex', gap: 24, marginTop: 28 }}>
            {[
              { v: '12k+', l: 'SLC homes' },
              { v: '6 min', l: 'avg setup' },
              { v: 'Free',  l: 'to start' },
            ].map(s => (
              <div key={s.l}>
                <div className="serif" style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>
                  {s.v}
                </div>
                <div style={{ fontSize: 11.5, opacity: 0.7, fontStyle: 'italic' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      }
    >
      <h1 className="serif" style={{
        margin: 0, fontSize: 32, fontWeight: 600,
        letterSpacing: '-0.025em', lineHeight: 1.1,
      }}>
        {headline}
      </h1>
      <p style={{ color: B.dim, fontSize: 14.5, lineHeight: 1.55, margin: '12px 0 24px' }}>
        {subhead}
      </p>

      <HiringContextChoice
        value={hiringContext}
        onChange={setHiringContext}
        disabled={busy}
      />

      <AddressField
        autoFocus={!incomingPlaceId}
        value={addressText}
        onChange={(t) => { setAddressText(t); }}
        onPick={(item) => {
          setPicked(item);
          setAddressText(item.main + ', ' + item.sub.split(' · ')[0]);
        }}
      />
      <EntryInput
        icon="mail" label="Email" type="email"
        value={email} onChange={(e) => setEmail(e.target.value)}
        disabled={busy} autoComplete="email"
      />
      <EntryInput
        icon="shield" label="Create a password" type="password"
        value={password} onChange={(e) => setPassword(e.target.value)}
        disabled={busy} hint="12+ characters." autoComplete="new-password"
      />

      <label style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        margin: '4px 0 22px', cursor: 'pointer',
      }}>
        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)}
          disabled={busy}
          style={{ accentColor: B.accent, marginTop: 3 }}/>
        <span style={{ color: B.dim, fontSize: 12.5, lineHeight: 1.5 }}>
          I agree to the <a href="#" style={{ color: B.accent }}>Terms</a> & <a href="#" style={{ color: B.accent }}>Privacy</a>. I confirm I own or live at this address.
        </span>
      </label>

      {error && (
        <div style={{
          background: B.dangerSoft, color: B.danger,
          border: `1px solid ${B.danger}`, borderRadius: 6,
          padding: '8px 12px', marginBottom: 14, fontSize: 13,
        }}>{error}</div>
      )}

      <button
        onClick={onSubmit}
        disabled={busy}
        style={{
          width: '100%', background: B.text, color: B.surface, border: 'none',
          padding: '15px', borderRadius: 100,
          fontSize: 15, fontWeight: 600,
          cursor: busy ? 'not-allowed' : 'pointer',
          opacity: busy ? 0.7 : 1,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
        {busy ? 'Finding your home…' : 'Find my home'} <Icon name="arrow-r" size={15} stroke={2.4}/>
      </button>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0',
      }}>
        <div style={{ flex: 1, height: 1, background: B.line }}/>
        <span style={{ color: B.faint, fontSize: 11.5, fontStyle: 'italic' }}>or</span>
        <div style={{ flex: 1, height: 1, background: B.line }}/>
      </div>
      <button
        onClick={() => alert('Google sign-in is coming soon.')} // TODO: wire Google OAuth
        disabled={busy}
        style={{
          width: '100%', background: 'transparent', color: B.text,
          border: `1px solid ${B.line}`,
          padding: '13px', borderRadius: 100,
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>
        Continue with Google
      </button>
    </EntryShell>
  );
}
