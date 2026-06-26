// Smith — Hire-me entry (homeowner-acquisition path #1)
//
// Route: /hire/:slug — public. The homeowner clicked "Hire Me" on a
// tradesperson's public profile. We collect their address (only), then
// hand off to /auth/homeowner with the address + entrySource + pro slug
// pre-filled in the URL so signup is a single submit away.

import React, { useEffect, useState } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from '../components/Icon.jsx';
import { Avatar } from '../components/Primitives.jsx';
import { EntryShell, AddressField } from '../components/HomeownerEntry.jsx';
import { useRouter } from '../lib/router.jsx';
import { useAuth } from '../lib/AuthContext.jsx';

export function HireMeEntryPage({ slug }) {
  const { navigate } = useRouter();
  const { user } = useAuth();
  const [pro, setPro] = useState(null);
  const [addressText, setAddressText] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/profiles/${encodeURIComponent(slug)}`);
        if (!res.ok) throw new Error('fetch');
        const data = await res.json();
        if (!cancelled) setPro(data.profile);
      } catch {
        if (!cancelled) setPro(null);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const firstName = pro?.first_name || 'them';
  const fullName = pro?.name || 'this Smith';

  const onContinue = () => {
    if (!addressText.trim()) return;
    const qs = new URLSearchParams({
      address: addressText.trim(),
      entry_source: 'hire-me',
      pro: slug,
    });
    // Signed-in users already have an account — route them to the
    // "add a home to your existing account" flow. The public signup
    // path would be force-bounced to /feed by the App.jsx auth-page
    // guard, dropping the address + pro slug along the way.
    if (user) {
      navigate(`/mode/setup-homeowner?${qs.toString()}`);
    } else {
      navigate(`/auth/homeowner?${qs.toString()}`);
    }
  };

  return (
    <EntryShell
      maxW={480}
      sideKind="frame"
      side={
        <div style={{ color: '#fff', maxWidth: 380 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <Avatar
              tone={pro?.avatar_tone || 'brick'}
              initials={pro?.initials || '··'}
              size={52}
              ring="rgba(255,255,255,0.3)"
            />
            <div>
              <div className="serif" style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>
                {fullName}
              </div>
              <div style={{ fontSize: 12.5, opacity: 0.8, fontStyle: 'italic' }}>
                {pro?.headline || 'Master tradesperson'}
                {pro?.years_experience > 0 && ` · ${pro.years_experience} yrs`}
                {pro?.location && ` · ${pro.location}`}
              </div>
            </div>
          </div>
          <div className="serif" style={{
            fontSize: 30, fontWeight: 500, lineHeight: 1.15, letterSpacing: '-0.02em',
          }}>
            "Tell me where, and I'll tell you what it'll take."
          </div>
          <div style={{ fontSize: 14, opacity: 0.82, marginTop: 16, lineHeight: 1.6 }}>
            {firstName} needs your address to scope the work and check they service your area. Smith turns it into a home profile you keep — for this project and every one after.
          </div>
        </div>
      }
    >
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: B.accentSoft, color: B.accent,
        padding: '5px 12px', borderRadius: 100, fontSize: 11.5, fontWeight: 600,
        marginBottom: 18,
      }}>
        <Icon name="briefcase" size={12}/> Hiring {fullName}
      </div>
      <h1 className="serif" style={{
        margin: 0, fontSize: 32, fontWeight: 600,
        letterSpacing: '-0.025em', lineHeight: 1.1,
      }}>
        Where's the work happening?
      </h1>
      <p style={{ color: B.dim, fontSize: 14.5, lineHeight: 1.55, margin: '12px 0 26px' }}>
        Your address scopes the job and confirms {firstName} covers your area. We'll start a private home profile — only you control who sees it.
      </p>

      <AddressField value={addressText} onChange={setAddressText}/>

      <div style={{ marginTop: 76 }}>
        <button
          onClick={onContinue}
          disabled={!addressText.trim()}
          style={{
            width: '100%',
            background: B.text, color: B.surface, border: 'none',
            padding: '15px', borderRadius: 100,
            fontSize: 15, fontWeight: 600,
            cursor: addressText.trim() ? 'pointer' : 'not-allowed',
            opacity: addressText.trim() ? 1 : 0.55,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
          Continue to {firstName} <Icon name="arrow-r" size={15} stroke={2.4}/>
        </button>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginTop: 16,
          color: B.faint, fontSize: 11.5, fontStyle: 'italic', justifyContent: 'center',
        }}>
          <Icon name="shield" size={12}/> Your address stays private until you share it with a pro.
        </div>
      </div>
    </EntryShell>
  );
}
