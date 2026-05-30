// Smith — Top navigation
// Ported from smith-direction-b.jsx → TopNavB. Live notification count, live
// search box, dropdown menu on the avatar.

import React, { useEffect, useState, useRef } from 'react';
import { B } from '../lib/theme.js';
import { useRouter } from '../lib/router.jsx';
import { useAuth } from '../lib/AuthContext.jsx';
import { useMessages } from '../lib/MessagesContext.jsx';
import { api } from '../lib/api.js';
import { Icon } from './Icon.jsx';
import { SmithLogo } from './Primitives.jsx';
import { SmithAvatar } from './SmithAvatar.jsx';

export function TopNav({ active }) {
  const { navigate } = useRouter();
  const { user, signOut } = useAuth();
  const { unread: unreadMessages } = useMessages();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Fetch this user's profile once so we can show their uploaded avatar.
  // AuthContext only holds session-level data; avatar_urls live on the
  // profile object. We refetch when the user identity changes (after sign-in)
  // or when avatar_urls might have changed (this tab does an upload).
  //
  // Other tabs / page visits already fetch /profiles/me — those updates flow
  // back here on next mount. For instant reflection after a same-tab avatar
  // change, the photo upload pages call refresh() in AuthContext, which we
  // observe via `user`.
  const [avatarUrls, setAvatarUrls] = useState(null);
  useEffect(() => {
    if (!user?.id) { setAvatarUrls(null); return; }
    let cancelled = false;
    api.get('/profiles/me')
      .then(d => { if (!cancelled) setAvatarUrls(d.profile?.avatar_urls || null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id, user?.avatar_url, user?.updated_at]);

  // Poll notifications every 30s — matches the "polling" decision.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await api.get('/notifications');
        if (!cancelled) setUnread(data.unread || 0);
      } catch { /* ignore */ }
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Click-outside dismissal for avatar menu.
  useEffect(() => {
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const items = [
    { k: 'feed', label: 'Feed', icon: 'home', to: '/feed' },
    { k: 'profile', label: 'Profile', icon: 'user', to: '/profile' },
    { k: 'connections', label: 'Network', icon: 'users', to: '/network' },
    { k: 'jobs', label: 'Jobs', icon: 'briefcase', to: '/jobs' },
    { k: 'inquiries', label: 'Inquiries', icon: 'hardhat', to: '/inquiries' },
    { k: 'news', label: 'News', icon: 'newspaper', to: '/news' },
    { k: 'messages', label: 'Messages', icon: 'message', to: '/messages',
      badge: unreadMessages || null },
    { k: 'notifications', label: 'Alerts', icon: 'bell', to: '/alerts', badge: unread || null },
  ];

  return (
    <header style={{
      background: B.surface, borderBottom: `1px solid ${B.line}`,
      position: 'sticky', top: 0, zIndex: 10,
    }}>
      <div style={{
        maxWidth: 1280, margin: '0 auto', padding: '0 32px',
        display: 'flex', alignItems: 'center', gap: 28, height: 68,
      }}>
        <button onClick={() => navigate('/feed')} style={{
          background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
        }}>
          <SmithLogo size={26}/>
        </button>

        <SearchBox/>

        <nav style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {items.map(it => (
            <button
              key={it.k}
              onClick={() => it.to && !it.disabled && navigate(it.to)}
              disabled={it.disabled}
              title={it.disabled ? 'Coming soon' : it.label}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                padding: '8px 14px', border: 'none', background: 'transparent',
                color: active === it.k ? B.text : (it.disabled ? B.faint : B.dim),
                borderBottom: active === it.k ? `2px solid ${B.accent}` : '2px solid transparent',
                position: 'relative', minWidth: 64,
                cursor: it.disabled ? 'not-allowed' : 'pointer',
                opacity: it.disabled ? 0.5 : 1,
              }}
            >
              <Icon name={it.icon} size={18}/>
              <span style={{ fontSize: 11, fontWeight: 500 }}>{it.label}</span>
              {it.badge ? (
                <span style={{
                  position: 'absolute', top: 4, right: 8, background: B.accent,
                  color: '#fff', fontSize: 9, fontWeight: 700,
                  padding: '1px 5px', borderRadius: 8, minWidth: 14,
                }}>{it.badge}</span>
              ) : null}
            </button>
          ))}
        </nav>

        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            style={{
              padding: 0, background: 'transparent', border: 'none', cursor: 'pointer',
              borderRadius: '50%',
            }}
          >
            <SmithAvatar
              urls={avatarUrls}
              initials={initialsOf(user)}
              size={38}
              tone={user?.avatar_tone || 'rust'}
            />
          </button>
          {menuOpen && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 8,
              background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
              minWidth: 200, padding: '6px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
              zIndex: 20,
            }} className="fade-in">
              <MenuItem icon="user" onClick={() => { setMenuOpen(false); navigate('/profile'); }}>My profile</MenuItem>
              <MenuItem icon="edit" onClick={() => { setMenuOpen(false); navigate('/profile/edit'); }}>Edit profile</MenuItem>
              <div style={{ height: 1, background: B.line, margin: '6px 0' }}/>
              <MenuItem icon="logout" onClick={() => { setMenuOpen(false); signOut(); }}>Sign out</MenuItem>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuItem({ icon, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', background: 'transparent', border: 'none',
      color: B.text, fontSize: 13, fontWeight: 500, textAlign: 'left',
      borderRadius: 4,
    }}
    onMouseEnter={e => e.currentTarget.style.background = B.bg}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <Icon name={icon} size={15} style={{ color: B.dim }}/>
      {children}
    </button>
  );
}

function initialsOf(user) {
  if (!user) return '·';
  const a = user.first_name?.[0] || '';
  const b = user.last_name?.[0] || '';
  return (a + b).toUpperCase() || (user.email?.[0] || '·').toUpperCase();
}

// ── Search box ────────────────────────────────────────────────────────
// Pops a result panel below the input. Debounced.
function SearchBox() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const { navigate } = useRouter();
  const ref = useRef(null);

  useEffect(() => {
    if (!q || q.length < 2) { setResults(null); return; }
    const id = setTimeout(async () => {
      try {
        const data = await api.get(`/search?q=${encodeURIComponent(q)}`);
        setResults(data);
      } catch { setResults(null); }
    }, 200);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const totalResults = results
    ? results.users.length + results.companies.length + results.jobsites.length + results.trades.length
    : 0;

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, maxWidth: 380 }}>
      <div style={{
        background: B.bg, border: `1px solid ${open ? B.accent : B.line}`,
        borderRadius: 100, padding: '8px 14px', display: 'flex',
        alignItems: 'center', gap: 8,
        color: B.dim,
        transition: 'border 120ms ease',
      }}>
        <Icon name="search" size={16}/>
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search trades, companies, jobsites…"
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: B.text, fontSize: 13, fontFamily: 'inherit',
          }}
        />
      </div>
      {open && q.length >= 2 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
          maxHeight: 380, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          zIndex: 20,
        }} className="fade-in scroll-thin">
          {!results && <div style={{ padding: 14, color: B.faint, fontSize: 13, fontStyle: 'italic' }}>Searching…</div>}
          {results && totalResults === 0 && (
            <div style={{ padding: 14, color: B.faint, fontSize: 13, fontStyle: 'italic' }}>No results.</div>
          )}
          {results?.users.length > 0 && (
            <Section label="People">
              {results.users.map(u => (
                <ResultRow
                  key={`u${u.id}`}
                  onClick={() => { setOpen(false); setQ(''); navigate(`/profile/${u.id}`); }}
                  avatar={<SmithAvatar urls={u.avatar_urls} size={32} tone={u.avatar_tone} initials={(u.first_name[0]||'') + (u.last_name[0]||'')}/>}
                  title={`${u.first_name} ${u.last_name}`}
                  sub={u.headline || u.location}
                />
              ))}
            </Section>
          )}
          {results?.companies.length > 0 && (
            <Section label="Companies">
              {results.companies.map(c => {
                const logoSrc = c.logo_urls?.thumb || c.logo_urls?.medium;
                return (
                  <ResultRow
                    key={`c${c.id}`}
                    avatar={logoSrc ? (
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        border: `1px solid ${B.line}`, flexShrink: 0,
                        background: `center/cover url("${logoSrc}") no-repeat`,
                      }}/>
                    ) : (
                      <div style={{ width:32, height:32, background: B.bg, border:`1px solid ${B.line}`, borderRadius: '50%', display:'flex', alignItems:'center', justifyContent:'center', color: B.accent }}><Icon name="building" size={15}/></div>
                    )}
                    title={c.name}
                    sub={c.type + (c.claimed ? '' : ' · unclaimed')}
                  />
                );
              })}
            </Section>
          )}
          {results?.jobsites.length > 0 && (
            <Section label="Jobsites">
              {results.jobsites.map(j => (
                <ResultRow
                  key={`j${j.id}`}
                  avatar={<div style={{ width:32, height:32, background: B.bg, border:`1px solid ${B.line}`, borderRadius: 4, display:'flex', alignItems:'center', justifyContent:'center', color: B.accent }}><Icon name="hardhat" size={15}/></div>}
                  title={j.title}
                  sub={`${j.kind} · ${j.location}`}
                />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

const Section = ({ label, children }) => (
  <div>
    <div style={{
      padding: '10px 14px 4px', color: B.faint, fontSize: 10,
      fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
    }}>{label}</div>
    {children}
  </div>
);

const ResultRow = ({ avatar, title, sub, onClick }) => (
  <button onClick={onClick} style={{
    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
    padding: '8px 14px', border: 'none', background: 'transparent', textAlign: 'left',
  }}
  onMouseEnter={e => e.currentTarget.style.background = B.bg}
  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
    {avatar}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ color: B.text, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
      <div style={{ color: B.dim, fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
    </div>
  </button>
);
