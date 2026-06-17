// Smith — News page
//
// Layout:
//   1. Scope toggle — For you / All.
//   2. Category tabs — All / The Trade / Career / Materials / Labor / Safety / Codes / Tech & AI.
//   3. Article grid — uniform text-only NewsCards in 3 columns.
//   4. Right rail — saved count, trending in your trades, popular tags, admin entry.

import React, { useEffect, useState, useCallback } from 'react';
import { B } from '../lib/theme.js';
import { TopNav } from '../components/TopNav.jsx';
import { NewsCard, NewsRow } from '../components/NewsCard.jsx';
import { Icon } from '../components/Icon.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { useRouter } from '../lib/router.jsx';

const SCOPES = [
  { k: 'for-you', label: 'For you' },   // pulls /news/for-you
  { k: 'all',     label: 'All' },        // pulls /news with no category filter
];

export function NewsPage() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [scope, setScope] = useState('for-you');
  const [category, setCategory] = useState(null);     // null = no category filter
  const [tagFilter, setTagFilter] = useState(null);   // null = no tag filter (single tag for v1)
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [forYouRail, setForYouRail] = useState([]);
  const [savedCount, setSavedCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Debounce the search input so we don't spam the API on each keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Load the things that don't depend on the active filter — runs once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cats, tg, forU, saved] = await Promise.all([
          api.get('/news/categories'),
          api.get('/news/tags'),
          api.get('/news/for-you?limit=5'),
          api.get('/news/saved'),
        ]);
        if (cancelled) return;
        setCategories(cats.categories);
        setTags(tg.tags);
        setForYouRail(forU.articles);
        setSavedCount(saved.articles.length);
        // Sniff admin by probing the admin endpoint — 200 = admin, 403 = not.
        try {
          await api.get('/admin/news/feeds');
          setIsAdmin(true);
        } catch { setIsAdmin(false); }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Reload the article grid whenever filters change.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      let path;
      if (scope === 'for-you' && !category && !tagFilter && !debouncedSearch) {
        path = '/news/for-you?limit=24';
      } else {
        const params = new URLSearchParams();
        if (category) params.set('category', category);
        if (tagFilter) params.set('tag', tagFilter);
        if (debouncedSearch) params.set('q', debouncedSearch);
        params.set('limit', '24');
        path = `/news?${params.toString()}`;
      }
      const data = await api.get(path);
      setArticles(data.articles);
    } finally {
      setLoading(false);
    }
  }, [scope, category, tagFilter, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ background: B.bg, minHeight: '100vh' }}>
      <TopNav active="news"/>
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 40px' }}>

        {/* Page title */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          marginBottom: 24, flexWrap: 'wrap', gap: 16,
        }}>
          <div>
            <h1 className="serif" style={{
              color: B.text, fontSize: 40, fontWeight: 600, margin: 0,
              letterSpacing: '-0.025em', lineHeight: 1,
            }}>Sparks from the Forge</h1>
            <p style={{
              color: B.dim, fontSize: 15, margin: '8px 0 0',
              fontStyle: 'italic',
            }}>
              Industry news, codes, wages, and the tools getting picked up on jobsites.
            </p>
          </div>
          <div style={{
            display: 'flex', gap: 10, alignItems: 'center',
          }}>
            <div style={{
              background: B.surface, border: `1px solid ${B.line}`,
              borderRadius: 100, padding: '8px 14px',
              display: 'flex', alignItems: 'center', gap: 8, color: B.dim,
              width: 280,
            }}>
              <Icon name="search" size={14}/>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search the news…"
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  flex: 1, fontSize: 13, color: B.text, fontFamily: 'inherit',
                }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{
                  background: 'transparent', border: 'none', color: B.faint,
                  padding: 0, cursor: 'pointer', display: 'inline-flex',
                }}>
                  <Icon name="x" size={13}/>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Scope (For you / All) */}
        <div style={{
          display: 'flex', gap: 4, alignItems: 'center',
          background: B.surface, border: `1px solid ${B.line}`, borderRadius: 100,
          padding: 4, marginBottom: 16, width: 'fit-content',
        }}>
          {SCOPES.map(t => (
            <button key={t.k} onClick={() => {
              setScope(t.k);
              setCategory(null);
            }} style={{
              padding: '7px 18px', borderRadius: 100,
              background: scope === t.k && !category ? B.bg : 'transparent',
              border: 'none',
              color: scope === t.k && !category ? B.text : B.dim,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Category tabs */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap',
          paddingBottom: 14, borderBottom: `1px solid ${B.line}`,
        }}>
          <CategoryChip
            label="All categories"
            active={!category}
            onClick={() => setCategory(null)}
          />
          {categories.map(c => (
            <CategoryChip
              key={c.name}
              label={c.name}
              count={c.count}
              active={category === c.name}
              onClick={() => {
                setCategory(c.name);
                setScope('all');  // category filter implies "all" scope
              }}
            />
          ))}
        </div>

        {/* Tag filter chips (active filter banner) */}
        {tagFilter && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
            padding: '10px 16px', background: B.accentSoft, borderRadius: 4,
          }}>
            <span style={{ color: B.dim, fontSize: 12 }}>Filtering by tag:</span>
            <span style={{
              padding: '4px 10px', background: B.accent, color: '#fff',
              fontSize: 12, fontWeight: 700, borderRadius: 100,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              {tagFilter}
              <button onClick={() => setTagFilter(null)} style={{
                background: 'transparent', border: 'none', color: '#fff', padding: 0,
                cursor: 'pointer', display: 'inline-flex',
              }}>
                <Icon name="x" size={11} stroke={2.6}/>
              </button>
            </span>
          </div>
        )}

        {/* Two-column layout: grid + right rail */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 280px',
          gap: 24, alignItems: 'flex-start',
        }}>

          <div>
            {/* Article grid */}
            {loading && (
              <div style={{
                color: B.faint, fontStyle: 'italic', padding: 36, textAlign: 'center',
              }}>Loading the news…</div>
            )}

            {!loading && articles.length === 0 && (
              <EmptyState category={category} tag={tagFilter} search={debouncedSearch}/>
            )}

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 14,
            }}>
              {articles.map(a => (
                <NewsCard key={a.id} article={a} onTagClick={t => setTagFilter(t)}/>
              ))}
            </div>
          </div>

          {/* Right rail */}
          <aside style={{
            position: 'sticky', top: 88,
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <RailSection title="Saved for later">
              <button onClick={() => navigate('/news/saved')} style={{
                background: 'transparent', border: 'none', padding: 0,
                color: B.accent, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <Icon name="briefcase" size={14}/>
                {savedCount} {savedCount === 1 ? 'article' : 'articles'} saved
                <Icon name="chevron-r" size={12}/>
              </button>
            </RailSection>

            <RailSection title="Trending in your trades" sub="From your active trades">
              {forYouRail.length === 0 && (
                <div style={{ color: B.faint, fontSize: 12, fontStyle: 'italic' }}>
                  Set a trade to see picks here.
                </div>
              )}
              {forYouRail.slice(0, 4).map((a, i) => (
                <div key={a.id} style={{
                  borderTop: i ? `1px solid ${B.line}` : 'none',
                }}>
                  <NewsRow article={a}/>
                </div>
              ))}
            </RailSection>

            {tags.length > 0 && (
              <RailSection title="Popular tags">
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {tags.slice(0, 20).map(t => (
                    <button
                      key={t.tag}
                      onClick={() => setTagFilter(t.tag)}
                      style={{
                        padding: '4px 10px', background: B.bg,
                        border: `1px solid ${B.line}`, borderRadius: 100,
                        fontSize: 11, color: B.dim, fontWeight: 500,
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = B.accentSoft;
                        e.currentTarget.style.color = B.accent;
                        e.currentTarget.style.borderColor = B.accent;
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = B.bg;
                        e.currentTarget.style.color = B.dim;
                        e.currentTarget.style.borderColor = B.line;
                      }}
                    >
                      {t.tag}{' '}
                      <span style={{ color: B.faint, fontSize: 10 }}>{t.n}</span>
                    </button>
                  ))}
                </div>
              </RailSection>
            )}

            {isAdmin && (
              <RailSection title="Admin">
                <button onClick={() => navigate('/admin/news')} style={{
                  background: B.text, border: 'none', color: B.surface,
                  padding: '8px 14px', borderRadius: 100,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                }}>
                  <Icon name="edit" size={12} stroke={2.4}/>
                  Manage news queue
                </button>
              </RailSection>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────
function CategoryChip({ label, count, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 16px', borderRadius: 100,
      background: active ? B.text : B.surface,
      border: `1px solid ${active ? B.text : B.line}`,
      color: active ? B.surface : B.text,
      fontSize: 13, fontWeight: 600, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', gap: 7,
      transition: 'all 120ms ease',
    }}>
      {label}
      {count !== undefined && (
        <span style={{
          fontSize: 10, color: active ? 'rgba(255,255,255,0.7)' : B.faint, fontWeight: 500,
        }}>{count}</span>
      )}
    </button>
  );
}

function RailSection({ title, sub, children }) {
  return (
    <section style={{
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
      padding: '18px 20px',
    }}>
      <h3 className="serif" style={{
        margin: 0, fontSize: 14, fontWeight: 600,
        color: B.text, letterSpacing: '-0.01em',
      }}>{title}</h3>
      {sub && (
        <div style={{ color: B.faint, fontSize: 11, fontStyle: 'italic', marginTop: 4 }}>
          {sub}
        </div>
      )}
      <div style={{ marginTop: 12 }}>{children}</div>
    </section>
  );
}

function EmptyState({ category, tag, search }) {
  let msg = 'No articles match.';
  if (search)    msg = `No articles match "${search}".`;
  else if (tag)  msg = `No articles tagged "${tag}".`;
  else if (category) msg = `No articles in ${category} yet.`;
  return (
    <div style={{
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
      padding: 36, textAlign: 'center',
    }}>
      <div className="serif" style={{
        color: B.text, fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em',
      }}>{msg}</div>
      <div style={{ color: B.dim, fontSize: 13, marginTop: 6 }}>
        Try a different filter, or check back as new stories come in.
      </div>
    </div>
  );
}
