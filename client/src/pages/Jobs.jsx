// Smith — Jobs feed page
//
// Ranked job listings powered by /api/jobs (the matching algorithm scores
// every job against the signed-in user's trades, skills, and location).
// Filter chips toggle saved / prevailing wage / direct-contact-only. Cards
// can be saved or dismissed inline. "View source ↗" opens the original
// posting in a new tab — until phase 4 adds "Apply with Smith."

import React, { useEffect, useState, useCallback } from 'react';
import { B } from '../lib/theme.js';
import { TopNav } from '../components/TopNav.jsx';
import { Icon } from '../components/Icon.jsx';
import { ApplyModal } from '../components/ApplyModal.jsx';
import { api } from '../lib/api.js';

const FILTERS = [
  { k: 'all',         label: 'All' },
  { k: 'saved',       label: 'Saved' },
  { k: 'direct',      label: 'Direct contact' },
  { k: 'prevailing',  label: 'Prevailing wage' },
];

export function JobsPage() {
  const [filter, setFilter] = useState('all');
  const [data, setData] = useState({ jobs: [], total: 0, limit: 25, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [applyingTo, setApplyingTo] = useState(null);   // job object — opens ApplyModal

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', '40');
      if (filter === 'saved')      params.set('saved', '1');
      if (filter === 'direct')     params.set('has_direct_contact', '1');
      if (filter === 'prevailing') params.set('prevailing_wage', '1');
      const d = await api.get(`/jobs?${params.toString()}`);
      setData(d);
    } catch (e) {
      setError(e.data?.error || e.message || 'Could not load jobs');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  // Optimistic toggle then reload — keeps the click feeling instant.
  const toggleSave = async (job) => {
    setData(d => ({ ...d, jobs: d.jobs.map(j => j.id === job.id ? { ...j, saved: !j.saved } : j) }));
    try {
      if (job.saved) await api.delete(`/jobs/${job.id}/save`);
      else           await api.post(`/jobs/${job.id}/save`);
    } catch {
      // revert + reload to reconcile
      load();
    }
  };

  const dismissJob = async (job) => {
    setData(d => ({ ...d, jobs: d.jobs.filter(j => j.id !== job.id) }));
    try {
      await api.post(`/jobs/${job.id}/dismiss`);
    } catch {
      load();
    }
  };

  return (
    <div style={{ background: B.bg, minHeight: '100vh' }}>
      <TopNav active="jobs"/>
      <main style={{ maxWidth: 920, margin: '0 auto', padding: '32px 40px' }}>
        <div style={{ marginBottom: 8 }}>
          <h1 className="serif" style={{
            color: B.text, fontSize: 32, fontWeight: 600, margin: 0,
            letterSpacing: '-0.02em',
          }}>Jobs</h1>
          <p style={{ color: B.dim, fontSize: 14, marginTop: 4 }}>
            Ranked for your trade, location, and credentials.
          </p>
        </div>

        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap',
          margin: '18px 0 20px', borderBottom: `1px solid ${B.line}`, paddingBottom: 14,
        }}>
          {FILTERS.map(f => (
            <button key={f.k} onClick={() => setFilter(f.k)} style={{
              background: filter === f.k ? B.text : 'transparent',
              color: filter === f.k ? B.surface : B.text,
              border: `1px solid ${filter === f.k ? B.text : B.line}`,
              padding: '7px 14px', borderRadius: 100,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>{f.label}</button>
          ))}
        </div>

        {error && (
          <div style={{
            background: B.surface, border: `1px solid ${B.danger}`, borderRadius: 4,
            padding: '16px 20px', color: B.danger, marginBottom: 16,
          }}>{error}</div>
        )}

        {loading && <Skeleton/>}

        {!loading && !error && data.jobs.length === 0 && (
          <EmptyState filter={filter}/>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.jobs.map(j => (
            <JobCard key={j.id} job={j}
                     onToggleSave={() => toggleSave(j)}
                     onDismiss={() => dismissJob(j)}
                     onApply={() => setApplyingTo(j)}/>
          ))}
        </div>

        {applyingTo && (
          <ApplyModal
            job={applyingTo}
            onClose={() => setApplyingTo(null)}
            onApplied={() => load()}
          />
        )}
      </main>
    </div>
  );
}

function JobCard({ job, onToggleSave, onDismiss, onApply }) {
  return (
    <article style={{
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
      padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="serif" style={{
            color: B.text, fontWeight: 600, fontSize: 18, letterSpacing: '-0.01em',
            marginBottom: 4,
          }}>{job.title}</div>
          <div style={{ color: B.dim, fontSize: 13 }}>
            {job.company || 'Unknown company'}
            {job.location ? ` · ${job.location}` : ''}
            {' · '}
            <RelativeTime ts={job.posted_at}/>
          </div>
        </div>
        <Badges job={job}/>
      </div>

      {(job.salary_min || job.salary_max) && (
        <div style={{ color: B.text, fontSize: 14, fontWeight: 500 }}>
          {formatSalary(job)}
          {job.salary_is_predicted ? (
            <span style={{ color: B.faint, fontStyle: 'italic', marginLeft: 6, fontWeight: 400, fontSize: 12 }}>
              estimated
            </span>
          ) : null}
        </div>
      )}

      {(job.trade_tags?.length > 0 || job.skill_tags?.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(job.trade_tags || []).map(t => (
            <Chip key={'t-' + t} text={t} variant="trade"/>
          ))}
          {(job.skill_tags || []).slice(0, 4).map(s => (
            <Chip key={'s-' + s} text={s} variant="skill"/>
          ))}
        </div>
      )}

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 10, marginTop: 4,
      }}>
        <div style={{ color: B.faint, fontSize: 11, fontStyle: 'italic' }}>
          Match score {job.score} · via {job.source_driver}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onToggleSave} title={job.saved ? 'Saved' : 'Save'} style={{
            background: job.saved ? B.text : 'transparent', color: job.saved ? B.surface : B.text,
            border: `1px solid ${job.saved ? B.text : B.line}`,
            padding: '7px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>{job.saved ? 'Saved' : 'Save'}</button>
          <button onClick={onDismiss} title="Dismiss" style={{
            background: 'transparent', color: B.dim, border: `1px solid ${B.line}`,
            padding: '7px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>Dismiss</button>
          {job.applied ? (
            <span title={`Applied ${job.applied_at ? new Date(job.applied_at).toLocaleDateString() : ''}`} style={{
              background: B.surface2, color: B.text, border: `1px solid ${B.line}`,
              padding: '7px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>✓ Applied</span>
          ) : (
            <button onClick={onApply} style={{
              background: B.accent, color: B.surface, border: 'none',
              padding: '7px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}>Apply with Smith</button>
          )}
        </div>
      </div>
    </article>
  );
}

function Badges({ job }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
      {job.has_direct_contact && (
        <span title="Direct contact available — email or phone in the posting" style={{
          background: B.accentSoft, color: B.accent, fontSize: 11, fontWeight: 600,
          padding: '3px 8px', borderRadius: 4, letterSpacing: '0.02em',
        }}>Direct contact</span>
      )}
      {job.is_prevailing_wage && (
        <span title="Prevailing wage / Davis-Bacon public-works job" style={{
          background: '#dde7d8', color: '#3d5a31', fontSize: 11, fontWeight: 600,
          padding: '3px 8px', borderRadius: 4, letterSpacing: '0.02em',
        }}>Prevailing wage</span>
      )}
    </div>
  );
}

function Chip({ text, variant }) {
  return (
    <span style={{
      background: variant === 'trade' ? B.surface2 : B.bg,
      color: variant === 'trade' ? B.text : B.dim,
      border: `1px solid ${B.line}`,
      fontSize: 11, fontWeight: 500,
      padding: '3px 9px', borderRadius: 100,
    }}>{text}</span>
  );
}

function EmptyState({ filter }) {
  const map = {
    all:        ['No jobs yet.', 'Once the ingester pulls fresh listings, ranked jobs for your trade will show up here.'],
    saved:      ['No saved jobs.', 'Tap "Save" on a job to bookmark it for later.'],
    direct:     ['No direct-contact jobs right now.', 'These show up when a posting publishes an employer email or phone.'],
    prevailing: ['No prevailing-wage jobs right now.', 'These are Davis-Bacon / public-works postings.'],
  };
  const [title, body] = map[filter] || map.all;
  return (
    <div style={{
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
      padding: '40px 32px', textAlign: 'center',
    }}>
      <div style={{ marginBottom: 10, color: B.faint }}>
        <Icon name="briefcase" size={36}/>
      </div>
      <div className="serif" style={{ color: B.text, fontSize: 18, fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <div style={{ color: B.dim, fontSize: 13, maxWidth: 460, margin: '0 auto' }}>{body}</div>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[140, 160, 130].map((h, i) => (
        <div key={i} style={{
          height: h, background: B.surface, border: `1px solid ${B.line}`,
          borderRadius: 4, opacity: 0.6,
        }}/>
      ))}
    </div>
  );
}

function RelativeTime({ ts }) {
  if (!ts) return <span>recently</span>;
  const ms = Date.now() - new Date(ts).getTime();
  const day = 86400000;
  if (ms < 2 * day)  return <span>posted today</span>;
  if (ms < 8 * day)  return <span>{Math.round(ms / day)}d ago</span>;
  if (ms < 60 * day) return <span>{Math.round(ms / (7 * day))}w ago</span>;
  return <span>{Math.round(ms / (30 * day))}mo ago</span>;
}

function formatSalary(j) {
  const fmt = (n) => '$' + Math.round(n).toLocaleString();
  const min = j.salary_min, max = j.salary_max;
  const period = j.salary_period === 'hour' ? '/hr' : (j.salary_period === 'year' ? '/yr' : '');
  if (min && max && min !== max) return `${fmt(min)}–${fmt(max)}${period}`;
  return `${fmt(max || min)}${period}`;
}
