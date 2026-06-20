// Smith — Company profile page
// Public read-view for everyone; inline edit affordances for the steward.
// Sections: hero, about, signature work, crew, recent work.
//
// Edit mode (steward only) swaps the hero + about into form inputs, exposes
// logo upload, and turns the work grid into a one-click signature picker.

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { B } from '../lib/theme.js';
import { TopNav } from '../components/TopNav.jsx';
import { Icon } from '../components/Icon.jsx';
import { Photo } from '../components/Primitives.jsx';
import { SmithAvatar } from '../components/SmithAvatar.jsx';
import { api } from '../lib/api.js';
import { useRouter } from '../lib/router.jsx';

export function CompanyPage({ companyId }) {
  const { navigate } = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await api.get(`/companies/${companyId}/profile`);
      setData(d);
    } catch (e) {
      setError(e.data?.error || 'Could not load this company.');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ background: B.bg, minHeight: '100vh' }}>
      <TopNav/>
      <main style={{ maxWidth: 980, margin: '0 auto', padding: '32px 40px' }}>
        {loading && <Skeleton/>}
        {error && (
          <div style={{
            background: B.surface, border: `1px solid ${B.danger}`, borderRadius: 4,
            padding: 24, color: B.danger,
          }}>{error}</div>
        )}
        {data && (
          <CompanyBody data={data} onChanged={load} navigate={navigate}/>
        )}
      </main>
    </div>
  );
}

function CompanyBody({ data, onChanged, navigate }) {
  const { company, steward, is_steward, crew, signature_jobsite, recent_work } = data;
  const [editing, setEditing] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Hero
        company={company}
        steward={steward}
        isSteward={is_steward}
        editing={editing}
        onEdit={() => setEditing(true)}
        onCancel={() => setEditing(false)}
        onSaved={() => { setEditing(false); onChanged?.(); }}
      />

      {company.about && !editing && (
        <Section title="About">
          <p style={{ color: B.text, fontSize: 14.5, lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap' }}>
            {company.about}
          </p>
        </Section>
      )}

      <SignatureBlock
        signature={signature_jobsite}
        editing={editing && is_steward}
        companyId={company.id}
        onChanged={onChanged}
      />

      <Section title={`Crew · ${crew.length}`} subtitle="People who've worked here.">
        {crew.length === 0 && (
          <p style={{ color: B.faint, fontStyle: 'italic', margin: 0 }}>No crew listed yet.</p>
        )}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 10, marginTop: crew.length ? 12 : 0,
        }}>
          {crew.map(p => (
            <button
              key={p.id}
              onClick={() => navigate(`/profile/${p.id}`)}
              style={crewCard}
            >
              <SmithAvatar urls={p.avatar_urls} initials={p.initials} size={40} tone={p.avatar_tone || 'wood'}/>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div className="serif" style={{
                  color: B.text, fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em',
                }}>{p.name}</div>
                <div style={{ color: B.dim, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.role}
                </div>
                <div style={{ color: B.faint, fontSize: 11, marginTop: 2 }}>
                  {p.from_year}{p.is_current ? ' — present' : (p.to_year ? ` — ${p.to_year}` : '')}
                </div>
              </div>
            </button>
          ))}
        </div>
      </Section>

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
          editing={editing && is_steward}
          companyId={company.id}
          currentSignatureId={company.signature_jobsite_id}
          onChanged={onChanged}
        />
      </Section>
    </div>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────
function Hero({ company, steward, isSteward, editing, onEdit, onCancel, onSaved }) {
  if (editing) return <HeroEdit company={company} onCancel={onCancel} onSaved={onSaved}/>;

  const logoUrl = company.logo_urls?.medium || company.logo_urls?.thumb || company.logo_urls?.full;

  return (
    <section style={{
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
      padding: '32px 40px', display: 'flex', gap: 24, alignItems: 'flex-start',
    }}>
      <div style={logoFrame(logoUrl)}>
        {!logoUrl && <Icon name="building" size={36} stroke={1.3}/>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <h1 className="serif" style={{
            margin: 0, color: B.text, fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em',
          }}>{company.name}</h1>
          {steward && (
            <span style={stewardTag}>Claimed</span>
          )}
        </div>
        {company.type && (
          <div style={{ color: B.dim, fontSize: 14, marginTop: 4 }}>{company.type}</div>
        )}
        {company.tagline && (
          <p style={{
            margin: '14px 0 0', color: B.text, fontSize: 15, lineHeight: 1.55,
          }}>{company.tagline}</p>
        )}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 14,
          color: B.dim, fontSize: 13,
        }}>
          {company.founded_year && (
            <span><Icon name="award" size={14} style={{ verticalAlign: 'middle', color: B.accent }}/> Since {company.founded_year}</span>
          )}
          {company.primary_location && (
            <span><Icon name="building" size={14} style={{ verticalAlign: 'middle', color: B.accent }}/> {company.primary_location}</span>
          )}
          {steward && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <SmithAvatar urls={steward.avatar_urls} initials={(steward.name?.[0] || '').toUpperCase()} size={20} tone={steward.avatar_tone || 'wood'}/>
              Stewarded by {steward.name}
            </span>
          )}
        </div>
      </div>
      {isSteward && (
        <button onClick={onEdit} style={editBtn}>
          <Icon name="edit" size={14}/> Edit profile
        </button>
      )}
    </section>
  );
}

function HeroEdit({ company, onCancel, onSaved }) {
  const [name, setName] = useState(company.name || '');
  const [type, setType] = useState(company.type || '');
  const [tagline, setTagline] = useState(company.tagline || '');
  const [foundedYear, setFoundedYear] = useState(company.founded_year || '');
  const [location, setLocation] = useState(company.primary_location || '');
  const [about, setAbout] = useState(company.about || '');
  const [logoUrl, setLogoUrl] = useState(
    company.logo_urls?.medium || company.logo_urls?.thumb || company.logo_urls?.full || null
  );
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const uploadLogo = async (file) => {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await api.upload(`/photos/company/${company.id}/logo`, fd);
      setLogoUrl(data.logo_urls?.medium || data.logo_urls?.full || data.logo_urls?.thumb || null);
    } catch (e) {
      setError(e.data?.error || 'Logo upload failed.');
    } finally {
      setUploading(false);
    }
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
      });
      onSaved?.();
    } catch (e) {
      setError(e.data?.error || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
      padding: '28px 32px',
    }}>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="Upload logo"
          style={{
            ...logoFrame(logoUrl),
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

      {error && (
        <div style={{
          marginTop: 14, color: B.danger, fontSize: 13,
          background: B.bg, border: `1px solid ${B.danger}`, borderRadius: 4,
          padding: '10px 14px',
        }}>{error}</div>
      )}

      <div style={{
        marginTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 12, flexWrap: 'wrap',
      }}>
        <span style={{ color: B.faint, fontSize: 12, fontStyle: 'italic' }}>
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
    <Section title="Signature work" subtitle="The one we want you to see first.">
      {signature ? (
        <div style={{
          display: 'grid', gridTemplateColumns: '320px 1fr', gap: 18, alignItems: 'stretch',
        }}>
          <SignaturePhoto js={signature}/>
          <div>
            <div className="serif" style={{
              color: B.text, fontWeight: 600, fontSize: 22, letterSpacing: '-0.01em',
            }}>{signature.title}</div>
            <div style={{ color: B.dim, fontSize: 13, marginTop: 4 }}>
              {[signature.structure_type, signature.job_type].filter(Boolean).join(' · ') || signature.kind}
            </div>
            <div style={{ color: B.faint, fontSize: 12, marginTop: 8 }}>
              {[signature.location, signature.year || signature.duration].filter(Boolean).join(' · ')}
            </div>
            {signature.worker?.name && (
              <div style={{ color: B.faint, fontSize: 11, marginTop: 10, fontStyle: 'italic' }}>
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
      <Photo kind={js.photo_kind} label={js.title?.toLowerCase()} height={240}/>
    </div>
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
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gap: 10, marginTop: 12,
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
                height: 132,
                background: `center/cover url("${url}") no-repeat ${B.bg}`,
              }}/>
            ) : (
              <Photo kind={js.photo_kind} label={(js.title || companyName || '').toLowerCase()} height={132}/>
            )}
            <div style={{ padding: '10px 14px' }}>
              <div className="serif" style={{
                color: B.text, fontWeight: 600, fontSize: 14,
              }}>{js.title}</div>
              <div style={{ color: B.dim, fontSize: 12, marginTop: 2 }}>
                {[js.structure_type, js.job_type].filter(Boolean).join(' · ') || js.kind}
              </div>
              <div style={{ color: B.faint, fontSize: 11, marginTop: 6 }}>
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
      padding: '24px 32px',
    }}>
      <h2 className="serif" style={{
        margin: 0, fontSize: 20, fontWeight: 600,
        color: B.text, letterSpacing: '-0.01em',
      }}>{title}</h2>
      {subtitle && (
        <p style={{ margin: '4px 0 14px', color: B.dim, fontSize: 13 }}>{subtitle}</p>
      )}
      {!subtitle && <div style={{ height: 10 }}/>}
      {children}
    </section>
  );
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {[140, 200, 240, 180].map((h, i) => (
        <div key={i} style={{
          height: h, background: B.surface, border: `1px solid ${B.line}`,
          borderRadius: 4, opacity: 0.6,
        }}/>
      ))}
    </div>
  );
}

const logoFrame = (logoUrl) => ({
  width: 96, height: 96, borderRadius: 4,
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
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
  background: B.bg, border: `1px solid ${B.line}`, borderRadius: 4,
  cursor: 'pointer', textAlign: 'left',
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
