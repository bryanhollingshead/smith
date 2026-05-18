// Smith — Admin: news queue
//
// Two sections:
//   1. Feeds — table of every RSS source, with enable/disable + status + last
//      ingestion result. A "Run ingestion now" button kicks off /admin/news/ingest.
//   2. Recent articles — table of the last ~80 articles, with Featured /
//      Hidden toggles, click to view source.
//
// Gated by the server's requireAdmin middleware; if a non-admin lands here
// they'll just see API 403s. We also hide the entry point on /news for them.

import React, { useEffect, useState } from 'react';
import { B } from '../lib/theme.js';
import { TopNav } from '../components/TopNav.jsx';
import { Icon } from '../components/Icon.jsx';
import { api } from '../lib/api.js';
import { useRouter } from '../lib/router.jsx';

export function AdminNewsPage() {
  const { navigate } = useRouter();
  const [feeds, setFeeds] = useState([]);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ingestStatus, setIngestStatus] = useState(null);
  const [accessError, setAccessError] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [f, a] = await Promise.all([
        api.get('/admin/news/feeds'),
        // We want articles INCLUDING hidden ones for the admin queue.
        // /api/news filters hidden; we'll fetch unfiltered via the same query
        // but for v1 admin just sees the public ones (still toggle-able).
        api.get('/news?limit=60'),
      ]);
      setFeeds(f.feeds);
      setArticles(a.articles);
    } catch (e) {
      if (e.status === 403) setAccessError('You need admin access to view this page.');
      else setAccessError(e.data?.error || 'Could not load.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const runIngest = async () => {
    setIngestStatus('running');
    try {
      const data = await api.post('/admin/news/ingest');
      setIngestStatus(`done · ${data.summary.length} feeds processed`);
      load();
    } catch (e) {
      setIngestStatus(`error · ${e.data?.error || e.message}`);
    }
  };

  const toggleFeed = async (feed, enabled) => {
    // Optimistic.
    setFeeds(fs => fs.map(f => f.id === feed.id ? { ...f, enabled } : f));
    try { await api.patch(`/admin/news/feeds/${feed.id}`, { enabled }); }
    catch { setFeeds(fs => fs.map(f => f.id === feed.id ? { ...f, enabled: !enabled } : f)); }
  };

  const toggleArticle = async (article, field, value) => {
    setArticles(as => as.map(a => a.id === article.id ? { ...a, [field]: value } : a));
    try {
      await api.patch(`/admin/news/${article.id}`, { [field]: value });
      // For "hidden", remove from the visible list after a beat so the admin
      // sees the action took effect.
      if (field === 'hidden' && value) {
        setTimeout(() => setArticles(as => as.filter(a => a.id !== article.id)), 600);
      }
    } catch {
      setArticles(as => as.map(a => a.id === article.id ? { ...a, [field]: !value } : a));
    }
  };

  if (accessError) {
    return (
      <div style={{ background: B.bg, minHeight: '100vh' }}>
        <TopNav/>
        <main style={{ maxWidth: 720, margin: '0 auto', padding: '60px 40px' }}>
          <div style={{
            background: B.surface, border: `1px solid ${B.danger}`, borderRadius: 4,
            padding: 32, textAlign: 'center',
          }}>
            <h2 className="serif" style={{
              margin: 0, fontSize: 22, fontWeight: 600,
              color: B.text, letterSpacing: '-0.02em',
            }}>Access denied</h2>
            <p style={{ color: B.dim, fontSize: 14, marginTop: 8 }}>{accessError}</p>
            <button onClick={() => navigate('/feed')} style={{
              marginTop: 16, background: B.text, border: 'none', color: B.surface,
              padding: '10px 22px', borderRadius: 100,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>Back to feed</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ background: B.bg, minHeight: '100vh' }}>
      <TopNav/>
      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 40px' }}>
        <button onClick={() => navigate('/news')} style={{
          background: 'transparent', border: 'none', color: B.dim,
          fontSize: 13, fontWeight: 500, padding: 0, marginBottom: 16,
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <Icon name="chevron-l" size={14}/> Back to news
        </button>

        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          marginBottom: 24, flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <h1 className="serif" style={{
              color: B.text, fontSize: 36, fontWeight: 600, margin: 0,
              letterSpacing: '-0.025em',
            }}>News queue</h1>
            <p style={{ color: B.dim, fontSize: 14, marginTop: 6 }}>
              Manage feeds and curate what shows up across Smith.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {ingestStatus && (
              <span style={{ color: B.dim, fontSize: 12, fontStyle: 'italic' }}>
                {ingestStatus}
              </span>
            )}
            <button onClick={runIngest} disabled={ingestStatus === 'running'} style={{
              background: B.accent, border: 'none', color: '#fff',
              padding: '10px 18px', borderRadius: 100,
              fontSize: 13, fontWeight: 600,
              cursor: ingestStatus === 'running' ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              <Icon name="arrow-r" size={13} stroke={2.4}/>
              {ingestStatus === 'running' ? 'Running…' : 'Run ingestion'}
            </button>
          </div>
        </div>

        {loading && (
          <div style={{ color: B.faint, fontStyle: 'italic', padding: 24, textAlign: 'center' }}>
            Loading…
          </div>
        )}

        {/* Feeds section */}
        <section style={{
          background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
          padding: '20px 24px', marginBottom: 18,
        }}>
          <h2 className="serif" style={{
            margin: '0 0 14px', fontSize: 18, fontWeight: 600,
            color: B.text, letterSpacing: '-0.01em',
          }}>RSS feeds <span style={{ color: B.faint, fontSize: 12, fontWeight: 400, fontStyle: 'italic' }}>· {feeds.length} total</span></h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <FeedHeader/>
            {feeds.map(f => (
              <FeedRow key={f.id} feed={f} onToggle={enabled => toggleFeed(f, enabled)}/>
            ))}
          </div>
        </section>

        {/* Articles section */}
        <section style={{
          background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
          padding: '20px 24px',
        }}>
          <h2 className="serif" style={{
            margin: '0 0 14px', fontSize: 18, fontWeight: 600,
            color: B.text, letterSpacing: '-0.01em',
          }}>Recent articles <span style={{ color: B.faint, fontSize: 12, fontWeight: 400, fontStyle: 'italic' }}>· toggle Featured / Hidden</span></h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {articles.map(a => (
              <ArticleRow
                key={a.id}
                article={a}
                onToggleFeatured={v => toggleArticle(a, 'featured', v)}
                onToggleHidden={v => toggleArticle(a, 'hidden', v)}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function FeedHeader() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '20px 2fr 1fr 1fr 1fr 90px',
      gap: 10, padding: '6px 12px',
      color: B.faint, fontSize: 11, fontStyle: 'italic',
      letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>
      <div></div>
      <div>Feed</div>
      <div>Category</div>
      <div>Last run</div>
      <div>Result</div>
      <div style={{ textAlign: 'right' }}>Enabled</div>
    </div>
  );
}

function FeedRow({ feed, onToggle }) {
  const statusColor = feed.last_status === 'ok'
    ? B.accent
    : (feed.last_status ? B.danger : B.faint);
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '20px 2fr 1fr 1fr 1fr 90px',
      gap: 10, padding: '10px 12px',
      background: feed.enabled ? B.bg : B.surface2,
      border: `1px solid ${B.line}`, borderRadius: 4,
      alignItems: 'center', fontSize: 13,
      opacity: feed.enabled ? 1 : 0.6,
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: feed.enabled ? statusColor : B.faint,
      }}/>
      <div>
        <div className="serif" style={{
          color: B.text, fontWeight: 600, fontSize: 13.5, letterSpacing: '-0.01em',
        }}>{feed.name}</div>
        <div style={{ color: B.faint, fontSize: 10.5, marginTop: 2 }}>
          <a href={feed.url} target="_blank" rel="noopener noreferrer"
             style={{ color: 'inherit', textDecoration: 'none' }}>
            {feed.url}
          </a>
        </div>
      </div>
      <div style={{ color: B.text, fontSize: 12 }}>{feed.category}</div>
      <div style={{ color: B.dim, fontSize: 11 }}>
        {feed.last_ingested_at ? new Date(feed.last_ingested_at).toLocaleString() : '—'}
      </div>
      <div style={{ color: feed.last_status === 'ok' ? B.dim : B.danger, fontSize: 11 }}>
        {feed.last_status
          ? (feed.last_status === 'ok' ? `+${feed.last_count} new` : feed.last_status.slice(0, 40))
          : '—'}
      </div>
      <div style={{ textAlign: 'right' }}>
        <ToggleSwitch on={feed.enabled} onChange={onToggle}/>
      </div>
    </div>
  );
}

function ArticleRow({ article, onToggleFeatured, onToggleHidden }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '3fr 1fr 1fr 90px 90px',
      gap: 12, padding: '10px 14px',
      background: B.bg, border: `1px solid ${B.line}`, borderRadius: 4,
      alignItems: 'center', fontSize: 13,
    }}>
      <div style={{ minWidth: 0 }}>
        <div className="serif" style={{
          color: B.text, fontWeight: 600, fontSize: 13.5, letterSpacing: '-0.01em',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          <a href={article.source_url} target="_blank" rel="noopener noreferrer"
             style={{ color: 'inherit', textDecoration: 'none' }}>
            {article.title}
          </a>
        </div>
        <div style={{ color: B.faint, fontSize: 11, marginTop: 2 }}>
          {article.source} · {new Date(article.published_at).toLocaleDateString()}
        </div>
      </div>
      <div style={{ color: B.text, fontSize: 12 }}>{article.category}</div>
      <div style={{
        display: 'flex', gap: 4, flexWrap: 'wrap', minWidth: 0,
      }}>
        {(article.tags || []).slice(0, 2).map(t => (
          <span key={t} style={{
            padding: '2px 7px', background: B.surface, border: `1px solid ${B.line}`,
            borderRadius: 100, fontSize: 10, color: B.dim,
          }}>{t}</span>
        ))}
      </div>
      <div style={{ textAlign: 'right' }}>
        <ToggleSwitch
          on={!!article.featured}
          onChange={onToggleFeatured}
          label="Feat."
        />
      </div>
      <div style={{ textAlign: 'right' }}>
        <ToggleSwitch
          on={!!article.hidden}
          onChange={onToggleHidden}
          label="Hide"
          danger
        />
      </div>
    </div>
  );
}

function ToggleSwitch({ on, onChange, label, danger }) {
  return (
    <button onClick={() => onChange(!on)} style={{
      background: 'transparent', border: 'none', padding: 0,
      display: 'inline-flex', alignItems: 'center', gap: 6,
      cursor: 'pointer',
    }}>
      <span style={{
        width: 28, height: 16, borderRadius: 100,
        background: on ? (danger ? B.danger : B.accent) : B.surface2,
        position: 'relative', transition: 'background 120ms ease',
        border: `1px solid ${on ? (danger ? B.danger : B.accent) : B.line}`,
      }}>
        <span style={{
          position: 'absolute', top: 1, left: on ? 13 : 1,
          width: 12, height: 12, borderRadius: '50%', background: '#fff',
          transition: 'left 120ms ease',
        }}/>
      </span>
      {label && <span style={{ color: B.dim, fontSize: 11, fontWeight: 500 }}>{label}</span>}
    </button>
  );
}
