// Smith — Saved news page
// Lists everything the user has bookmarked, most-recent first.

import React, { useEffect, useState } from 'react';
import { B } from '../lib/theme.js';
import { TopNav } from '../components/TopNav.jsx';
import { NewsCard } from '../components/NewsCard.jsx';
import { Icon } from '../components/Icon.jsx';
import { api } from '../lib/api.js';
import { useRouter } from '../lib/router.jsx';

export function NewsSavedPage() {
  const { navigate } = useRouter();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get('/news/saved');
      setArticles(data.articles);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div style={{ background: B.bg, minHeight: '100vh' }}>
      <TopNav active="news"/>
      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 40px' }}>
        <button onClick={() => navigate('/news')} style={{
          background: 'transparent', border: 'none', color: B.dim,
          fontSize: 13, fontWeight: 500, padding: 0, marginBottom: 16,
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <Icon name="chevron-l" size={14}/> Back to news
        </button>

        <h1 className="serif" style={{
          color: B.text, fontSize: 36, fontWeight: 600, margin: 0,
          letterSpacing: '-0.02em',
        }}>Saved for later</h1>
        <p style={{ color: B.dim, fontSize: 14, marginTop: 6 }}>
          Articles you bookmarked, newest first.
        </p>

        {loading && (
          <div style={{
            color: B.faint, fontStyle: 'italic', padding: 36, textAlign: 'center',
          }}>Loading…</div>
        )}

        {!loading && articles.length === 0 && (
          <div style={{
            background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
            padding: 40, textAlign: 'center', marginTop: 24,
          }}>
            <div className="serif" style={{
              color: B.text, fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em',
            }}>Nothing saved yet.</div>
            <div style={{ color: B.dim, fontSize: 13, marginTop: 6 }}>
              Click the bookmark on any article to save it here for later.
            </div>
            <button onClick={() => navigate('/news')} style={{
              marginTop: 16, background: B.text, border: 'none', color: B.surface,
              padding: '10px 22px', borderRadius: 100,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>Browse the news</button>
          </div>
        )}

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 14, marginTop: 24,
        }}>
          {articles.map(a => (
            <NewsCard
              key={a.id}
              article={a}
              onTagClick={t => navigate(`/news?tag=${encodeURIComponent(t)}`)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
