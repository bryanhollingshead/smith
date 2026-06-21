// Smith — Public profile page (Jobs module phase 5)
//
// Renders /profile/:slug. Reachable WITHOUT a Smith account. Reuses the
// existing ProfileSections for the body (About/Featured/Companies/Credentials)
// and provides a slim header + "Hire Me" CTA in place of Connect/Message.
//
// Routing: App.jsx detects whether the URL param looks like a slug
// (`first-last-####` — always has a hyphen + letters) or a numeric id, and
// routes accordingly. This file handles the slug case only.

import React, { useEffect, useState, useCallback } from 'react';
import { B } from '../lib/theme.js';
import {
  AboutSection, CompaniesSection, FeaturedSection, CredentialsSection,
} from '../components/ProfileSections.jsx';
import { SmithAvatar } from '../components/SmithAvatar.jsx';
import { Photo, SmithLogo } from '../components/Primitives.jsx';
import { Icon } from '../components/Icon.jsx';
import { useAuth } from '../lib/AuthContext.jsx';
import { useRouter } from '../lib/router.jsx';

export function PublicProfilePage({ slug }) {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // The Hire Me button now routes to the homeowner-acquisition entry flow
  // (/hire/:slug) instead of opening the structured-inquiry modal. The old
  // modal is preserved in the codebase for non-homeowner inquiry surfaces.
  const goToHireFlow = () => navigate(`/hire/${slug}`);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/profiles/${encodeURIComponent(slug)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setProfile(data.profile);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!profile?.name) return;
    const prev = document.title;
    const tail = profile.headline ? ` — ${profile.headline}` : '';
    document.title = `${profile.name}${tail} · Smith`;
    return () => { document.title = prev; };
  }, [profile?.name, profile?.headline]);

  // Owner viewing their own public page from signed-in state — show a
  // little "edit" hint instead of Hire Me (you can't hire yourself).
  const isOwner = !!(user && profile && user.id === profile.id);

  return (
    <div style={{ background: B.bg, minHeight: '100vh' }}>
      <PublicChrome navigate={navigate} signedIn={!!user}/>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px 56px' }}>
        {loading && <Skeleton/>}
        {error && (
          <div style={{
            background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
            padding: '40px 28px', textAlign: 'center',
          }}>
            <div className="serif" style={{ fontSize: 22, fontWeight: 600, color: B.text, marginBottom: 8 }}>
              Profile not found.
            </div>
            <div style={{ color: B.dim, fontSize: 14 }}>
              This link might be private or the slug may have changed.
            </div>
          </div>
        )}
        {profile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <PublicProfileHeader
              profile={profile}
              isOwner={isOwner}
              onHireMe={goToHireFlow}
            />
            <AboutSection profile={profile} isMe={false}/>
            <FeaturedSection profile={profile} isMe={false} navigate={navigate}/>
            <CompaniesSection profile={profile} isMe={false}/>
            <CredentialsSection profile={profile} isMe={false}/>
          </div>
        )}
      </main>

    </div>
  );
}

// Slim public header — visual matches the authed ProfileHeader but the
// action area is "Hire Me" instead of Connect / Edit / Message.
function PublicProfileHeader({ profile, isOwner, onHireMe }) {
  const coverPhotoUrl = profile.cover_urls?.medium || profile.cover_urls?.full;
  return (
    <section style={{
      background: B.surface, border: `1px solid ${B.line}`,
      borderRadius: 4, overflow: 'hidden',
    }}>
      {coverPhotoUrl
        ? <div style={{ height: 220, background: `center/cover url("${coverPhotoUrl}") no-repeat` }}/>
        : <Photo kind={profile.cover_kind} label="cover" height={220}/>
      }
      <div style={{ padding: '28px 40px 32px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginTop: -88 }}>
          <div style={{ background: B.surface, padding: 5, borderRadius: '50%' }}>
            <SmithAvatar
              urls={profile.avatar_urls}
              initials={profile.initials}
              size={144}
              tone={profile.avatar_tone}
            />
          </div>
          <div style={{ flex: 1, paddingTop: 96 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 className="serif" style={{
                margin: 0, fontSize: 36, fontWeight: 600,
                color: B.text, letterSpacing: '-0.02em',
              }}>{profile.name}</h1>
              {profile.verified_smith && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', background: B.accentSoft, color: B.accent,
                  borderRadius: 100, fontSize: 11, fontWeight: 600,
                }}>
                  <Icon name="verified" size={12} stroke={2}/> Verified Smith
                </span>
              )}
            </div>
            {profile.headline && (
              <p style={{ margin: '8px 0 0', color: B.text, fontSize: 17 }}>{profile.headline}</p>
            )}
            <div style={{ display: 'flex', gap: 24, marginTop: 12, color: B.dim, fontSize: 13, flexWrap: 'wrap' }}>
              {profile.location && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="mappin" size={14}/> {profile.location}
                </span>
              )}
              {profile.years_experience > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="briefcase" size={14}/> {profile.years_experience} years building
                </span>
              )}
              {profile.trades?.length > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="tool" size={14}/> {profile.trades.map(t => t.name).join(' · ')}
                </span>
              )}
            </div>
          </div>
          <div style={{ paddingTop: 96, flexShrink: 0 }}>
            {isOwner ? (
              <span style={{ color: B.faint, fontSize: 12, fontStyle: 'italic' }}>
                Your public profile
              </span>
            ) : (
              <button onClick={onHireMe} style={{
                background: B.accent, color: B.surface, border: 'none',
                padding: '12px 24px', borderRadius: 100, fontSize: 14, fontWeight: 600,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                <Icon name="hardhat" size={16} stroke={2}/> Hire {profile.first_name || 'me'}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// Minimal chrome for public visits — Smith mark + a "Build your own profile"
// CTA. Doesn't import TopNav (which assumes auth/MessagesProvider context).
function PublicChrome({ navigate, signedIn }) {
  return (
    <header style={{
      background: B.surface, borderBottom: `1px solid ${B.line}`, padding: '14px 32px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <button onClick={() => navigate('/')} style={{
        background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
      }}>
        <SmithLogo size={24}/>
      </button>
      {signedIn ? (
        <button onClick={() => navigate('/feed')} style={{
          background: 'transparent', border: `1px solid ${B.line}`, color: B.text,
          padding: '7px 16px', borderRadius: 100, fontSize: 13, fontWeight: 600,
          cursor: 'pointer',
        }}>Back to feed</button>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/auth/signin')} style={{
            background: 'transparent', border: `1px solid ${B.line}`, color: B.text,
            padding: '7px 16px', borderRadius: 100, fontSize: 13, fontWeight: 600,
            cursor: 'pointer',
          }}>Sign in</button>
          <button onClick={() => navigate('/auth/signup')} style={{
            background: B.text, border: 'none', color: B.surface,
            padding: '7px 16px', borderRadius: 100, fontSize: 13, fontWeight: 600,
            cursor: 'pointer',
          }}>Build your profile</button>
        </div>
      )}
    </header>
  );
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {[300, 200, 280, 180].map((h, i) => (
        <div key={i} style={{
          height: h, background: B.surface, border: `1px solid ${B.line}`,
          borderRadius: 4, opacity: 0.6,
        }}/>
      ))}
    </div>
  );
}
