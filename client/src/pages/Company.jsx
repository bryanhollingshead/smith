// Smith — Company profile page
//
// Public read-view (no auth required) with inline edit affordances for the
// steward. Sections: cover band + hero, stats strip, trades & skills, about,
// signature work, crew, recent work. The page accepts either a numeric id or
// a slug; the server resolves either.
//
// Design philosophy (per the brand voice memory): mythopoetic through
// attention. The page reads quiet but precise — careful spacing, honest data,
// no marketing fluff. Reverence shows up in what we choose to dignify (the
// crew, the work, the trades), not in vocabulary.

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { B } from '../lib/theme.js';
import { TopNav } from '../components/TopNav.jsx';
import { Icon } from '../components/Icon.jsx';
import { Photo, SmithLogo } from '../components/Primitives.jsx';
import { SmithAvatar } from '../components/SmithAvatar.jsx';
import { api } from '../lib/api.js';
import { useRouter } from '../lib/router.jsx';
import { useAuth } from '../lib/AuthContext.jsx';

export function CompanyPage({ companyIdOrSlug }) {
  const { navigate } = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await api.get(`/companies/${encodeURIComponent(companyIdOrSlug)}/profile`);
      setData(d);
    } catch (e) {
      setError(e.data?.error || 'Could not load this company.');
    } finally {
      setLoading(false);
    }
  }, [companyIdOrSlug]);

  useEffect(() => { load(); }, [load]);

  // Update the tab title once the company name lands. SSR meta injection
  // covers cold loads and crawlers; this covers in-session SPA navigation.
  useEffect(() => {
    if (!data?.company?.name) return;
    const prev = document.title;
    const type = data.company.type ? ` — ${data.company.type}` : '';
    document.title = `${data.company.name}${type} · Smith`;
    return () => { document.title = prev; };
  }, [data?.company?.name, data?.company?.type]);

  return (
    <div style={{ background: B.bg, minHeight: '100vh' }}>
      {user
        ? <TopNav/>
        : <PublicChrome navigate={navigate}/>}
      {loading && (
        <main style={pageMain}>
          <Skeleton/>
        </main>
      )}
      {error && (
        <main style={pageMain}>
          <div style={{
            background: B.surface, border: `1px solid ${B.danger}`, borderRadius: 4,
            padding: 24, color: B.danger,
          }}>{error}</div>
        </main>
      )}
      {data && <CompanyBody data={data} onChanged={load} navigate={navigate}/>}
    </div>
  );
}

function CompanyBody({ data, onChanged, navigate }) {
  const { company, steward, is_steward, is_owner, owners = [], crew, trades, skills, signature_jobsite, recent_work } = data;
  const [editing, setEditing] = useState(false);

  // Edit rights belong to current owners. Legacy stewards are honored as
  // a fallback until the steward concept is retired — the server PATCH
  // gate has the matching rule.
  const canEdit = is_owner || is_steward;

  const stats = {
    crew: crew.length,
    jobsites: (signature_jobsite ? 1 : 0) + recent_work.length,
    trades: trades.length,
  };

  return (
    <>
      <CoverBand
        company={company}
        editing={editing && canEdit}
        onChanged={onChanged}
      />
      <main style={pageMain}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Hero
            company={company}
            steward={steward}
            isSteward={canEdit}
            editing={editing}
            stats={stats}
            navigate={navigate}
            onEdit={() => setEditing(true)}
            onCancel={() => setEditing(false)}
            onSaved={() => { setEditing(false); onChanged?.(); }}
            trades={trades}
            skills={skills}
          />

          {!editing && (trades.length > 0 || skills.length > 0) && (
            <TradesSkillsBlock trades={trades} skills={skills}/>
          )}

          {!editing && company.about && (
            <Section title="About">
              <p style={prose}>{company.about}</p>
            </Section>
          )}

          <SignatureBlock
            signature={signature_jobsite}
            editing={editing && canEdit}
            companyId={company.id}
            onChanged={onChanged}
          />

          {owners.length > 0 && (
            <OwnersSection owners={owners} navigate={navigate}/>
          )}

          <CrewSection crew={crew} navigate={navigate}/>

          <Section
            title="Recent work"
            subtitle="Jobsites the crew has logged at this company."
          >
            {recent_work.length === 0 && (
              <p style={{ color: B.faint, fontStyle: 'italic', margin: 0 }}>No jobsites logged yet.</p>
            )}
            <WorkGrid
              items={recent_work}
              companyName={company.name}
              editing={editing && canEdit}
              companyId={company.id}
              currentSignatureId={signature_jobsite?.id}
              onChanged={onChanged}
            />
          </Section>
        </div>
      </main>
    </>
  );
}

// ── Cover band ────────────────────────────────────────────────────────
function CoverBand({ company, editing, onChanged }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const coverUrl = company.cover_urls?.full || company.cover_urls?.medium;

  const upload = async (file) => {
    setUploading(true);
    try {
      await api.upload(`/photos/company/${company.id}/cover`, (() => {
        const fd = new FormData(); fd.append('file', file); return fd;
      })());
      onChanged?.();
    } catch (e) {
      window.alert(e.data?.error || 'Cover upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{
      position: 'relative',
      height: 280,
      background: coverUrl
        ? `center/cover url("${coverUrl}") no-repeat`
        : `linear-gradient(135deg, ${B.accentSoft} 0%, ${B.bg} 65%, ${B.surface} 100%)`,
      marginBottom: -110,
    }}>
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: 130,
        background: `linear-gradient(to bottom, transparent 0%, ${B.bg} 100%)`,
      }}/>
      {editing && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{
              position: 'absolute', top: 18, right: 18, zIndex: 2,
              background: 'rgba(255,255,255,0.92)', color: B.text,
              border: `1px solid ${B.line}`, borderRadius: 100,
              padding: '8px 14px', fontSize: 12, fontWeight: 600,
              cursor: uploading ? 'wait' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
            }}>
            <Icon name="image" size={13}/>
            {uploading ? 'Uploading…' : (coverUrl ? 'Change cover' : 'Add cover')}
          </button>
        </>
      )}
    </div>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────
function Hero({
  company, steward, isSteward, editing, stats, navigate,
  onEdit, onCancel, onSaved, trades, skills,
}) {
  if (editing) return <HeroEdit company={company} trades={trades} skills={skills} onCancel={onCancel} onSaved={onSaved}/>;

  const logoUrl = company.logo_urls?.medium || company.logo_urls?.thumb || company.logo_urls?.full;

  return (
    <section style={heroCard}>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <div style={{ ...logoFrame(logoUrl), marginTop: -8 }}>
          {!logoUrl && <Icon name="building" size={36} stroke={1.3}/>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <h1 className="serif" style={heroName}>{company.name}</h1>
            {steward && (
              <span style={stewardTag}>Claimed</span>
            )}
          </div>
          {company.type && (
            <div style={{ color: B.dim, fontSize: 14, marginTop: 4 }}>{company.type}</div>
          )}
          {company.tagline && (
            <p className="serif" style={{
              margin: '16px 0 0', color: B.text, fontSize: 17, lineHeight: 1.55,
              fontStyle: 'italic', letterSpacing: '-0.005em',
            }}>{company.tagline}</p>
          )}
          <MetaStrip company={company} steward={steward} navigate={navigate}/>
        </div>
        {isSteward && (
          <button onClick={onEdit} style={editBtn}>
            <Icon name="edit" size={14}/> Edit profile
          </button>
        )}
      </div>

      <StatsStrip stats={stats}/>
    </section>
  );
}

function MetaStrip({ company, steward, navigate }) {
  const items = [];
  if (company.founded_year) {
    items.push({
      icon: 'award',
      label: `Since ${company.founded_year}`,
    });
  }
  if (company.primary_location) {
    items.push({
      icon: 'building',
      label: company.primary_location,
    });
  }
  if (steward) {
    items.push({
      icon: null,
      avatar: { urls: steward.avatar_urls, tone: steward.avatar_tone, initials: (steward.name?.[0] || 'S').toUpperCase() },
      label: `Stewarded by ${steward.name}`,
      onClick: steward.public_slug ? () => navigate(`/profile/${steward.public_slug}`) : null,
    });
  }
  if (!items.length) return null;

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 16,
      color: B.dim, fontSize: 13,
    }}>
      {items.map((it, i) => {
        const inner = (
          <>
            {it.avatar && (
              <SmithAvatar
                urls={it.avatar.urls}
                initials={it.avatar.initials}
                size={20}
                tone={it.avatar.tone || 'wood'}
              />
            )}
            {it.icon && <Icon name={it.icon} size={14} style={{ color: B.accent }}/>}
            <span>{it.label}</span>
          </>
        );
        const baseStyle = {
          display: 'inline-flex', alignItems: 'center', gap: 6,
        };
        return it.onClick ? (
          <button key={i} onClick={it.onClick} style={{
            ...baseStyle,
            background: 'transparent', border: 'none', padding: 0,
            color: B.dim, fontSize: 13, cursor: 'pointer',
          }}>{inner}</button>
        ) : (
          <span key={i} style={baseStyle}>{inner}</span>
        );
      })}
    </div>
  );
}

function StatsStrip({ stats }) {
  const items = [
    { label: 'Crew',     value: stats.crew },
    { label: 'Jobsites', value: stats.jobsites },
    { label: 'Trades',   value: stats.trades },
  ].filter(x => x.value > 0);
  if (items.length === 0) return null;

  return (
    <div style={{
      display: 'flex', gap: 32, marginTop: 24, paddingTop: 20,
      borderTop: `1px solid ${B.line}`,
    }}>
      {items.map(s => (
        <div key={s.label}>
          <div className="serif" style={{
            color: B.text, fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em',
          }}>{s.value}</div>
          <div style={{
            color: B.faint, fontSize: 11, marginTop: 2, fontStyle: 'italic',
          }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function HeroEdit({ company, trades: initialTrades, skills: initialSkills, onCancel, onSaved }) {
  const [name, setName] = useState(company.name || '');
  const [type, setType] = useState(company.type || '');
  const [tagline, setTagline] = useState(company.tagline || '');
  const [foundedYear, setFoundedYear] = useState(company.founded_year || '');
  const [location, setLocation] = useState(company.primary_location || '');
  const [about, setAbout] = useState(company.about || '');
  const [logoUrl, setLogoUrl] = useState(
    company.logo_urls?.medium || company.logo_urls?.thumb || company.logo_urls?.full || null
  );
  const [tradeIds, setTradeIds] = useState(() => new Set(initialTrades.map(t => t.id)));
  const [skills, setSkills] = useState(initialSkills.map(s => s.name));
  const [skillInput, setSkillInput] = useState('');
  const [tradesCatalog, setTradesCatalog] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    api.get('/trades').then(d => setTradesCatalog(d.trades || [])).catch(() => {});
  }, []);

  const uploadLogo = async (file) => {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await api.upload(`/photos/company/${company.id}/logo`, fd);
      setLogoUrl(data.logo?.urls?.medium || data.logo?.urls?.full || data.logo?.urls?.thumb || null);
    } catch (e) {
      setError(e.data?.error || 'Logo upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const toggleTrade = (id) => {
    setTradeIds(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else if (next.size < 8) next.add(id);
      return next;
    });
  };

  const addSkill = () => {
    const s = skillInput.trim();
    if (!s) return;
    if (!skills.includes(s) && skills.length < 12) setSkills(arr => [...arr, s]);
    setSkillInput('');
  };

  const save = async () => {
    if (!name.trim() || busy || uploading) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/companies/${company.id}`, {
        name: name.trim(),
        type: type.trim() || null,
        tagline: tagline.trim() || null,
        founded_year: foundedYear === '' ? null : foundedYear,
        primary_location: location.trim() || null,
        about: about.trim() || null,
        trades: [...tradeIds].map(id => ({ id })),
        skills: skills.map(name => ({ name })),
      });
      onSaved?.();
    } catch (e) {
      setError(e.data?.error || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={heroCard}>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="Upload logo"
          style={{
            ...logoFrame(logoUrl),
            marginTop: -8,
            cursor: uploading ? 'wait' : 'pointer',
            position: 'relative',
            border: `2px dashed ${B.accent}`,
          }}
        >
          {!logoUrl && <Icon name="image" size={28} style={{ color: B.accent }}/>}
          {uploading && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, color: B.dim,
            }}>Uploading…</div>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ''; }}
          style={{ display: 'none' }}
        />
        <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 10 }}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Company name"
            style={{ ...inp, fontSize: 22, fontWeight: 600 }}
            className="serif"
          />
          <input
            value={type}
            onChange={e => setType(e.target.value)}
            placeholder="e.g. General Contractor · Sub · Carpentry"
            style={inp}
          />
          <textarea
            value={tagline}
            onChange={e => setTagline(e.target.value)}
            placeholder="One sentence — what do you build?"
            rows={2}
            maxLength={280}
            style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10 }}>
            <input
              value={foundedYear}
              onChange={e => setFoundedYear(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Founded (year)"
              maxLength={4}
              style={inp}
            />
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Primary location"
              style={inp}
            />
          </div>
          <textarea
            value={about}
            onChange={e => setAbout(e.target.value)}
            placeholder="About — longer-form description (optional)"
            rows={5}
            style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>
      </div>

      {/* Trades picker */}
      <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${B.line}` }}>
        <div style={editLabel}>
          Trades <span style={muted}>· pick up to 8 from the catalog</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {tradesCatalog.map(t => {
            const on = tradeIds.has(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTrade(t.id)}
                style={{
                  padding: '6px 12px', borderRadius: 100,
                  background: on ? B.accent : B.bg,
                  color: on ? B.surface : B.text,
                  border: `1px solid ${on ? B.accent : B.line}`,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>
                {t.name}
              </button>
            );
          })}
          {!tradesCatalog.length && (
            <div style={muted}>Loading catalog…</div>
          )}
        </div>
      </div>

      {/* Skills tags */}
      <div style={{ marginTop: 18 }}>
        <div style={editLabel}>
          Specialties <span style={muted}>· free-text descriptors (e.g. "historic restoration")</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {skills.map(s => (
            <span key={s} style={{
              padding: '4px 10px', background: B.accentSoft, color: B.accent,
              fontSize: 12, fontWeight: 600, borderRadius: 100,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              {s}
              <button onClick={() => setSkills(arr => arr.filter(x => x !== s))} style={{
                background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                color: B.accent, display: 'inline-flex',
              }}><Icon name="x" size={11}/></button>
            </span>
          ))}
          <input
            value={skillInput}
            onChange={e => setSkillInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
            placeholder={skills.length === 0 ? 'Add a specialty — press enter' : 'Add another…'}
            style={{
              ...inp, flex: 1, minWidth: 180,
              padding: '5px 10px', fontSize: 12,
            }}
          />
        </div>
      </div>

      {error && (
        <div style={{
          marginTop: 14, color: B.danger, fontSize: 13,
          background: B.bg, border: `1px solid ${B.danger}`, borderRadius: 4,
          padding: '10px 14px',
        }}>{error}</div>
      )}

      <div style={{
        marginTop: 18, paddingTop: 18, borderTop: `1px solid ${B.line}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 12, flexWrap: 'wrap',
      }}>
        <span style={muted}>
          Pin a signature project below by clicking a work card.
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} disabled={busy} style={ghostBtn}>Cancel</button>
          <button onClick={save} disabled={busy || !name.trim() || uploading} style={primaryBtn(!busy && name.trim() && !uploading)}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Trades & skills ───────────────────────────────────────────────────
function TradesSkillsBlock({ trades, skills }) {
  return (
    <Section title="Trades & specialties" subtitle="What this shop builds, and what it's known for.">
      {trades.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {trades.map(t => (
            <span key={t.id} style={{
              padding: '6px 12px', background: B.text, color: B.surface,
              fontSize: 12, fontWeight: 600, borderRadius: 100,
              letterSpacing: '0.01em',
            }}>{t.name}</span>
          ))}
        </div>
      )}
      {skills.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 6,
          marginTop: trades.length ? 12 : 0,
        }}>
          {skills.map(s => (
            <span key={s.id} style={{
              padding: '5px 11px', background: B.accentSoft, color: B.accent,
              fontSize: 12, fontWeight: 600, borderRadius: 100,
            }}>{s.name}</span>
          ))}
        </div>
      )}
    </Section>
  );
}

// ── Signature work block ──────────────────────────────────────────────
function SignatureBlock({ signature, editing, companyId, onChanged }) {
  if (!signature && !editing) return null;

  const unpin = async () => {
    try {
      await api.patch(`/companies/${companyId}`, { signature_jobsite_id: null });
      onChanged?.();
    } catch { /* ignore */ }
  };

  return (
    <Section title="Signature work" subtitle="The one to see first.">
      {signature ? (
        <div style={{
          display: 'grid', gridTemplateColumns: '360px 1fr', gap: 22, alignItems: 'stretch',
        }}>
          <SignaturePhoto js={signature}/>
          <div>
            <div className="serif" style={{
              color: B.text, fontWeight: 600, fontSize: 24, letterSpacing: '-0.01em',
              lineHeight: 1.2,
            }}>{signature.title}</div>
            <div style={{ color: B.dim, fontSize: 13, marginTop: 6 }}>
              {[signature.structure_type, signature.job_type].filter(Boolean).join(' · ') || signature.kind}
            </div>
            <div style={{ color: B.faint, fontSize: 12, marginTop: 10 }}>
              {[signature.location, signature.year || signature.duration].filter(Boolean).join(' · ')}
            </div>
            {signature.worker?.name && (
              <div style={{
                color: B.faint, fontSize: 11, marginTop: 14, fontStyle: 'italic',
              }}>
                Logged by {signature.worker.name}
              </div>
            )}
            {editing && (
              <button onClick={unpin} style={{ ...ghostBtn, marginTop: 14, paddingLeft: 0 }}>
                Unpin signature
              </button>
            )}
          </div>
        </div>
      ) : (
        <p style={{ color: B.faint, fontStyle: 'italic', margin: 0 }}>
          No signature pinned yet. Click a work card below to pin one.
        </p>
      )}
    </Section>
  );
}

function SignaturePhoto({ js }) {
  const url = js.photos?.[0]?.urls?.medium
    || js.photos?.[0]?.urls?.full
    || js.photo_urls?.medium
    || js.photo_urls?.full
    || null;
  if (url) {
    return (
      <div style={{
        aspectRatio: '4/3', borderRadius: 4, overflow: 'hidden', border: `1px solid ${B.line}`,
        background: `center/cover url("${url}") no-repeat`,
      }}/>
    );
  }
  return (
    <div style={{ borderRadius: 4, overflow: 'hidden', border: `1px solid ${B.line}` }}>
      <Photo kind={js.photo_kind} label={js.title?.toLowerCase()} height={260}/>
    </div>
  );
}

// ── Owners ────────────────────────────────────────────────────────────
// Persistent humans who run the company. Distinct from Crew (which is
// project-based / transient). Membership is derived from work_history
// rows where is_owner = TRUE and is_current = TRUE — the user's own
// self-assertion. The server is the gate; this just renders.
function OwnersSection({ owners, navigate }) {
  return (
    <Section
      title={owners.length === 1 ? 'Owner' : `Owners · ${owners.length}`}
      subtitle="People who own and run this company."
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 10, marginTop: 12,
      }}>
        {owners.map(p => {
          const dest = p.public_slug ? `/profile/${p.public_slug}` : `/profile/${p.id}`;
          return (
            <a
              key={p.id}
              href={`#${dest}`}
              onClick={(e) => { e.preventDefault(); navigate(dest); }}
              title={p.name}
              style={{
                ...crewCard,
                border: `1px solid ${B.accent}`,
                background: B.accentSoft,
              }}
            >
              <SmithAvatar urls={p.avatar_urls} initials={p.initials} size={42} tone={p.avatar_tone || 'wood'}/>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{
                  display: 'inline-block', padding: '1px 6px', borderRadius: 2,
                  background: B.accent, color: '#fff',
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                  textTransform: 'uppercase', marginBottom: 3,
                }}>Owner</div>
                <div className="serif" style={{
                  color: B.text, fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em',
                }}>{p.name}</div>
                <div style={{
                  color: B.dim, fontSize: 12,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {p.role}
                </div>
                <div style={{ color: B.faint, fontSize: 11, marginTop: 2 }}>
                  {p.from_year}{p.is_current ? ' — present' : (p.to_year ? ` — ${p.to_year}` : '')}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </Section>
  );
}

// ── Crew ──────────────────────────────────────────────────────────────
function CrewSection({ crew, navigate }) {
  return (
    <Section title={`Crew · ${crew.length}`} subtitle="People who've worked here.">
      {crew.length === 0 && (
        <p style={{ color: B.faint, fontStyle: 'italic', margin: 0 }}>No crew listed yet.</p>
      )}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 10, marginTop: crew.length ? 12 : 0,
      }}>
        {crew.map(p => {
          const dest = p.public_slug ? `/profile/${p.public_slug}` : `/profile/${p.id}`;
          return (
            <a
              key={p.id}
              href={`#${dest}`}
              onClick={(e) => { e.preventDefault(); navigate(dest); }}
              title={p.name}
              style={crewCard}
            >
              <SmithAvatar urls={p.avatar_urls} initials={p.initials} size={42} tone={p.avatar_tone || 'wood'}/>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div className="serif" style={{
                  color: B.text, fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em',
                }}>{p.name}</div>
                <div style={{
                  color: B.dim, fontSize: 12,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {p.role}
                </div>
                <div style={{ color: B.faint, fontSize: 11, marginTop: 2 }}>
                  {p.from_year}{p.is_current ? ' — present' : (p.to_year ? ` — ${p.to_year}` : '')}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </Section>
  );
}

// ── Work grid ─────────────────────────────────────────────────────────
function WorkGrid({ items, companyName, editing, companyId, currentSignatureId, onChanged }) {
  if (items.length === 0) return null;

  const pin = async (id) => {
    try {
      await api.patch(`/companies/${companyId}`, { signature_jobsite_id: id });
      onChanged?.();
    } catch { /* ignore */ }
  };

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
      gap: 12, marginTop: 12,
    }}>
      {items.map(js => {
        const url = js.photos?.[0]?.urls?.medium
          || js.photos?.[0]?.urls?.full
          || js.photo_urls?.medium
          || js.photo_urls?.full
          || null;
        const isSig = js.id === currentSignatureId;
        return (
          <div
            key={js.id}
            onClick={editing ? () => pin(js.id) : undefined}
            role={editing ? 'button' : undefined}
            tabIndex={editing ? 0 : undefined}
            onKeyDown={editing ? (e => { if (e.key === 'Enter' || e.key === ' ') pin(js.id); }) : undefined}
            style={{
              background: B.bg, border: `${isSig ? 2 : 1}px solid ${isSig ? B.accent : B.line}`,
              borderRadius: 4, overflow: 'hidden',
              cursor: editing ? 'pointer' : 'default',
              position: 'relative',
            }}
          >
            {url ? (
              <div style={{
                height: 140,
                background: `center/cover url("${url}") no-repeat ${B.bg}`,
              }}/>
            ) : (
              <Photo kind={js.photo_kind} label={(js.title || companyName || '').toLowerCase()} height={140}/>
            )}
            <div style={{ padding: '12px 14px' }}>
              <div className="serif" style={{
                color: B.text, fontWeight: 600, fontSize: 14, letterSpacing: '-0.005em',
              }}>{js.title}</div>
              <div style={{ color: B.dim, fontSize: 12, marginTop: 3 }}>
                {[js.structure_type, js.job_type].filter(Boolean).join(' · ') || js.kind}
              </div>
              <div style={{ color: B.faint, fontSize: 11, marginTop: 7 }}>
                {[js.location, js.year || js.duration].filter(Boolean).join(' · ')}
              </div>
            </div>
            {editing && (
              <div style={{
                position: 'absolute', top: 6, right: 6,
                background: isSig ? B.accent : 'rgba(42,31,23,0.7)',
                color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                textTransform: 'uppercase', padding: '3px 8px', borderRadius: 100,
              }}>{isSig ? 'Signature' : 'Pin'}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Section frame ─────────────────────────────────────────────────────
function Section({ title, subtitle, children }) {
  return (
    <section style={{
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
      padding: '28px 36px',
    }}>
      <h2 className="serif" style={{
        margin: 0, fontSize: 22, fontWeight: 600,
        color: B.text, letterSpacing: '-0.015em',
      }}>{title}</h2>
      {subtitle && (
        <p style={{ margin: '4px 0 16px', color: B.dim, fontSize: 13 }}>{subtitle}</p>
      )}
      {!subtitle && <div style={{ height: 12 }}/>}
      {children}
    </section>
  );
}

// Minimal chrome for signed-out visitors — Smith mark + Sign in / Build CTA.
// TopNav assumes auth + MessagesProvider context and would crash here.
function PublicChrome({ navigate }) {
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
    </header>
  );
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {[200, 240, 280, 220].map((h, i) => (
        <div key={i} style={{
          height: h, background: B.surface, border: `1px solid ${B.line}`,
          borderRadius: 4, opacity: 0.6,
        }}/>
      ))}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const pageMain = {
  maxWidth: 980,
  margin: '0 auto',
  padding: '32px 40px',
  position: 'relative',
  zIndex: 1,
};
const heroCard = {
  background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
  padding: '32px 36px',
  boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
};
const heroName = {
  margin: 0, color: B.text, fontSize: 34, fontWeight: 600, letterSpacing: '-0.02em',
};
const prose = {
  color: B.text, fontSize: 14.5, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap',
};
const logoFrame = (logoUrl) => ({
  width: 104, height: 104, borderRadius: 4,
  background: logoUrl ? `center/cover url("${logoUrl}") no-repeat` : B.bg,
  border: `1px solid ${B.line}`,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: B.accent, flexShrink: 0,
});
const stewardTag = {
  fontSize: 10, color: B.accent, padding: '2px 8px',
  background: B.accentSoft, borderRadius: 100, fontWeight: 700,
  letterSpacing: '0.04em', textTransform: 'uppercase',
};
const editBtn = {
  background: 'transparent', border: `1px solid ${B.line}`, color: B.text,
  padding: '8px 14px', borderRadius: 100, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
  flexShrink: 0,
};
const crewCard = {
  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
  background: B.bg, border: `1px solid ${B.line}`, borderRadius: 4,
  cursor: 'pointer', textAlign: 'left',
  textDecoration: 'none',
};
const inp = {
  width: '100%', background: B.bg, border: `1px solid ${B.line}`,
  borderRadius: 4, padding: '10px 12px', fontSize: 14, color: B.text,
  fontFamily: 'inherit', outline: 'none',
};
const ghostBtn = {
  background: 'transparent', border: 'none', color: B.dim,
  padding: '9px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
};
const primaryBtn = (enabled) => ({
  background: enabled ? B.text : B.surface2,
  border: enabled ? 'none' : `1px solid ${B.line}`,
  color: enabled ? B.surface : B.faint,
  padding: '9px 18px', borderRadius: 100, fontSize: 13, fontWeight: 600,
  cursor: enabled ? 'pointer' : 'not-allowed',
});
const editLabel = {
  color: B.text, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
  textTransform: 'uppercase',
};
const muted = { color: B.faint, fontSize: 11, fontStyle: 'italic' };
