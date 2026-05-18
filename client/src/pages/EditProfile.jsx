// Smith — Edit Profile
// Lets the user fill out the parts of their profile that aren't auto-derived:
// header (name/headline/location/about/avatar tone/cover kind), trades,
// licenses, work history (companies + jobsites), skills.
//
// Tabs match the design's EditProfileB structure.

import React, { useEffect, useState, useCallback } from 'react';
import { B } from '../lib/theme.js';
import { TopNav } from '../components/TopNav.jsx';
import { Avatar, Photo } from '../components/Primitives.jsx';
import { Icon } from '../components/Icon.jsx';
import { api } from '../lib/api.js';
import { useRouter } from '../lib/router.jsx';
import { useAuth } from '../lib/AuthContext.jsx';
import { suggestSkills } from '../lib/trade-skills.js';

const TONES = ['wood', 'rust', 'steel', 'brick', 'sage', 'sand', 'slate', 'cream'];
const COVER_KINDS = ['frame', 'wood', 'concrete', 'roof', 'brick', 'crew', 'workshop', 'kitchen', 'tile', 'blueprint', 'sky', 'steel'];

const TABS = [
  { k: 'header', label: 'Header & about' },
  { k: 'trades', label: 'Trades & skills' },
  { k: 'work', label: 'Work history' },
  { k: 'credentials', label: 'Credentials' },
];

export function EditProfilePage() {
  const { navigate, params } = useRouter();
  const { refresh } = useAuth();

  // Initial tab honors ?tab= when present. We map "history" → our "work"
  // key so the URL is friendlier than the internal name.
  const initialTab = (() => {
    if (params.tab === 'history' || params.tab === 'work') return 'work';
    if (params.tab === 'header' || params.tab === 'trades' || params.tab === 'credentials') {
      return params.tab;
    }
    return 'header';
  })();
  const [tab, setTab] = useState(initialTab);

  // The `focus` param tells WorkHistoryTab where to scroll & pulse. We pass
  // it down only while it's relevant; consuming it once is enough.
  const [focus, setFocus] = useState(params.focus || null);
  // After the deep-link is handled, clear it so the user doesn't see the
  // pulse re-trigger on tab toggles. Done after a short delay so the child
  // gets a chance to fire its effect.
  useEffect(() => {
    if (!focus) return;
    const t = setTimeout(() => setFocus(null), 100);
    return () => clearTimeout(t);
  }, [focus]);

  const [profile, setProfile] = useState(null);

  const load = useCallback(async () => {
    const { profile } = await api.get('/profiles/me');
    setProfile(profile);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaved = async () => {
    await load();
    await refresh();
  };

  if (!profile) return (
    <div style={{ background: B.bg, minHeight: '100vh' }}>
      <TopNav active="profile"/>
    </div>
  );

  return (
    <div style={{ background: B.bg, minHeight: '100vh' }}>
      <TopNav active="profile"/>
      <main style={{ maxWidth: 920, margin: '0 auto', padding: '32px 40px' }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          marginBottom: 18,
        }}>
          <div>
            <h1 className="serif" style={{
              color: B.text, fontSize: 32, fontWeight: 600, margin: 0,
              letterSpacing: '-0.02em',
            }}>Edit profile</h1>
            <p style={{ color: B.dim, fontSize: 14, marginTop: 4 }}>
              Tell people what you build.
            </p>
          </div>
          <button onClick={() => navigate('/profile')} style={{
            background: 'transparent', border: `1px solid ${B.line}`, color: B.text,
            padding: '9px 18px', borderRadius: 100, fontSize: 13, fontWeight: 600,
            cursor: 'pointer',
          }}>Done</button>
        </div>

        <div style={{
          display: 'flex', gap: 28, marginTop: 18, marginBottom: 24,
          borderBottom: `1px solid ${B.line}`,
        }}>
          {TABS.map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} style={{
              padding: '10px 0', background: 'transparent', border: 'none',
              color: tab === t.k ? B.text : B.dim,
              borderBottom: tab === t.k ? `2px solid ${B.accent}` : '2px solid transparent',
              fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
            }}>{t.label}</button>
          ))}
        </div>

        {tab === 'header' && <HeaderTab profile={profile} onSaved={handleSaved}/>}
        {tab === 'trades' && <TradesAndSkillsTab profile={profile} onSaved={handleSaved}/>}
        {tab === 'work' && <WorkHistoryTab profile={profile} onSaved={handleSaved} focus={focus}/>}
        {tab === 'credentials' && <CredentialsTab profile={profile} onSaved={handleSaved}/>}
      </main>
    </div>
  );
}

// ── Tab: Header & about ───────────────────────────────────────────────
function HeaderTab({ profile, onSaved }) {
  const [first, setFirst] = useState(profile.first_name || '');
  const [last, setLast] = useState(profile.last_name || '');
  const [headline, setHeadline] = useState(profile.headline || '');
  const [location, setLocation] = useState(profile.location || '');
  const [about, setAbout] = useState(profile.about || '');
  const [tone, setTone] = useState(profile.avatar_tone || 'wood');
  const [cover, setCover] = useState(profile.cover_kind || 'frame');
  const [years, setYears] = useState(profile.years_experience || 0);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setBusy(true);
    setSaved(false);
    try {
      await api.patch('/profiles/me', {
        first_name: first, last_name: last,
        headline, location, about,
        avatar_tone: tone, cover_kind: cover,
        years_experience: parseInt(years, 10) || 0,
      });
      setSaved(true);
      onSaved?.();
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      {/* Cover preview */}
      <div style={{ marginBottom: 22, borderRadius: 4, overflow: 'hidden', border: `1px solid ${B.line}` }}>
        <Photo kind={cover} label="cover" height={140}/>
        <div style={{ background: B.bg, padding: '14px 18px' }}>
          <div style={{ color: B.faint, fontSize: 11, fontStyle: 'italic', marginBottom: 8 }}>
            Cover photo
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {COVER_KINDS.map(k => (
              <button key={k} onClick={() => setCover(k)} style={{
                width: 36, height: 36, padding: 0, border: 'none',
                borderRadius: 4, overflow: 'hidden', cursor: 'pointer',
                boxShadow: cover === k ? `0 0 0 2px ${B.accent}` : 'none',
              }} title={k}>
                <Photo kind={k} label="" height={36}/>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 22 }}>
        <Avatar initials={(first[0] || '') + (last[0] || '')} size={64} tone={tone}/>
        <div style={{ flex: 1 }}>
          <Label>Avatar tone</Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {TONES.map(t => (
              <button key={t} onClick={() => setTone(t)} style={{
                width: 30, height: 30, borderRadius: '50%', border: 'none',
                cursor: 'pointer', padding: 0,
                boxShadow: tone === t ? `0 0 0 2px ${B.accent}` : 'none',
              }} title={t}>
                <Avatar initials="" size={30} tone={t}/>
              </button>
            ))}
          </div>
        </div>
      </div>

      <Row>
        <Field label="First name">
          <TextInput value={first} onChange={e => setFirst(e.target.value)}/>
        </Field>
        <Field label="Last name">
          <TextInput value={last} onChange={e => setLast(e.target.value)}/>
        </Field>
      </Row>

      <Field label="Headline">
        <TextInput
          value={headline}
          onChange={e => setHeadline(e.target.value)}
          placeholder="e.g. Master Carpenter · Custom Millwork & Framing"
        />
      </Field>

      <Row>
        <Field label="Location">
          <TextInput
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="e.g. Bozeman, MT"
          />
        </Field>
        <Field label="Years experience">
          <TextInput
            type="number"
            value={years}
            onChange={e => setYears(e.target.value)}
            placeholder="0"
          />
        </Field>
      </Row>

      <Field label="About">
        <textarea
          value={about}
          onChange={e => setAbout(e.target.value)}
          rows={5}
          placeholder="Tell people what you build, how you build it, what you've learned."
          style={{
            ...inputStyle, resize: 'vertical', lineHeight: 1.55,
          }}
        />
      </Field>

      <SaveBar saved={saved} busy={busy} onSave={save}/>
    </Card>
  );
}

// ── Tab: Trades & Skills ──────────────────────────────────────────────
function TradesAndSkillsTab({ profile, onSaved }) {
  return (
    <>
      <Card>
        <SectionTitle
          title="Your trades"
          sub="Pick up to 6 trades. The first is your primary."
        />
        <TradeEditor initial={profile.trades} onSaved={onSaved}/>
      </Card>
      <div style={{ height: 14 }}/>
      <Card>
        <SectionTitle
          title="Your skills"
          sub="The specific things you're good at. Each gets a 1-5 level."
        />
        <SkillEditor initial={profile.skills} userTrades={profile.trades} onSaved={onSaved}/>
      </Card>
    </>
  );
}

function TradeEditor({ initial, onSaved }) {
  const [trades, setTrades] = useState(() => initial.map(t => ({ name: t.name, years: t.years })));
  const [catalog, setCatalog] = useState([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/trades').then(d => setCatalog(d.trades)).catch(() => {});
  }, []);

  const remove = (i) => setTrades(ts => ts.filter((_, idx) => idx !== i));
  const setYears = (i, v) => setTrades(ts => ts.map((t, idx) => idx === i ? { ...t, years: v } : t));
  const add = (name) => {
    if (trades.find(t => t.name === name) || trades.length >= 6) return;
    setTrades(ts => [...ts, { name, years: 0 }]);
  };
  const move = (i, dir) => {
    setTrades(ts => {
      const next = [...ts];
      const j = i + dir;
      if (j < 0 || j >= next.length) return next;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const save = async () => {
    setBusy(true);
    try {
      await api.post('/profiles/me/trades', {
        trades: trades.map(t => ({ name: t.name, years: parseInt(t.years, 10) || 0 })),
      });
      setSaved(true);
      onSaved?.();
      setTimeout(() => setSaved(false), 2000);
    } finally { setBusy(false); }
  };

  const available = catalog.filter(c => !trades.find(t => t.name === c.name));

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {trades.map((t, i) => (
          <div key={t.name} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: B.bg, border: `1px solid ${B.line}`, borderRadius: 4,
            padding: '10px 14px',
          }}>
            <span className="serif" style={{
              color: i === 0 ? B.accent : B.faint, fontSize: 11,
              fontWeight: 700, width: 16,
            }}>{i === 0 ? '★' : i + 1}</span>
            <span style={{ flex: 1, color: B.text, fontSize: 14, fontWeight: 500 }}>
              {t.name}
            </span>
            <input
              type="number"
              value={t.years}
              onChange={e => setYears(i, e.target.value)}
              min={0} max={70}
              style={{
                width: 60, background: B.surface, border: `1px solid ${B.line}`,
                borderRadius: 4, padding: '6px 8px', fontSize: 13, color: B.text,
                outline: 'none',
              }}
            />
            <span style={{ color: B.faint, fontSize: 11, fontStyle: 'italic' }}>yrs</span>
            <button onClick={() => move(i, -1)} disabled={i === 0} style={miniBtn}>
              <Icon name="chevron-l" size={14}/>
            </button>
            <button onClick={() => move(i, 1)} disabled={i === trades.length - 1} style={miniBtn}>
              <Icon name="chevron-r" size={14}/>
            </button>
            <button onClick={() => remove(i)} style={{ ...miniBtn, color: B.danger }}>
              <Icon name="trash" size={14}/>
            </button>
          </div>
        ))}
      </div>

      {trades.length < 6 && available.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Label>Add a trade</Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {available.map(t => (
              <button key={t.id} onClick={() => add(t.name)} style={{
                padding: '6px 12px', background: B.surface, border: `1px solid ${B.line}`,
                borderRadius: 100, fontSize: 12, color: B.text, fontWeight: 500,
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <Icon name="plus" size={11} stroke={2.4}/> {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <SaveBar saved={saved} busy={busy} onSave={save}/>
    </>
  );
}

function SkillEditor({ initial, userTrades = [], onSaved }) {
  const [skills, setSkills] = useState(() => initial.map(s => ({ name: s.name, level: s.level })));
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const remove = (i) => setSkills(ss => ss.filter((_, idx) => idx !== i));
  const setLevel = (i, lv) => setSkills(ss => ss.map((s, idx) => idx === i ? { ...s, level: lv } : s));

  // Add by name (used by both the typed input and the suggestion chips).
  // Dedup against the current list case-insensitively.
  const addNamed = (name) => {
    const t = (name || '').trim();
    if (!t) return;
    if (skills.find(s => s.name.toLowerCase() === t.toLowerCase())) return;
    setSkills(ss => [...ss, { name: t, level: 3 }]);
  };
  const add = () => { addNamed(newName); setNewName(''); };

  // Suggestions are recomputed on every render, but it's cheap (tiny list).
  // We pass the *current in-progress* skills list so chips disappear as the
  // user picks them, even before they save.
  const suggestions = suggestSkills({
    userTrades,
    existingSkills: skills.map(s => s.name),
    limit: 12,
  });

  const save = async () => {
    setBusy(true);
    try {
      await api.post('/profiles/me/skills', { skills });
      setSaved(true);
      onSaved?.();
      setTimeout(() => setSaved(false), 2000);
    } finally { setBusy(false); }
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {skills.map((s, i) => (
          <div key={s.name} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: B.bg, border: `1px solid ${B.line}`, borderRadius: 4,
            padding: '10px 14px',
          }}>
            <span style={{ flex: 1, color: B.text, fontSize: 14, fontWeight: 500 }}>{s.name}</span>
            <div style={{ display: 'flex', gap: 3 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setLevel(i, n)} style={{
                  width: 18, height: 8, padding: 0, border: 'none', borderRadius: 2,
                  background: n <= s.level ? B.accent : B.surface2, cursor: 'pointer',
                }}/>
              ))}
            </div>
            <button onClick={() => remove(i)} style={{ ...miniBtn, color: B.danger }}>
              <Icon name="trash" size={14}/>
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Add a skill (e.g. Stair Building)"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button onClick={add} disabled={!newName.trim()} style={{
          background: newName.trim() ? B.accent : B.surface2,
          color: newName.trim() ? '#fff' : B.faint,
          border: 'none', padding: '0 16px', borderRadius: 4,
          fontSize: 13, fontWeight: 600, cursor: newName.trim() ? 'pointer' : 'not-allowed',
        }}>Add</button>
      </div>

      {/* Suggested skills based on the user's trades. The chip list shrinks
          as the user adds skills (already-added entries are filtered out by
          suggestSkills). When everything's added, the section disappears. */}
      {suggestions.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <Label>
            {userTrades.length > 0
              ? `Suggested for ${userTrades.map(t => t.name).join(' + ')}`
              : 'Suggested skills'}
          </Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {suggestions.map(name => (
              <button
                key={name}
                onClick={() => addNamed(name)}
                title={`Add "${name}"`}
                style={{
                  padding: '6px 12px', background: B.surface,
                  border: `1px solid ${B.line}`, borderRadius: 100,
                  fontSize: 12, color: B.text, fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = B.accentSoft;
                  e.currentTarget.style.borderColor = B.accent;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = B.surface;
                  e.currentTarget.style.borderColor = B.line;
                }}
              >
                <Icon name="plus" size={11} stroke={2.4} style={{ color: B.accent }}/> {name}
              </button>
            ))}
          </div>
        </div>
      )}

      <SaveBar saved={saved} busy={busy} onSave={save}/>
    </>
  );
}

// ── Tab: Work history ─────────────────────────────────────────────────
function WorkHistoryTab({ profile, onSaved, focus }) {
  const [adding, setAdding] = useState(false);
  const addCompanyRef = React.useRef(null);

  // Compute total featured across all companies — used by AddJobsiteForm
  // and the inline featured-toggle to enforce the 10-cap.
  const featuredCount = React.useMemo(() => {
    return profile.work_history.reduce(
      (n, co) => n + (co.jobsites || []).filter(j => j.is_featured).length, 0
    );
  }, [profile.work_history]);
  const FEATURED_CAP = 10;

  // Deep-link handler: scroll + pulse + auto-open the right control.
  useEffect(() => {
    if (focus !== 'add-company') return;
    // The button might be hidden when `adding` is true. Force it open so the
    // user lands on the form immediately, which is what they came here for.
    setAdding(true);
    // Scroll the form area into view after a tick (it needs to mount first).
    const t = setTimeout(() => {
      addCompanyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Apply pulse class for ~3s, then remove.
      const el = addCompanyRef.current;
      if (!el) return;
      el.classList.add('pulse');
      setTimeout(() => el.classList.remove('pulse'), 3200);
    }, 60);
    return () => clearTimeout(t);
  }, [focus]);

  // For the newest-company case, we pass focus down to CompanyEditor. Only
  // the FIRST (most recent) company gets focused; the rest just render normally.
  const newestCompanyId = profile.work_history[0]?.id;

  return (
    <>
      <Card>
        <SectionTitle
          title="Where you've worked"
          sub={`Add the companies you've worked at. Then the jobsites under each. ${featuredCount} of ${FEATURED_CAP} jobsites featured.`}
        />

        {profile.work_history.length === 0 && (
          <div style={{
            padding: 24, textAlign: 'center', color: B.faint, fontSize: 13,
            fontStyle: 'italic',
          }}>
            No companies yet — add your first.
          </div>
        )}

        {profile.work_history.map(co => (
          <CompanyEditor
            key={co.id}
            co={co}
            onChanged={onSaved}
            featuredCount={featuredCount}
            featuredCap={FEATURED_CAP}
            focusAddJobsite={focus === 'newest-company' && co.id === newestCompanyId}
          />
        ))}

        <div ref={addCompanyRef}>
          {!adding && (
            <button onClick={() => setAdding(true)} style={{
              marginTop: 14, width: '100%',
              background: 'transparent', border: `1px dashed ${B.line}`,
              color: B.dim, padding: '14px', borderRadius: 4,
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <Icon name="plus" size={14} stroke={2.4}/> Add a company
            </button>
          )}

          {adding && (
            <AddCompanyForm
              onCancel={() => setAdding(false)}
              onAdded={() => { setAdding(false); onSaved?.(); }}
            />
          )}
        </div>
      </Card>
    </>
  );
}

function CompanyEditor({ co, onChanged, focusAddJobsite, featuredCount, featuredCap }) {
  const [open, setOpen] = useState(false);
  const [addingSite, setAddingSite] = useState(false);
  const addJobsiteRef = React.useRef(null);

  // Deep-link: if this is the company the user came here to act on, open
  // the expansion and pulse the add-jobsite affordance.
  useEffect(() => {
    if (!focusAddJobsite) return;
    setOpen(true);
    // Wait for the expansion to mount, then scroll/pulse the add control.
    const t = setTimeout(() => {
      addJobsiteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const el = addJobsiteRef.current;
      if (!el) return;
      el.classList.add('pulse');
      setTimeout(() => el.classList.remove('pulse'), 3200);
    }, 120);
    return () => clearTimeout(t);
  }, [focusAddJobsite]);

  const removeJobsite = async (id) => {
    if (!confirm('Remove this jobsite?')) return;
    await api.delete(`/jobsites/${id}`);
    onChanged?.();
  };

  // Toggle featured on an existing jobsite. Block if we'd exceed the cap.
  const toggleFeatured = async (js) => {
    const next = !js.is_featured;
    if (next && featuredCount >= featuredCap) {
      alert(`You can feature up to ${featuredCap} jobsites. Unfeature another first.`);
      return;
    }
    await api.patch(`/jobsites/${js.id}`, { is_featured: next });
    onChanged?.();
  };

  const removeWork = async () => {
    if (!confirm(`Remove your time at ${co.company_name}? This deletes ${co.jobsites.length} jobsite(s).`)) return;
    await api.delete(`/work-history/${co.id}`);
    onChanged?.();
  };

  return (
    <div style={{
      background: B.bg, border: `1px solid ${B.line}`, borderRadius: 4,
      marginBottom: 10, overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 38, height: 38, background: B.surface, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: B.accent, border: `1px solid ${B.line}`, flexShrink: 0,
        }}>
          <Icon name="building" size={18}/>
        </div>
        <div style={{ flex: 1 }}>
          <div className="serif" style={{
            color: B.text, fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em',
          }}>{co.company_name}</div>
          <div style={{ color: B.dim, fontSize: 12 }}>
            {co.role} · {co.from_year} – {co.is_current ? 'Present' : co.to_year || ''}
            {' '}· {co.jobsites?.length || 0} jobsite{(co.jobsites?.length || 0) === 1 ? '' : 's'}
          </div>
        </div>
        <button onClick={() => setOpen(o => !o)} style={miniBtn}>
          <Icon name={open ? 'chevron-d' : 'chevron-r'} size={16}/>
        </button>
        <button onClick={removeWork} style={{ ...miniBtn, color: B.danger }}>
          <Icon name="trash" size={14}/>
        </button>
      </div>

      {open && (
        <div style={{ padding: '0 18px 16px' }} className="fade-in">
          <div style={{
            color: B.faint, fontSize: 11, fontStyle: 'italic',
            marginTop: 8, marginBottom: 8,
          }}>Jobsites</div>
          {co.jobsites.length === 0 && (
            <div style={{ color: B.faint, fontSize: 12, fontStyle: 'italic', padding: '6px 0' }}>
              No jobsites yet under this company.
            </div>
          )}
          {co.jobsites.map(js => (
            <div key={js.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
              padding: '8px 12px', marginBottom: 6,
            }}>
              <div style={{ width: 50, height: 36, borderRadius: 2, overflow: 'hidden' }}>
                <Photo kind={js.photo_kind} label="" height={36}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="serif" style={{ color: B.text, fontSize: 13, fontWeight: 600 }}>
                  {js.title}
                </div>
                <div style={{ color: B.dim, fontSize: 11 }}>
                  {js.kind}{js.location ? ` · ${js.location}` : ''}{js.duration ? ` · ${js.duration}` : ''}
                </div>
              </div>
              {/* Featured-toggle star: filled when featured, outline otherwise.
                  Disabled visually when at cap and not currently featured. */}
              <button
                onClick={() => toggleFeatured(js)}
                title={js.is_featured
                  ? 'Featured in "Selected work" — click to unfeature'
                  : (featuredCount >= featuredCap
                      ? `Cap reached (${featuredCap}). Unfeature another first.`
                      : 'Feature in "Selected work"')}
                style={{
                  ...miniBtn,
                  color: js.is_featured ? B.accent : B.faint,
                  opacity: (!js.is_featured && featuredCount >= featuredCap) ? 0.4 : 1,
                  cursor: (!js.is_featured && featuredCount >= featuredCap) ? 'not-allowed' : 'pointer',
                }}>
                <svg width={14} height={14} viewBox="0 0 24 24"
                     fill={js.is_featured ? 'currentColor' : 'none'}
                     stroke="currentColor" strokeWidth="1.8"
                     strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </button>
              <button onClick={() => removeJobsite(js.id)} style={{ ...miniBtn, color: B.danger }}>
                <Icon name="trash" size={13}/>
              </button>
            </div>
          ))}
          <div ref={addJobsiteRef} style={{ display: 'inline-block' }}>
            {!addingSite && (
              <button onClick={() => setAddingSite(true)} style={{
                marginTop: 8, background: 'transparent', border: `1px dashed ${B.line}`,
                color: B.dim, padding: '8px 14px', borderRadius: 4, fontSize: 12, fontWeight: 500,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <Icon name="plus" size={12} stroke={2.4}/> Add a jobsite
              </button>
            )}
            {addingSite && (
              <AddJobsiteForm
                workId={co.id}
                onCancel={() => setAddingSite(false)}
                onAdded={() => { setAddingSite(false); onChanged?.(); }}
                featuredCount={featuredCount}
                featuredCap={featuredCap}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AddCompanyForm({ onCancel, onAdded }) {
  // Two states a user can be in:
  //   - "search" mode: typing to find an existing company. We hit /companies?search=
  //     on every keystroke (debounced) and show matches in a dropdown. Picking
  //     one moves the user to "selected" mode.
  //   - "create" mode: no match found / user wants a new one. They get the
  //     full set of company fields (name + type) and we'll create it on submit.
  //
  // In both modes the user fills in role/years (their tenure at the company).
  const [name, setName] = useState('');
  const [picked, setPicked] = useState(null); // { id, name, type, claimed } when chosen from results
  const [createNew, setCreateNew] = useState(false);
  const [matches, setMatches] = useState(null); // null = haven't searched, [] = no matches
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const [type, setType] = useState('General Contractor');
  const [role, setRole] = useState('');
  const [fromYear, setFromYear] = useState('');
  const [toYear, setToYear] = useState('');
  const [current, setCurrent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Debounced search on the company name field. Skip when the user has already
  // picked a result or chosen "create new" — they don't need the dropdown then.
  useEffect(() => {
    if (picked || createNew) { setMatches(null); return; }
    const term = name.trim();
    if (term.length < 2) { setMatches(null); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const data = await api.get(`/companies?search=${encodeURIComponent(term)}`);
        if (!cancelled) setMatches(data.companies);
      } catch {
        if (!cancelled) setMatches([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [name, picked, createNew]);

  const pick = (co) => {
    setPicked(co);
    setName(co.name);
    setType(co.type || 'General Contractor');
    setShowDropdown(false);
  };

  const startOver = () => {
    setPicked(null);
    setCreateNew(false);
    setName('');
    setMatches(null);
  };

  const useAsNew = () => {
    setCreateNew(true);
    setShowDropdown(false);
  };

  const submit = async () => {
    if (!name.trim() || !role.trim() || !fromYear.trim()) {
      setError('Company name, role, and start year are required.'); return;
    }
    setBusy(true);
    setError(null);
    try {
      // If we picked an existing company, reuse it. Otherwise create one.
      let companyId = picked?.id;
      if (!companyId) {
        const { company } = await api.post('/companies', {
          name: name.trim(), type, claim: false,
        });
        companyId = company.id;
      }
      await api.post('/work-history', {
        company_id: companyId,
        role: role.trim(),
        from_year: fromYear.trim(),
        to_year: current ? null : toYear.trim() || null,
        is_current: current,
      });
      onAdded?.();
    } catch (e) {
      setError(e.data?.error || 'Could not save.');
    } finally { setBusy(false); }
  };

  // Are we showing the dropdown of matches?
  const dropdownOpen = showDropdown && !picked && !createNew &&
    name.trim().length >= 2 && (searching || matches !== null);

  return (
    <div style={{
      marginTop: 14, padding: 18,
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
    }} className="fade-in">
      <div className="serif" style={{
        color: B.text, fontWeight: 600, fontSize: 15, marginBottom: 12, letterSpacing: '-0.01em',
      }}>Add a company</div>

      <Field label={picked ? 'Company (selected)' : 'Company name — search or add new'}>
        <div style={{ position: 'relative' }}>
          <TextInput
            value={name}
            onChange={e => {
              // Typing here means the user wants to search again. If they had
              // previously picked or chosen "create new", reset that state.
              setName(e.target.value);
              if (picked) setPicked(null);
              if (createNew) setCreateNew(false);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="e.g. Highline Build Co."
            disabled={!!picked}
            style={picked ? { background: B.bg, borderColor: B.accent } : {}}
          />
          {picked && (
            <button
              onClick={startOver}
              type="button"
              title="Change selection"
              style={{
                position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                background: 'transparent', border: 'none', color: B.dim,
                padding: 6, cursor: 'pointer',
              }}>
              <Icon name="x" size={14}/>
            </button>
          )}

          {dropdownOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
              background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)', maxHeight: 240, overflowY: 'auto',
              zIndex: 10,
            }} className="scroll-thin">
              {searching && (
                <div style={{ padding: 12, color: B.faint, fontSize: 12, fontStyle: 'italic' }}>
                  Searching…
                </div>
              )}
              {!searching && matches && matches.length === 0 && (
                <div style={{ padding: 12, color: B.dim, fontSize: 13 }}>
                  No company found. <button onClick={useAsNew} type="button" style={{
                    background: 'transparent', border: 'none', color: B.accent,
                    fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: 13,
                  }}>Add "{name.trim()}" as a new company →</button>
                </div>
              )}
              {!searching && matches && matches.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => pick(m)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', border: 'none', background: 'transparent',
                    textAlign: 'left', cursor: 'pointer',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = B.bg}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    width: 32, height: 32, background: B.bg, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: B.accent, border: `1px solid ${B.line}`, flexShrink: 0,
                  }}>
                    <Icon name="building" size={15}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="serif" style={{
                      color: B.text, fontWeight: 600, fontSize: 13, letterSpacing: '-0.01em',
                    }}>{m.name}</div>
                    <div style={{ color: B.dim, fontSize: 11 }}>
                      {m.type}{m.claimed ? '' : ' · unclaimed'}
                    </div>
                  </div>
                </button>
              ))}
              {!searching && matches && matches.length > 0 && (
                <div style={{
                  padding: '8px 14px', borderTop: `1px solid ${B.line}`,
                  background: B.bg,
                }}>
                  <button onClick={useAsNew} type="button" style={{
                    background: 'transparent', border: 'none', color: B.accent,
                    fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: 12,
                  }}>
                    Don't see it? Add "{name.trim()}" as a new company →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </Field>

      {/* Type field is only relevant when creating a new company. When picking
          an existing one we use whatever type that company has. */}
      {(createNew || (!picked && name.trim().length >= 2 && matches?.length === 0)) && !picked && (
        <Field label="Company type (we'll create this company)">
          <select value={type} onChange={e => setType(e.target.value)} style={inputStyle}>
            {['General Contractor', 'Sub · Carpentry', 'Sub · Electrical', 'Sub · Plumbing', 'Sub · Concrete', 'Sub · Roofing', 'Sub · HVAC', 'Sub · Other', 'Architect', 'Independent', 'Other'].map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </Field>
      )}

      {picked && !picked.claimed && (
        <div style={{
          marginBottom: 14, padding: '10px 12px',
          background: B.accentSoft, border: `1px solid ${B.line}`, borderRadius: 4,
          color: B.dim, fontSize: 12,
        }}>
          <strong style={{ color: B.text }}>{picked.name}</strong> is unclaimed. You can
          claim ownership of it later from the company's page (claim flow coming soon).
        </div>
      )}

      <Row>
        <Field label="Your role">
          <TextInput value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Lead Carpenter"/>
        </Field>
      </Row>
      <Row>
        <Field label="From year">
          <TextInput value={fromYear} onChange={e => setFromYear(e.target.value)} placeholder="2021"/>
        </Field>
        <Field label="To year">
          <TextInput
            value={current ? '' : toYear}
            onChange={e => setToYear(e.target.value)}
            placeholder={current ? 'Present' : '2024'}
            disabled={current}
          />
        </Field>
      </Row>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, cursor: 'pointer',
      }}>
        <input type="checkbox" checked={current} onChange={e => setCurrent(e.target.checked)}
          style={{ accentColor: B.accent }}/>
        <span style={{ color: B.text, fontSize: 13 }}>I currently work here</span>
      </label>

      {error && <div style={{ color: B.danger, fontSize: 12, marginTop: 10 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={onCancel} style={{
          background: 'transparent', border: 'none', color: B.dim,
          padding: '8px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
        }}>Cancel</button>
        <button onClick={submit} disabled={busy} style={{
          background: B.text, border: 'none', color: B.surface,
          padding: '8px 18px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          {busy ? 'Saving…' : (picked ? 'Add to my history' : 'Create & add')}
        </button>
      </div>
    </div>
  );
}

function AddJobsiteForm({ workId, onCancel, onAdded, featuredCount = 0, featuredCap = 10 }) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('');
  const [location, setLocation] = useState('');
  const [duration, setDuration] = useState('');
  const [photoKind, setPhotoKind] = useState('frame');
  const [featured, setFeatured] = useState(false);
  const [busy, setBusy] = useState(false);
  const atCap = featuredCount >= featuredCap;

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await api.post(`/work-history/${workId}/jobsites`, {
        title: title.trim(),
        kind: kind.trim(),
        location: location.trim(),
        duration: duration.trim(),
        photo_kind: photoKind,
        is_featured: featured,
      });
      onAdded?.();
    } finally { setBusy(false); }
  };

  return (
    <div style={{
      marginTop: 10, padding: 14,
      background: B.bg, border: `1px solid ${B.line}`, borderRadius: 4,
    }} className="fade-in">
      <Field label="Jobsite name">
        <TextInput value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Sweetgrass Residence"/>
      </Field>
      <Row>
        <Field label="Kind">
          <TextInput value={kind} onChange={e => setKind(e.target.value)} placeholder="Custom Home · 4,200 sqft"/>
        </Field>
        <Field label="Location">
          <TextInput value={location} onChange={e => setLocation(e.target.value)} placeholder="Big Sky, MT"/>
        </Field>
      </Row>
      <Field label="Duration">
        <TextInput value={duration} onChange={e => setDuration(e.target.value)} placeholder="2023–2024"/>
      </Field>
      <Field label="Photo">
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {COVER_KINDS.map(k => (
            <button key={k} onClick={() => setPhotoKind(k)} style={{
              width: 36, height: 36, padding: 0, border: 'none', borderRadius: 4, overflow: 'hidden',
              cursor: 'pointer', boxShadow: photoKind === k ? `0 0 0 2px ${B.accent}` : 'none',
            }}>
              <Photo kind={k} label="" height={36}/>
            </button>
          ))}
        </div>
      </Field>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 8, marginTop: 6,
        cursor: atCap ? 'not-allowed' : 'pointer',
        opacity: atCap ? 0.55 : 1,
      }} title={atCap ? `Cap reached (${featuredCap}). Unfeature another first.` : undefined}>
        <input type="checkbox" checked={featured} disabled={atCap}
          onChange={e => setFeatured(e.target.checked)}
          style={{ accentColor: B.accent }}/>
        <span style={{ color: B.text, fontSize: 13 }}>
          Feature in "Selected work"
          {atCap && (
            <span style={{ color: B.faint, fontSize: 11, marginLeft: 6, fontStyle: 'italic' }}>
              · cap reached ({featuredCap})
            </span>
          )}
        </span>
      </label>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <button onClick={onCancel} style={{
          background: 'transparent', border: 'none', color: B.dim,
          padding: '7px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
        }}>Cancel</button>
        <button onClick={submit} disabled={busy || !title.trim()} style={{
          background: title.trim() ? B.accent : B.surface2,
          color: title.trim() ? '#fff' : B.faint,
          border: 'none', padding: '7px 16px', borderRadius: 100,
          fontSize: 12, fontWeight: 600, cursor: title.trim() ? 'pointer' : 'not-allowed',
        }}>{busy ? 'Adding…' : 'Add jobsite'}</button>
      </div>
    </div>
  );
}

// ── Tab: Credentials ──────────────────────────────────────────────────
function CredentialsTab({ profile, onSaved }) {
  const [unionName, setUnionName] = useState(profile.union?.name || '');
  const [unionSince, setUnionSince] = useState(profile.union?.since || '');
  const [hours, setHours] = useState(profile.apprentice?.hours || 0);
  const [required, setRequired] = useState(profile.apprentice?.required || 8000);
  const [status, setStatus] = useState(profile.apprentice?.status || 'Apprentice');
  const [carrier, setCarrier] = useState(profile.insurance?.carrier || '');
  const [limit, setLimit] = useState(profile.insurance?.limit || '');
  // Insurance doc + share. We track these separately from the rest of the
  // summary form because uploading a doc is a 2-step API dance (upload → patch).
  const [insSharePublic, setInsSharePublic] = useState(!!profile.insurance?.share_public);
  const [insDocUrl, setInsDocUrl] = useState(profile.insurance?.doc_url || null);
  const [insHasDoc, setInsHasDoc] = useState(!!profile.insurance?.has_doc);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [adding, setAdding] = useState(false);

  const saveSummary = async () => {
    setBusy(true);
    try {
      await api.patch('/profiles/me', {
        union_name: unionName.trim() || null,
        union_member_since: unionSince.trim() || null,
        apprentice_hours: parseInt(hours, 10) || 0,
        apprentice_required: parseInt(required, 10) || 8000,
        apprentice_status: status,
        insurance_carrier: carrier.trim() || null,
        insurance_limit: limit.trim() || null,
        insurance_share_public: insSharePublic,
      });
      setSaved(true);
      onSaved?.();
      setTimeout(() => setSaved(false), 2000);
    } finally { setBusy(false); }
  };

  // Insurance doc upload — separate from saveSummary so the user gets
  // immediate feedback (and we don't lose the file if they didn't yet click
  // Save changes).
  const uploadInsuranceDoc = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await api.upload('/credential-docs', fd);
    await api.patch('/profiles/me', {
      insurance_doc_url: res.filename,
      insurance_doc_mime: res.mime,
    });
    setInsHasDoc(true);
    setInsDocUrl(`/api/credential-docs/${res.filename}`);
    onSaved?.();
  };
  const removeInsuranceDoc = async () => {
    if (!confirm('Remove the attached insurance document?')) return;
    await api.patch('/profiles/me', { insurance_doc_url: null, insurance_doc_mime: null });
    setInsHasDoc(false);
    setInsDocUrl(null);
    onSaved?.();
  };

  const removeLicense = async (id) => {
    if (!confirm('Remove this credential?')) return;
    await api.delete(`/profiles/me/licenses/${id}`);
    onSaved?.();
  };

  return (
    <>
      <Card>
        <SectionTitle title="Licenses & certifications"/>
        {profile.licenses.length === 0 && (
          <div style={{ color: B.faint, fontSize: 13, fontStyle: 'italic', padding: '8px 0' }}>
            No credentials yet — add your first.
          </div>
        )}
        {profile.licenses.map(l => (
          <LicenseRow
            key={l.id}
            license={l}
            onRemove={() => removeLicense(l.id)}
            onChange={onSaved}
          />
        ))}

        {!adding && (
          <button onClick={() => setAdding(true)} style={{
            marginTop: 8, width: '100%',
            background: 'transparent', border: `1px dashed ${B.line}`,
            color: B.dim, padding: '12px', borderRadius: 4,
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Icon name="plus" size={14} stroke={2.4}/> Add a credential
          </button>
        )}

        {adding && (
          <AddLicenseForm
            onCancel={() => setAdding(false)}
            onAdded={() => { setAdding(false); onSaved?.(); }}
          />
        )}
      </Card>

      <div style={{ height: 14 }}/>

      <Card>
        <SectionTitle title="Union, apprenticeship, insurance"/>
        <Row>
          <Field label="Union">
            <TextInput value={unionName} onChange={e => setUnionName(e.target.value)} placeholder="e.g. Local 82 — Carpenters"/>
          </Field>
          <Field label="Member since">
            <TextInput value={unionSince} onChange={e => setUnionSince(e.target.value)} placeholder="2008"/>
          </Field>
        </Row>
        <Row>
          <Field label="Apprentice hours">
            <TextInput type="number" value={hours} onChange={e => setHours(e.target.value)}/>
          </Field>
          <Field label="Required">
            <TextInput type="number" value={required} onChange={e => setRequired(e.target.value)}/>
          </Field>
          <Field label="Status">
            <select value={status} onChange={e => setStatus(e.target.value)} style={inputStyle}>
              {['Apprentice', 'Journeyman', 'Master'].map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
        </Row>
        <Row>
          <Field label="Insurance carrier">
            <TextInput value={carrier} onChange={e => setCarrier(e.target.value)} placeholder="e.g. Liberty Mutual"/>
          </Field>
          <Field label="Coverage limit">
            <TextInput value={limit} onChange={e => setLimit(e.target.value)} placeholder="$2M GL"/>
          </Field>
        </Row>

        {/* Insurance COI — file + share toggle. Lives next to carrier/limit since
            it's the same conceptual block. */}
        <div style={{
          marginTop: 10, padding: 14,
          background: B.bg, border: `1px solid ${B.line}`, borderRadius: 4,
        }}>
          <div style={{
            color: B.faint, fontSize: 11, fontStyle: 'italic', marginBottom: 8,
          }}>Certificate of Insurance (optional)</div>
          <DocAttachment
            hasDoc={insHasDoc}
            docUrl={insDocUrl}
            sharePublic={insSharePublic}
            onSharePublicChange={setInsSharePublic}
            onUpload={uploadInsuranceDoc}
            onRemove={removeInsuranceDoc}
          />
        </div>

        <SaveBar saved={saved} busy={busy} onSave={saveSummary}/>
      </Card>
    </>
  );
}

// ── License row in the editor ──────────────────────────────────────────
function LicenseRow({ license, onRemove, onChange }) {
  const [sharePublic, setSharePublic] = useState(!!license.share_public);
  const [hasDoc, setHasDoc] = useState(!!license.has_doc);
  const [docUrl, setDocUrl] = useState(license.doc_url);

  const toggleShare = async (next) => {
    setSharePublic(next);
    try {
      await api.patch(`/profiles/me/licenses/${license.id}`, { share_public: next });
      onChange?.();
    } catch { setSharePublic(!next); }
  };

  const upload = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await api.upload('/credential-docs', fd);
    await api.patch(`/profiles/me/licenses/${license.id}`, {
      doc_url: res.filename, doc_mime: res.mime,
    });
    setHasDoc(true);
    setDocUrl(`/api/credential-docs/${res.filename}`);
    onChange?.();
  };
  const removeDoc = async () => {
    if (!confirm('Remove the attached document? The license stays; just the file goes.')) return;
    await api.patch(`/profiles/me/licenses/${license.id}`, { doc_url: null, doc_mime: null });
    setHasDoc(false);
    setDocUrl(null);
    onChange?.();
  };

  return (
    <div style={{
      background: B.bg, border: `1px solid ${B.line}`, borderRadius: 4,
      padding: '12px 16px', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 4, background: B.accentSoft,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: B.accent, flexShrink: 0,
        }}>
          <Icon name="shield" size={15}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="serif" style={{ color: B.text, fontWeight: 600, fontSize: 14 }}>
            {license.name}
          </div>
          <div style={{ color: B.faint, fontSize: 11 }}>
            {license.number} · Expires {license.expiration}
          </div>
        </div>
        {license.verified && <Icon name="verified" size={16} style={{ color: B.accent }}/>}
        <button onClick={onRemove} style={{ ...miniBtn, color: B.danger }}>
          <Icon name="trash" size={14}/>
        </button>
      </div>

      <div style={{
        marginTop: 10, paddingTop: 10, borderTop: `1px solid ${B.line}`,
      }}>
        <DocAttachment
          hasDoc={hasDoc}
          docUrl={docUrl}
          sharePublic={sharePublic}
          onSharePublicChange={toggleShare}
          onUpload={upload}
          onRemove={removeDoc}
        />
      </div>
    </div>
  );
}

// ── Reusable doc attachment ────────────────────────────────────────────
// Three states:
//   - no doc: show upload-file button
//   - has doc: show "view" link, "replace", "remove", and the share toggle
function DocAttachment({ hasDoc, docUrl, sharePublic, onSharePublicChange, onUpload, onRemove }) {
  const fileRef = React.useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try { await onUpload(file); }
    catch (err) { setError(err.data?.error || 'Upload failed.'); }
    finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      <input
        type="file"
        ref={fileRef}
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        onChange={handleFile}
        style={{ display: 'none' }}
      />

      {!hasDoc && (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{
            background: 'transparent', border: `1px dashed ${B.line}`,
            color: B.dim, padding: '8px 14px', borderRadius: 4,
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
          <Icon name="plus" size={12} stroke={2.4}/>
          {uploading ? 'Uploading…' : 'Attach document (PDF/JPG/PNG, 8 MB max)'}
        </button>
      )}

      {hasDoc && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <a
            href={docUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: B.accent, fontSize: 12, fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Icon name="shield" size={12}/> View document
          </a>
          <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{
            background: 'transparent', border: 'none', color: B.dim,
            fontSize: 12, fontWeight: 500, cursor: 'pointer', padding: 0,
          }}>{uploading ? 'Uploading…' : 'Replace'}</button>
          <button onClick={onRemove} style={{
            background: 'transparent', border: 'none', color: B.danger,
            fontSize: 12, fontWeight: 500, cursor: 'pointer', padding: 0,
          }}>Remove</button>

          <span style={{ flex: 1 }}/>

          <label style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            fontSize: 12, color: sharePublic ? B.text : B.dim,
          }}>
            <input
              type="checkbox"
              checked={sharePublic}
              onChange={e => onSharePublicChange(e.target.checked)}
              style={{ accentColor: B.accent }}
            />
            Share publicly
          </label>
        </div>
      )}

      {error && (
        <div style={{ color: B.danger, fontSize: 12, marginTop: 6 }}>{error}</div>
      )}
    </div>
  );
}

function AddLicenseForm({ onCancel, onAdded }) {
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [exp, setExp] = useState('');
  // Optional doc attached during creation. We upload immediately so the file
  // exists on disk before the license row is created; the resulting filename
  // gets passed in the POST body.
  const [pendingFile, setPendingFile] = useState(null); // File object
  const [pendingFilename, setPendingFilename] = useState(null); // filename after upload
  const [pendingMime, setPendingMime] = useState(null);
  const [sharePublic, setSharePublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = React.useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPendingFile(file);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.upload('/credential-docs', fd);
      setPendingFilename(res.filename);
      setPendingMime(res.mime);
    } catch (err) {
      setError(err.data?.error || 'Upload failed.');
      setPendingFile(null);
    }
  };

  const submit = async () => {
    if (!name.trim() || !number.trim() || !exp.trim()) {
      setError('Name, number, and expiration are required.'); return;
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(exp.trim())) {
      setError('Expiration must be YYYY-MM (e.g. 2027-03).'); return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = {
        name: name.trim(), number: number.trim(), expiration: exp.trim(),
      };
      if (pendingFilename) {
        body.doc_url = pendingFilename;
        body.doc_mime = pendingMime;
        body.share_public = sharePublic;
      }
      await api.post('/profiles/me/licenses', body);
      onAdded?.();
    } catch (e) {
      setError(e.data?.error || 'Could not save.');
    } finally { setBusy(false); }
  };

  return (
    <div style={{
      marginTop: 10, padding: 16,
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
    }} className="fade-in">
      <Field label="Name">
        <TextInput value={name} onChange={e => setName(e.target.value)} placeholder="e.g. MT Contractor License"/>
      </Field>
      <Row>
        <Field label="Number">
          <TextInput value={number} onChange={e => setNumber(e.target.value)} placeholder="CON-MT-44219"/>
        </Field>
        <Field label="Expiration (YYYY-MM)">
          <TextInput value={exp} onChange={e => setExp(e.target.value)} placeholder="2027-03"/>
        </Field>
      </Row>

      <div style={{ marginTop: 6 }}>
        <input
          type="file"
          ref={fileRef}
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
        {!pendingFilename ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{
              background: 'transparent', border: `1px dashed ${B.line}`,
              color: B.dim, padding: '8px 14px', borderRadius: 4,
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            <Icon name="plus" size={12} stroke={2.4}/>
            Attach document (optional · PDF/JPG/PNG, 8 MB max)
          </button>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            padding: '8px 12px', background: B.bg, border: `1px solid ${B.line}`,
            borderRadius: 4,
          }}>
            <Icon name="shield" size={14} style={{ color: B.accent }}/>
            <span style={{ flex: 1, color: B.text, fontSize: 12 }}>
              {pendingFile?.name || 'attached'}
            </span>
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
              fontSize: 12, color: sharePublic ? B.text : B.dim,
            }}>
              <input
                type="checkbox"
                checked={sharePublic}
                onChange={e => setSharePublic(e.target.checked)}
                style={{ accentColor: B.accent }}
              />
              Share publicly
            </label>
            <button type="button" onClick={() => {
              setPendingFile(null); setPendingFilename(null); setPendingMime(null);
              if (fileRef.current) fileRef.current.value = '';
            }} style={{
              background: 'transparent', border: 'none', color: B.dim,
              padding: 4, cursor: 'pointer', display: 'inline-flex',
            }}>
              <Icon name="x" size={12}/>
            </button>
          </div>
        )}
      </div>

      {error && <div style={{ color: B.danger, fontSize: 12, marginTop: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <button onClick={onCancel} style={{
          background: 'transparent', border: 'none', color: B.dim,
          padding: '7px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
        }}>Cancel</button>
        <button onClick={submit} disabled={busy} style={{
          background: B.text, border: 'none', color: B.surface,
          padding: '7px 16px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>{busy ? 'Saving…' : 'Add'}</button>
      </div>
    </div>
  );
}

// ── Shared bits ───────────────────────────────────────────────────────
const Card = ({ children }) => (
  <div style={{
    background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
    padding: '28px 32px',
  }}>{children}</div>
);

const SectionTitle = ({ title, sub }) => (
  <div style={{ marginBottom: 16 }}>
    <h2 className="serif" style={{
      margin: 0, fontSize: 18, fontWeight: 600,
      color: B.text, letterSpacing: '-0.01em',
    }}>{title}</h2>
    {sub && <p style={{ margin: '4px 0 0', color: B.dim, fontSize: 13 }}>{sub}</p>}
  </div>
);

const Field = ({ label, children }) => (
  <div style={{ marginBottom: 14, flex: 1, minWidth: 0 }}>
    <Label>{label}</Label>
    {children}
  </div>
);
const Row = ({ children }) => (
  <div style={{ display: 'flex', gap: 12 }}>{children}</div>
);
const Label = ({ children }) => (
  <label style={{
    color: B.dim, fontSize: 12, fontStyle: 'italic',
    display: 'block', marginBottom: 6,
  }}>{children}</label>
);
const inputStyle = {
  width: '100%', background: B.bg, border: `1px solid ${B.line}`,
  borderRadius: 4, padding: '10px 12px', fontSize: 14, color: B.text,
  fontFamily: 'inherit', outline: 'none',
};
const TextInput = (props) => (
  <input {...props} style={{ ...inputStyle, ...(props.style || {}) }}/>
);
const miniBtn = {
  background: 'transparent', border: `1px solid ${B.line}`, color: B.dim,
  padding: '6px 8px', borderRadius: 4, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center',
};
const SaveBar = ({ saved, busy, onSave }) => (
  <div style={{
    marginTop: 18, paddingTop: 18, borderTop: `1px solid ${B.line}`,
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12,
  }}>
    {saved && (
      <span style={{
        color: B.accent, fontSize: 12, fontStyle: 'italic',
        display: 'inline-flex', alignItems: 'center', gap: 4,
      }} className="fade-in">
        <Icon name="check" size={13} stroke={2.4}/> Saved
      </span>
    )}
    <button onClick={onSave} disabled={busy} style={{
      background: B.text, border: 'none', color: B.surface,
      padding: '10px 22px', borderRadius: 100, fontSize: 13, fontWeight: 600,
      cursor: busy ? 'not-allowed' : 'pointer',
    }}>{busy ? 'Saving…' : 'Save changes'}</button>
  </div>
);
