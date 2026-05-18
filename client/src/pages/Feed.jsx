// Smith — Feed page
// Ported from FeedPageB. Three columns: a thin profile card on the left,
// the feed (with create-post composer trigger) in the middle, and a "people
// you may know" + "industry news" rail on the right.

import React, { useEffect, useState, useCallback } from 'react';
import { B } from '../lib/theme.js';
import { TopNav } from '../components/TopNav.jsx';
import { Avatar, Photo } from '../components/Primitives.jsx';
import { Icon } from '../components/Icon.jsx';
import { FeedPost } from '../components/FeedPost.jsx';
import { ComposePost } from '../components/ComposePost.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { useRouter } from '../lib/router.jsx';

export function FeedPage() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [posts, setPosts] = useState([]);
  const [profile, setProfile] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [composing, setComposing] = useState(false);
  const [scope, setScope] = useState('network');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [feed, prof, sug] = await Promise.all([
        api.get(`/posts/feed?scope=${scope}`),
        api.get('/profiles/me'),
        api.get('/connections/suggestions?limit=4'),
      ]);
      setPosts(feed.posts);
      setProfile(prof.profile);
      setSuggestions(sug.suggestions);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => { load(); }, [load]);

  const onPosted = (post) => setPosts(p => [post, ...p]);

  const sendConnect = async (targetId) => {
    try {
      await api.post('/connections/request', { target_id: targetId });
      // Pop them from suggestions optimistically.
      setSuggestions(s => s.filter(x => x.id !== targetId));
    } catch { /* ignore */ }
  };

  return (
    <div style={{ background: B.bg, minHeight: '100vh' }}>
      <TopNav active="feed"/>
      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 40px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '260px 1fr 320px',
          gap: 16, alignItems: 'flex-start',
        }}>
          <ProfileCard profile={profile} onView={() => navigate('/profile')}/>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <ComposeTrigger
              user={user}
              onOpen={() => setComposing(true)}
            />

            <FeedScopeTabs scope={scope} onChange={setScope}/>

            {loading && (
              <div style={{ color: B.faint, fontSize: 13, fontStyle: 'italic', padding: 24, textAlign: 'center' }}>
                Loading the feed…
              </div>
            )}
            {!loading && posts.length === 0 && (
              <EmptyFeed scope={scope} onCompose={() => setComposing(true)}/>
            )}
            {posts.map(p => (
              <FeedPost
                key={p.id}
                post={p}
                onChange={load}
                onAuthorClick={(id) => navigate(`/profile/${id}`)}
              />
            ))}
          </div>

          <RightRail
            suggestions={suggestions}
            onConnect={sendConnect}
            onView={(id) => navigate(`/profile/${id}`)}
          />
        </div>
      </main>

      {composing && (
        <ComposePost
          user={user}
          onClose={() => setComposing(false)}
          onPosted={onPosted}
        />
      )}
    </div>
  );
}

// ── Left rail: thin profile preview ───────────────────────────────────
function ProfileCard({ profile, onView }) {
  if (!profile) return <div style={{ height: 240 }}/>;
  return (
    <aside style={{
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
      overflow: 'hidden', position: 'sticky', top: 88,
    }}>
      <Photo kind={profile.cover_kind} label="cover" height={64}/>
      <div style={{ padding: '0 22px 22px', marginTop: -28, textAlign: 'center' }}>
        <button onClick={onView} style={{
          background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
          display: 'inline-block',
        }}>
          <span style={{ display: 'inline-block', background: B.surface, padding: 4, borderRadius: '50%' }}>
            <Avatar initials={profile.initials} size={64} tone={profile.avatar_tone}/>
          </span>
        </button>
        <div className="serif" style={{
          color: B.text, fontWeight: 600, fontSize: 17, marginTop: 10,
          letterSpacing: '-0.01em',
        }}>{profile.name}</div>
        <div style={{ color: B.dim, fontSize: 12, marginTop: 2 }}>
          {profile.headline ? `${profile.headline.split('·')[0].trim()} · ` : ''}{profile.location}
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-around', marginTop: 16,
          paddingTop: 16, borderTop: `1px solid ${B.line}`,
        }}>
          <div>
            <div className="serif" style={{ color: B.text, fontWeight: 700, fontSize: 18 }}>
              {profile.network_size}
            </div>
            <div style={{ color: B.faint, fontSize: 11, fontStyle: 'italic' }}>network</div>
          </div>
          <div>
            <div className="serif" style={{ color: B.text, fontWeight: 700, fontSize: 18 }}>
              {profile.work_history.reduce((s, w) => s + (w.jobsites?.length || 0), 0)}
            </div>
            <div style={{ color: B.faint, fontSize: 11, fontStyle: 'italic' }}>jobsites</div>
          </div>
        </div>
        <button onClick={onView} style={{
          width: '100%', marginTop: 14, padding: '8px',
          background: 'transparent', border: `1px solid ${B.line}`, color: B.text,
          fontSize: 12, fontWeight: 600, borderRadius: 100, cursor: 'pointer',
        }}>View profile</button>
      </div>
    </aside>
  );
}

// ── Compose trigger ──────────────────────────────────────────────────
function ComposeTrigger({ user, onOpen }) {
  const initials = ((user?.first_name?.[0] || '') + (user?.last_name?.[0] || '')).toUpperCase();
  return (
    <div style={{
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
      padding: '16px 22px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar initials={initials} size={42} tone="rust"/>
        <button onClick={onOpen} style={{
          flex: 1, textAlign: 'left', padding: '11px 16px',
          background: B.bg, border: `1px solid ${B.line}`, color: B.dim,
          borderRadius: 100, fontSize: 14, cursor: 'pointer',
        }}>
          What are you building today, {user?.first_name || 'friend'}?
        </button>
      </div>
      <div style={{
        display: 'flex', gap: 4, marginTop: 14, paddingTop: 14,
        borderTop: `1px solid ${B.line}`,
      }}>
        {[
          { icon: 'image', label: 'Photo' },
          { icon: 'briefcase', label: 'Project update' },
          { icon: 'award', label: 'Milestone' },
        ].map(b => (
          <button key={b.label} onClick={onOpen} style={{
            flex: 1, padding: '8px', background: 'transparent', border: 'none',
            color: B.dim, fontSize: 12, fontWeight: 500,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, cursor: 'pointer',
          }}>
            <Icon name={b.icon} size={15} style={{ color: B.accent }}/> {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function FeedScopeTabs({ scope, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 4, alignItems: 'center',
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 100,
      padding: 4,
    }}>
      {[
        { k: 'network', label: 'Your network' },
        { k: 'all', label: 'Everyone' },
      ].map(t => (
        <button key={t.k} onClick={() => onChange(t.k)} style={{
          flex: 1, padding: '7px 16px', borderRadius: 100,
          background: scope === t.k ? B.bg : 'transparent',
          border: 'none',
          color: scope === t.k ? B.text : B.dim,
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>{t.label}</button>
      ))}
    </div>
  );
}

function EmptyFeed({ scope, onCompose }) {
  return (
    <div style={{
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
      padding: 32, textAlign: 'center',
    }}>
      <div className="serif" style={{
        color: B.text, fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em',
      }}>
        {scope === 'network'
          ? 'Your network feed is quiet.'
          : 'No posts yet.'}
      </div>
      <div style={{ color: B.dim, fontSize: 13, marginTop: 6 }}>
        {scope === 'network'
          ? 'Try the "Everyone" tab, or share an update yourself.'
          : 'Be the first to post.'}
      </div>
      <button onClick={onCompose} style={{
        marginTop: 16, background: B.text, border: 'none', color: B.surface,
        padding: '10px 18px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer',
      }}>Share something</button>
    </div>
  );
}

// ── Right rail ────────────────────────────────────────────────────────
function RightRail({ suggestions, onConnect, onView }) {
  return (
    <aside style={{
      display: 'flex', flexDirection: 'column', gap: 16,
      position: 'sticky', top: 88,
    }}>
      <section style={{
        background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
        padding: '22px 24px',
      }}>
        <h3 className="serif" style={{
          margin: '0 0 4px', fontSize: 16, fontWeight: 600,
          color: B.text, letterSpacing: '-0.01em',
        }}>People you may know</h3>
        <p style={{
          margin: '0 0 12px', color: B.faint, fontSize: 12, fontStyle: 'italic',
        }}>From your trade and area</p>
        {suggestions.length === 0 && (
          <div style={{ color: B.faint, fontSize: 12, fontStyle: 'italic', padding: '8px 0' }}>
            No suggestions right now.
          </div>
        )}
        {suggestions.map((c, i) => (
          <div key={c.id} style={{
            paddingTop: 14, marginTop: 14,
            borderTop: i === 0 ? 'none' : `1px solid ${B.line}`,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <button onClick={() => onView(c.id)} style={{
              background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', borderRadius: '50%',
            }}>
              <Avatar
                initials={(c.first_name[0] || '') + (c.last_name[0] || '')}
                size={42}
                tone={c.avatar_tone}
              />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: B.text, fontSize: 13, fontWeight: 600 }}>
                {c.first_name} {c.last_name}
              </div>
              <div style={{
                color: B.dim, fontSize: 11,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{c.current_role || c.headline}</div>
              {c.mutual > 0 && (
                <div style={{
                  color: B.faint, fontSize: 11, marginTop: 2, fontStyle: 'italic',
                }}>{c.mutual} mutual</div>
              )}
            </div>
            <button onClick={() => onConnect(c.id)} title="Connect" style={{
              background: 'transparent', border: `1px solid ${B.accent}`,
              color: B.accent, padding: '6px 10px', borderRadius: 100,
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}>+</button>
          </div>
        ))}
      </section>

      {/* Industry news — static for now per the design's own caveat */}
      <NewsRail/>
    </aside>
  );
}

function NewsRail() {
  const { navigate } = useRouter();
  const [items, setItems] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/news/for-you?limit=5')
      .then(d => { if (!cancelled) setItems(d.articles); })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, []);

  // Helper for relative time (same shape as in NewsCard, kept inline to
  // avoid pulling more imports for one usage)
  const relTime = (iso) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 3600)      return `${Math.round(diff / 60)}m ago`;
    if (diff < 86400)     return `${Math.round(diff / 3600)}h ago`;
    if (diff < 86400 * 7) return `${Math.round(diff / 86400)}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <section style={{
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
      padding: '22px 24px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 4,
      }}>
        <h3 className="serif" style={{
          margin: 0, fontSize: 16, fontWeight: 600,
          color: B.text, letterSpacing: '-0.01em',
        }}>The Trade · industry news</h3>
        <button onClick={() => navigate('/news')} style={{
          background: 'transparent', border: 'none', padding: 0,
          color: B.accent, fontSize: 11, fontWeight: 600, cursor: 'pointer',
        }}>See all →</button>
      </div>
      <div style={{ color: B.faint, fontSize: 11, fontStyle: 'italic', marginBottom: 10 }}>
        Personalized by your trades
      </div>

      {items === null && (
        <div style={{ color: B.faint, fontSize: 12, fontStyle: 'italic', padding: '8px 0' }}>
          Loading…
        </div>
      )}
      {items?.length === 0 && (
        <div style={{ color: B.faint, fontSize: 12, fontStyle: 'italic', padding: '8px 0' }}>
          No articles yet — try running ingestion or check back soon.
        </div>
      )}
      {items?.map((n, i) => (
        <button
          key={n.id}
          onClick={() => window.open(n.source_url, '_blank', 'noopener,noreferrer')}
          style={{
            width: '100%', textAlign: 'left',
            background: 'transparent', border: 'none', padding: 0,
            paddingTop: 12, marginTop: 12,
            borderTop: i ? `1px solid ${B.line}` : 'none',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: B.accent, padding: '2px 6px',
              background: B.accentSoft, borderRadius: 2,
            }}>{n.category}</span>
            <span style={{ color: B.faint, fontSize: 11 }}>{n.source}</span>
          </div>
          <div className="serif" style={{
            color: B.text, fontSize: 13.5, fontWeight: 600,
            lineHeight: 1.35, letterSpacing: '-0.01em',
          }}>{n.title}</div>
          <div style={{ color: B.faint, fontSize: 11, marginTop: 4, fontStyle: 'italic' }}>
            {n.read_minutes} min read · {relTime(n.published_at)}
          </div>
        </button>
      ))}
    </section>
  );
}
