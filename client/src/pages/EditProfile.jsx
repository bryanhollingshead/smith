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
import { api, auth } from '../lib/api.js';
import { useRouter } from '../lib/router.jsx';
import { useAuth } from '../lib/AuthContext.jsx';
import { suggestSkills } from '../lib/trade-skills.js';
import { STRUCTURE_TYPES, orderedJobTypeCategories, suggestJobsiteName } from '../lib/job-types.js';
import { FEATURE_JOBS } from '../lib/flags.js';
import { PhotoUpload } from '../components/PhotoUpload.jsx';
import { SmithAvatar } from '../components/SmithAvatar.jsx';
import { ResumeImportWizard } from '../components/ResumeImportWizard.jsx';
import { VisibilityCard } from '../components/VisibilityCard.jsx';

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
  const [wizardOpen, setWizardOpen] = useState(false);

  const load = useCallback(async () => {
    const { profile } = await api.get('/profiles/me');
    setProfile(profile);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaved = async () => {
    await load();
    await refresh();
  };

  // Photo uploads update local state immediately for snappy feedback. They
  // also call onSaved so the rest of the app (TopNav avatar, etc.) refetches.
  const handleAvatarChanged = (urls) => {
    setProfile(p => p ? { ...p, avatar_urls: urls } : p);
    handleSaved();
  };
  const handleCoverChanged = (urls) => {
    setProfile(p => p ? { ...p, cover_urls: urls } : p);
    handleSaved();
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

        {/* Resume import CTA — fast path for users who already have a resume. */}
        {FEATURE_JOBS && (
          <>
            <div style={{
              background: B.surface, border: `1px solid ${B.line}`, borderRadius: 6,
              padding: '14px 18px', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', gap: 12, marginBottom: 18,
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: B.text }}>
                  Have a resume? Drop it in.
                </div>
                <div style={{ fontSize: 12, color: B.dim, marginTop: 2 }}>
                  PDF upload pre-fills your trades, work history, credentials, and skills. Review before saving.
                </div>
              </div>
              <button onClick={() => setWizardOpen(true)} style={{
                background: B.text, color: B.surface, border: 'none',
                padding: '9px 18px', borderRadius: 100, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}>Import resume</button>
            </div>

            {wizardOpen && (
              <ResumeImportWizard
                onClose={() => setWizardOpen(false)}
                onComplete={handleSaved}
              />
            )}
          </>
        )}

        <VisibilityCard
          visibility={profile.visibility}
          onChange={(v) => setProfile(p => p ? { ...p, visibility: v } : p)}
        />

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

        {tab === 'header' && (
          <HeaderTab
            profile={profile}
            onSaved={handleSaved}
            onAvatarChanged={handleAvatarChanged}
            onCoverChanged={handleCoverChanged}
          />
        )}
        {tab === 'trades' && <TradesAndSkillsTab profile={profile} onSaved={handleSaved}/>}
        {tab === 'work' && <WorkHistoryTab profile={profile} onSaved={handleSaved} focus={focus}/>}
        {tab === 'credentials' && <CredentialsTab profile={profile} onSaved={handleSaved}/>}

        <DangerZone/>
      </main>
    </div>
  );
}

// ── Danger zone (account deletion) ─────────────────────────────────────────
// Self-serve permanent deletion. Server enforces password reverify +
// only-admin-remaining safety; the UI side just makes the action visually
// distinct and adds typed-confirmation friction.
function DangerZone() {
  const [open, setOpen] = useState(false);
  return (
    <section style={{
      marginTop: 56, padding: '20px 22px',
      background: B.surface, border: `1px solid ${B.danger}`, borderRadius: 8,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap',
      }}>
        <div>
          <h3 className="serif" style={{
            margin: 0, fontSize: 16, fontWeight: 600, color: B.danger,
          }}>Delete account</h3>
          <p style={{ color: B.dim, fontSize: 12.5, margin: '4px 0 0', lineHeight: 1.5 }}>
            Removes your profile, posts, connections, messages, and any homes
            you've claimed. Permanent — there is no undo.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          style={{
            background: B.surface, color: B.danger,
            border: `1px solid ${B.danger}`, borderRadius: 100,
            padding: '9px 16px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
          Delete my account…
        </button>
      </div>
      {open && <DeleteAccountModal onClose={() => setOpen(false)}/>}
    </section>
  );
}

function DeleteAccountModal({ onClose }) {
  const { signOut } = useAuth();
  const { navigate } = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const ready = confirmation === 'delete my account' && password.length > 0 && !busy;

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await api.delete('/auth/me', { password, confirmation });
      // Token is now bound to a deleted user — clear it and route to landing.
      signOut();
      navigate('/');
    } catch (e) {
      setErr(e.data?.error || e.message || 'Could not delete account.');
      setBusy(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, padding: 20,
      }}>
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={onSubmit}
        style={{
          background: B.surface, border: `1px solid ${B.line}`, borderRadius: 8,
          padding: 24, minWidth: 440, maxWidth: 520,
          boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
        }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: B.danger }}>
          Delete your account?
        </h3>
        <p style={{ color: B.dim, fontSize: 13, lineHeight: 1.55, margin: '8px 0 16px' }}>
          This will permanently remove your account and every record attached
          to it. There is no undo.
        </p>

        <label style={{ display: 'block', fontSize: 12, color: B.dim, fontWeight: 600 }}>
          Your password
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            style={{
              width: '100%', marginTop: 4, padding: '8px 10px',
              border: `1px solid ${B.line}`, borderRadius: 4, background: B.surface,
              color: B.text, fontSize: 13,
            }}
            required
          />
        </label>
        <label style={{ display: 'block', fontSize: 12, color: B.dim, fontWeight: 600, marginTop: 12 }}>
          Type <span style={{ color: B.danger, fontFamily: 'monospace' }}>delete my account</span> to confirm
          <input
            type="text"
            value={confirmation}
            onChange={e => setConfirmation(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            style={{
              width: '100%', marginTop: 4, padding: '8px 10px',
              border: `1px solid ${B.line}`, borderRadius: 4, background: B.surface,
              color: B.text, fontSize: 13, fontFamily: 'monospace',
            }}
          />
        </label>

        {err && <div style={{ color: B.danger, fontSize: 12, marginTop: 10 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              background: 'transparent', color: B.text,
              border: `1px solid ${B.line}`, borderRadius: 100,
              padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={!ready}
            style={{
              background: ready ? B.danger : B.faint, color: '#fff', border: 'none',
              borderRadius: 100, padding: '9px 16px',
              fontSize: 13, fontWeight: 700,
              cursor: ready ? 'pointer' : 'not-allowed',
              opacity: ready ? 1 : 0.6,
            }}>
            {busy ? 'Deleting…' : 'Delete account permanently'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Tab: Header & about ───────────────────────────────────────────────
function HeaderTab({ profile, onSaved, onAvatarChanged, onCoverChanged }) {
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

  const initials = ((first[0] || '') + (last[0] || '')).toUpperCase() || profile.initials;
  const hasAvatarPhoto = !!profile.avatar_urls;
  const hasCoverPhoto = !!profile.cover_urls;

  return (
    <Card>
      {/* ── Profile photo + cover upload ─────────────────────────────────
          Two upload widgets side-by-side. The PhotoUpload component handles
          the upload mechanics (progress, errors, delete); we just supply
          the preview render. */}
      <div style={{
        display: 'flex', gap: 32, marginBottom: 28, alignItems: 'flex-start',
        flexWrap: 'wrap',
      }}>
        {/* Avatar */}
        <div style={{ minWidth: 200 }}>
          <Label>Profile photo</Label>
          <PhotoUpload
            kind="avatar"
            currentUrls={profile.avatar_urls}
            onChange={onAvatarChanged}
            label={hasAvatarPhoto ? 'Replace photo' : 'Upload photo'}
            preview={(urls) => (
              <div style={{ marginBottom: 4 }}>
                <SmithAvatar
                  urls={urls}
                  initials={initials}
                  tone={tone}
                  size={104}
                />
              </div>
            )}
          />
        </div>

        {/* Cover */}
        <div style={{ flex: 1, minWidth: 280 }}>
          <Label>Cover photo</Label>
          <PhotoUpload
            kind="cover"
            currentUrls={profile.cover_urls}
            onChange={onCoverChanged}
            label={hasCoverPhoto ? 'Replace cover' : 'Upload cover'}
            preview={(urls) => (
              <div style={{
                width: '100%', height: 132, marginBottom: 4,
                borderRadius: 4, overflow: 'hidden',
                border: `1px solid ${B.line}`,
                background: urls?.medium
                  ? `center/cover url("${urls.medium}") no-repeat`
                  : B.surface2,
                position: 'relative',
              }}>
                {!urls && (
                  // Fall back to the gradient placeholder using the chosen cover kind.
                  <Photo kind={cover} label="" height={130}/>
                )}
              </div>
            )}
          />
        </div>
      </div>

      {/* ── Cover-kind picker (used only when no cover photo uploaded) ─── */}
      {!hasCoverPhoto && (
        <div style={{ marginBottom: 22 }}>
          <Label>Cover style (used until you upload a photo)</Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
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
      )}

      {/* ── Avatar-tone picker (used only when no avatar photo uploaded) ── */}
      {!hasAvatarPhoto && (
        <div style={{ marginBottom: 22 }}>
          <Label>Avatar tone (used until you upload a photo)</Label>
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
      )}

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
            placeholder="e.g. Salt Lake City, UT"
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

  // The user's primary trade (first in their ordered trades list) drives
  // which job-type categories sort to the top of the jobsite picker.
  const primaryTrade = profile.trades?.[0]?.name || null;

  // Deep-link handler: scroll + pulse + auto-open the right control.
  useEffect(() => {
    if (focus !== 'add-company') return;
    setAdding(true);
    const t = setTimeout(() => {
      addCompanyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const el = addCompanyRef.current;
      if (!el) return;
      el.classList.add('pulse');
      setTimeout(() => el.classList.remove('pulse'), 3200);
    }, 60);
    return () => clearTimeout(t);
  }, [focus]);

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
            primaryTrade={primaryTrade}
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

function CompanyEditor({ co, onChanged, focusAddJobsite, featuredCount, featuredCap, primaryTrade }) {
  const [open, setOpen] = useState(false);
  const [addingSite, setAddingSite] = useState(false);
  // Patch: track which jobsite (if any) is currently being edited inline.
  // Only one row can be in edit mode at a time per company to keep the UI
  // calm. Use the jobsite's id as the active value; null means "no row is
  // being edited."
  const [editingSiteId, setEditingSiteId] = useState(null);
  const addJobsiteRef = React.useRef(null);

  useEffect(() => {
    if (!focusAddJobsite) return;
    setOpen(true);
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

  const toggleOwner = async () => {
    await api.patch(`/work-history/${co.id}`, { is_owner: !co.is_owner });
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
        <CompanyLogoMark
          urls={co.company_logo_urls}
          size={38}
          companyId={co.company_id}
          onChanged={onChanged}
        />
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
          {co.is_current && (
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              marginTop: 6, marginBottom: 12, padding: '8px 10px',
              background: co.is_owner ? B.accentSoft : B.surface,
              border: `1px solid ${co.is_owner ? B.accent : B.line}`,
              borderRadius: 4, cursor: 'pointer',
            }}>
              <input type="checkbox" checked={!!co.is_owner} onChange={toggleOwner}
                style={{ accentColor: B.accent, marginTop: 3 }}/>
              <span style={{ color: B.text, fontSize: 12.5, lineHeight: 1.4 }}>
                I own or co-own {co.company_name}
                <div style={{ color: B.faint, fontSize: 11, marginTop: 2, fontStyle: 'italic' }}>
                  Lists you as an owner on the company profile and unlocks profile edit rights.
                </div>
              </span>
            </label>
          )}
          <div style={{
            color: B.faint, fontSize: 11, fontStyle: 'italic',
            marginTop: 8, marginBottom: 8,
          }}>Jobsites</div>
          {co.jobsites.length === 0 && (
            <div style={{ color: B.faint, fontSize: 12, fontStyle: 'italic', padding: '6px 0' }}>
              No jobsites yet under this company.
            </div>
          )}
          {co.jobsites.map(js => {
            // Patch: render inline edit form in place of the row when this
            // jobsite is the one being edited. Otherwise show the normal
            // row with action buttons including a new Edit affordance.
            if (editingSiteId === js.id) {
              return (
                <JobsiteForm
                  key={`edit-${js.id}`}
                  mode="edit"
                  existing={js}
                  primaryTrade={primaryTrade}
                  // Gallery photo edits persist immediately (separate
                  // endpoints), so reload on close too — keeps the row
                  // thumbnail in sync whether the user saves or cancels.
                  onCancel={() => { setEditingSiteId(null); onChanged?.(); }}
                  onSaved={() => { setEditingSiteId(null); onChanged?.(); }}
                  featuredCount={featuredCount}
                  featuredCap={featuredCap}
                />
              );
            }
            return (
              <div key={js.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
                padding: '8px 12px', marginBottom: 6,
              }}>
                <JobsitePhotoCell jobsite={js} onChanged={onChanged}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="serif" style={{ color: B.text, fontSize: 13, fontWeight: 600 }}>
                    {js.title}
                  </div>
                  <div style={{ color: B.dim, fontSize: 11 }}>
                    {[
                      [js.structure_type, js.job_type].filter(Boolean).join(' · ') || js.kind,
                      js.location,
                      js.year || js.duration,
                    ].filter(Boolean).join(' · ')}
                  </div>
                </div>
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
                {/* Patch: Edit button. Opens the jobsite row in edit mode,
                    swapping the static row for a pre-filled form. */}
                <button
                  onClick={() => {
                    setEditingSiteId(js.id);
                    // If user clicks edit while adding a new one, cancel the add.
                    setAddingSite(false);
                  }}
                  title="Edit this jobsite"
                  style={{ ...miniBtn, color: B.dim }}>
                  <svg width={14} height={14} viewBox="0 0 24 24"
                       fill="none" stroke="currentColor" strokeWidth="1.8"
                       strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9"/>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                  </svg>
                </button>
                <button onClick={() => removeJobsite(js.id)} style={{ ...miniBtn, color: B.danger }}>
                  <Icon name="trash" size={13}/>
                </button>
              </div>
            );
          })}
          <div ref={addJobsiteRef} style={{ display: 'inline-block' }}>
            {!addingSite && (
              <button onClick={() => {
                setAddingSite(true);
                // If user clicks add while editing another, cancel the edit.
                setEditingSiteId(null);
              }} style={{
                marginTop: 8, background: 'transparent', border: `1px dashed ${B.line}`,
                color: B.dim, padding: '8px 14px', borderRadius: 4, fontSize: 12, fontWeight: 500,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <Icon name="plus" size={12} stroke={2.4}/> Add a jobsite
              </button>
            )}
            {addingSite && (
              <JobsiteForm
                mode="add"
                workId={co.id}
                primaryTrade={primaryTrade}
                onCancel={() => setAddingSite(false)}
                onSaved={() => { setAddingSite(false); onChanged?.(); }}
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
  const [name, setName] = useState('');
  const [picked, setPicked] = useState(null);
  const [createNew, setCreateNew] = useState(false);
  const [matches, setMatches] = useState(null);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const [type, setType] = useState('General Contractor');
  const [role, setRole] = useState('');
  const [fromYear, setFromYear] = useState('');
  const [toYear, setToYear] = useState('');
  const [current, setCurrent] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Pending logo file (only used when creating a new company). Uploaded
  // after the company row is created — same pattern as jobsite photo.
  const [pendingLogo, setPendingLogo] = useState(null);
  const [pendingLogoPreview, setPendingLogoPreview] = useState(null);
  const logoFileRef = React.useRef(null);

  useEffect(() => {
    if (!pendingLogoPreview) return;
    return () => URL.revokeObjectURL(pendingLogoPreview);
  }, [pendingLogoPreview]);

  const handleLogoFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPendingLogo(file);
    if (pendingLogoPreview) URL.revokeObjectURL(pendingLogoPreview);
    setPendingLogoPreview(URL.createObjectURL(file));
  };

  const clearLogo = () => {
    setPendingLogo(null);
    if (pendingLogoPreview) URL.revokeObjectURL(pendingLogoPreview);
    setPendingLogoPreview(null);
    if (logoFileRef.current) logoFileRef.current.value = '';
  };

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
      let companyId = picked?.id;
      let newCompany = !companyId;
      if (!companyId) {
        const { company } = await api.post('/companies', {
          name: name.trim(), type, claim: false,
        });
        companyId = company.id;
      }

      // Upload the logo if one was attached. Only happens for new companies
      // (for picked ones, the logo belongs to the company itself, not this
      // user's tenure — they can edit it from the company page later).
      if (newCompany && pendingLogo && companyId) {
        try {
          const fd = new FormData();
          fd.append('file', pendingLogo);
          await api.upload(`/photos/company/${companyId}/logo`, fd);
        } catch (logoErr) {
          // Surface a soft warning — company + work-history still got created.
          setError('Company added, but logo upload failed: ' + (logoErr.data?.error || logoErr.message));
        }
      }

      await api.post('/work-history', {
        company_id: companyId,
        role: role.trim(),
        from_year: fromYear.trim(),
        to_year: current ? null : toYear.trim() || null,
        is_current: current,
        is_owner: current && isOwner,
      });
      onAdded?.();
    } catch (e) {
      setError(e.data?.error || 'Could not save.');
    } finally { setBusy(false); }
  };

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
              setName(e.target.value);
              if (picked) setPicked(null);
              if (createNew) setCreateNew(false);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="e.g. Wasatch Build Co."
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

      {(createNew || (!picked && name.trim().length >= 2 && matches?.length === 0)) && !picked && (
        <>
          <Field label="Company type (we'll create this company)">
            <select value={type} onChange={e => setType(e.target.value)} style={inputStyle}>
              {['General Contractor', 'Sub · Carpentry', 'Sub · Electrical', 'Sub · Plumbing', 'Sub · Concrete', 'Sub · Roofing', 'Sub · HVAC', 'Sub · Other', 'Architect', 'Independent', 'Other'].map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Field>
          {/* ── Optional logo for the new company ────────────────
              Uploaded after the company row is created. */}
          <Field label="Company logo (optional)">
            <input
              type="file"
              ref={logoFileRef}
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              onChange={handleLogoFile}
              style={{ display: 'none' }}
            />
            {!pendingLogoPreview ? (
              <button
                type="button"
                onClick={() => logoFileRef.current?.click()}
                style={{
                  width: '100%', padding: 12,
                  background: 'transparent', border: `1px dashed ${B.line}`,
                  borderRadius: 4, color: B.text,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                <Icon name="image" size={14} style={{ color: B.accent }}/>
                Upload a logo from device
              </button>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', background: B.bg,
                border: `1px solid ${B.line}`, borderRadius: 4,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', overflow: 'hidden',
                  background: `center/cover url("${pendingLogoPreview}") no-repeat`,
                  flexShrink: 0,
                }}/>
                <span style={{ flex: 1, color: B.text, fontSize: 12 }}>
                  {pendingLogo?.name || 'logo'} · will upload after the company is created
                </span>
                <button type="button" onClick={clearLogo} style={{
                  background: 'transparent', border: 'none', color: B.dim,
                  padding: 4, cursor: 'pointer', display: 'inline-flex',
                }}>
                  <Icon name="x" size={12}/>
                </button>
              </div>
            )}
          </Field>
        </>
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

      {current && (
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 8, cursor: 'pointer',
        }}>
          <input type="checkbox" checked={isOwner} onChange={e => setIsOwner(e.target.checked)}
            style={{ accentColor: B.accent, marginTop: 3 }}/>
          <span style={{ color: B.text, fontSize: 13, lineHeight: 1.4 }}>
            I own or co-own this company
            <div style={{ color: B.faint, fontSize: 11, marginTop: 2, fontStyle: 'italic' }}>
              Asserting ownership lists you on the company profile as an owner and grants edit rights.
            </div>
          </span>
        </label>
      )}

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

// ── Jobsite form (add + edit) ─────────────────────────────────────────
//
// Handles both adding a new jobsite under a company and editing an existing
// one inline within the work-history list.
//
// New schema (migration 008):
//   - title          — required; ghost-suggested from location + job type
//   - structure_type — required picker (Single-family, Remodel, …)
//   - job_type       — required picker, trade-aware ordering (nothing hidden)
//   - location       — free text
//   - year           — single year (replaces the old freeform "duration")
//   - photos         — multi-photo gallery; first = primary, reorderable
//
// Props:
//   mode          — 'add' | 'edit'  (defaults to 'add')
//   workId        — required in 'add' mode; the work_history row id
//   existing      — required in 'edit' mode; the jobsite object
//   primaryTrade  — the user's primary trade name; sorts matching job types
//                   to the top of the picker
//   onCancel      — dismiss handler
//   onSaved       — called after a successful save
//   featuredCount / featuredCap — enforce the 10-jobsite "Selected work" cap
//
// Photo behavior differs by mode:
//   - ADD:  photos are staged locally (File + preview) and uploaded in order
//           after the jobsite row is created.
//   - EDIT: the jobsite exists, so each add/remove/reorder hits the gallery
//           endpoints immediately. The primary mirror + row thumbnail resync
//           on close (CompanyEditor reloads on both save and cancel).
//
// Legacy rows (pre-008) keep their freeform kind/duration in the DB; the
// display falls back to them. Editing such a row asks the user to pick the
// new structured fields before saving.
function JobsiteForm({
  mode = 'add',
  workId,
  existing,
  primaryTrade = null,
  onCancel,
  onSaved,
  featuredCount = 0,
  featuredCap = 10,
}) {
  const isEdit = mode === 'edit' && existing;

  // ── Structured fields ──────────────────────────────────────────────
  const [title, setTitle] = useState(isEdit ? (existing.title || '') : '');
  const [structureType, setStructureType] = useState(isEdit ? (existing.structure_type || '') : '');
  const [jobType, setJobType] = useState(isEdit ? (existing.job_type || '') : '');
  const [location, setLocation] = useState(isEdit ? (existing.location || '') : '');
  const [year, setYear] = useState(isEdit ? (existing.year ? String(existing.year) : '') : '');
  const [photoKind, setPhotoKind] = useState(isEdit ? (existing.photo_kind || 'frame') : 'frame');
  const [featured, setFeatured] = useState(isEdit ? !!existing.is_featured : false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Job-type categories sorted so the user's primary trade floats to the top.
  const jobCategories = React.useMemo(
    () => orderedJobTypeCategories(primaryTrade), [primaryTrade]
  );

  // Ghost-suggested name from the structured fields. Shown in the placeholder
  // until the user types their own.
  const nameSuggestion = suggestJobsiteName({ location, structureType, jobType });

  // The featured cap only applies when ENABLING featured on a jobsite that
  // isn't already featured. Already-featured rows can always re-save featured.
  const wasFeatured = isEdit && !!existing.is_featured;
  const atCap = !wasFeatured && featuredCount >= featuredCap;

  // ── Photo gallery ──────────────────────────────────────────────────
  // EDIT mode: live server-backed gallery — each add/remove/reorder hits the
  //   gallery endpoints immediately and updates `photos` from the response.
  // ADD  mode: photos are staged locally (`pending`) and uploaded in order
  //   after the new jobsite row is created.
  const [photos, setPhotos] = useState(isEdit ? (existing.photos || []) : []); // [{id, urls, position}]
  const [pending, setPending] = useState([]); // add-mode staged: [{ key, file, url }]
  const [galleryBusy, setGalleryBusy] = useState(false);
  const fileRef = React.useRef(null);
  const pendingKey = React.useRef(0);

  // Revoke staged object URLs on unmount. A ref mirrors the latest `pending`
  // so the cleanup (which runs once) sees the final list.
  const pendingRef = React.useRef([]);
  useEffect(() => { pendingRef.current = pending; }, [pending]);
  useEffect(() => () => pendingRef.current.forEach(p => URL.revokeObjectURL(p.url)), []);

  const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

  // Pick one or more files. Edit mode uploads them immediately (in order);
  // add mode stages them locally.
  const onPickFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (fileRef.current) fileRef.current.value = '';
    if (!files.length) return;
    setError(null);
    if (isEdit) {
      setGalleryBusy(true);
      try {
        let latest = photos;
        for (const file of files) {
          const fd = new FormData();
          fd.append('file', file);
          const res = await api.upload(`/photos/jobsite/${existing.id}`, fd);
          if (res?.photos) latest = res.photos;
        }
        setPhotos(latest);
      } catch (err) {
        setError(err.data?.error || 'Photo upload failed.');
      } finally { setGalleryBusy(false); }
    } else {
      setPending(ps => [
        ...ps,
        ...files.map(file => ({ key: ++pendingKey.current, file, url: URL.createObjectURL(file) })),
      ]);
    }
  };

  const removeLivePhoto = async (photoId) => {
    setGalleryBusy(true);
    setError(null);
    try {
      const res = await api.delete(`/photos/jobsite/${existing.id}/photo/${photoId}`);
      setPhotos(res?.photos || []);
    } catch (err) {
      setError(err.data?.error || 'Could not remove photo.');
    } finally { setGalleryBusy(false); }
  };

  const moveLivePhoto = async (index, dir) => {
    const j = index + dir;
    if (j < 0 || j >= photos.length) return;
    const prev = photos;
    const next = [...photos];
    [next[index], next[j]] = [next[j], next[index]];
    setPhotos(next); // optimistic
    setGalleryBusy(true);
    setError(null);
    try {
      const res = await api.patch(`/photos/jobsite/${existing.id}/photos`, {
        order: next.map(p => p.id),
      });
      setPhotos(res?.photos || next);
    } catch (err) {
      setError(err.data?.error || 'Could not reorder.');
      setPhotos(prev); // revert
    } finally { setGalleryBusy(false); }
  };

  const removePending = (key) => {
    setPending(ps => {
      const hit = ps.find(p => p.key === key);
      if (hit) URL.revokeObjectURL(hit.url);
      return ps.filter(p => p.key !== key);
    });
  };

  const movePending = (index, dir) => {
    setPending(ps => {
      const j = index + dir;
      if (j < 0 || j >= ps.length) return ps;
      const next = [...ps];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  // Required: structure + job type, plus a name (the suggestion counts).
  const finalTitle = (title.trim() || nameSuggestion).trim();
  const canSave = !!finalTitle && !!structureType && !!jobType;

  // Save handler — branches on mode. Photos in edit mode are already
  // persisted via the gallery endpoints; here we only save the text fields.
  const submit = async () => {
    if (!finalTitle) { setError('Give the jobsite a name.'); return; }
    if (!structureType) { setError('Pick a structure type.'); return; }
    if (!jobType) { setError('Pick a job type.'); return; }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        title: finalTitle,
        structure_type: structureType,
        job_type: jobType,
        location: location.trim(),
        year: year.trim(),
        photo_kind: photoKind,
        is_featured: featured,
      };

      if (isEdit) {
        await api.patch(`/jobsites/${existing.id}`, payload);
      } else {
        const { jobsite } = await api.post(`/work-history/${workId}/jobsites`, payload);
        const jobsiteId = jobsite?.id;
        // Upload staged photos in order. A single failure is surfaced but we
        // still finish — the row is saved and other photos may have uploaded.
        if (jobsiteId && pending.length) {
          for (const p of pending) {
            try {
              const fd = new FormData();
              fd.append('file', p.file);
              await api.upload(`/photos/jobsite/${jobsiteId}`, fd);
            } catch (photoErr) {
              setError('Jobsite added, but a photo failed to upload: ' +
                (photoErr.data?.error || photoErr.message));
            }
          }
        }
      }

      onSaved?.();
    } catch (e) {
      setError(e.data?.error || (isEdit ? 'Could not update jobsite.' : 'Could not save jobsite.'));
    } finally { setBusy(false); }
  };

  // Header text + button labels differ between modes.
  const formTitle = isEdit ? 'Edit jobsite' : null;
  const saveLabel = isEdit
    ? (busy ? 'Saving…' : 'Save changes')
    : (busy ? 'Adding…' : 'Add jobsite');

  // Unified gallery items for rendering (live photos in edit, staged in add).
  const galleryItems = isEdit
    ? photos.map(p => ({
        key: `live-${p.id}`,
        src: p.urls?.medium || p.urls?.thumb || p.urls?.full,
        onRemove: () => removeLivePhoto(p.id),
      }))
    : pending.map(p => ({
        key: `pending-${p.key}`,
        src: p.url,
        onRemove: () => removePending(p.key),
      }));
  const moveItem = isEdit ? moveLivePhoto : movePending;
  const galleryCount = galleryItems.length;

  return (
    <div style={{
      marginTop: 10, padding: 14,
      background: B.bg, border: `1px solid ${B.line}`, borderRadius: 4,
    }} className="fade-in">
      {formTitle && (
        <div className="serif" style={{
          color: B.text, fontWeight: 600, fontSize: 14,
          marginBottom: 12, letterSpacing: '-0.01em',
        }}>{formTitle}</div>
      )}

      {/* Structure + job type drive the name suggestion, so they come first. */}
      <Row>
        <Field label="Structure type">
          <select value={structureType} onChange={e => setStructureType(e.target.value)} style={inputStyle}>
            <option value="" disabled>Select…</option>
            {STRUCTURE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Job type">
          <select value={jobType} onChange={e => setJobType(e.target.value)} style={inputStyle}>
            <option value="" disabled>Select…</option>
            {jobCategories.map(cat => (
              <optgroup key={cat.label} label={cat.label}>
                {cat.jobs.map(j => <option key={`${cat.label}-${j}`} value={j}>{j}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
      </Row>

      <Row>
        <Field label="Location">
          <TextInput value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Holladay, UT"/>
        </Field>
        <Field label="Year">
          <TextInput
            value={year}
            onChange={e => setYear(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
            placeholder="2024"
            inputMode="numeric"
          />
        </Field>
      </Row>

      <Field label="Jobsite name">
        <TextInput
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={nameSuggestion ? `${nameSuggestion}` : 'e.g. Holladay service upgrade'}
        />
        {nameSuggestion && !title.trim() && (
          <button
            type="button"
            onClick={() => setTitle(nameSuggestion)}
            style={{
              marginTop: 6, background: 'transparent', border: `1px solid ${B.line}`,
              color: B.dim, padding: '4px 10px', borderRadius: 100, fontSize: 11,
              fontWeight: 500, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            <Icon name="plus" size={10} stroke={2.4} style={{ color: B.accent }}/>
            Use “{nameSuggestion}”
          </button>
        )}
      </Field>

      {/* ── Photos gallery ──────────────────────────────────────────
          First photo = primary. Reorder with the ◂ ▸ arrows. In add mode
          photos are staged and upload after save; in edit mode each change
          saves immediately. */}
      <Field label={
        galleryCount > 0
          ? 'Photos — first is the primary; reorder with the arrows'
          : 'Photos'
      }>
        <input
          type="file"
          ref={fileRef}
          accept={ACCEPT}
          multiple
          onChange={onPickFiles}
          style={{ display: 'none' }}
        />
        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start',
        }}>
          {galleryItems.map((item, i) => (
            <div key={item.key} style={{
              position: 'relative', width: 96, height: 68, borderRadius: 4,
              overflow: 'hidden', border: `1px solid ${i === 0 ? B.accent : B.line}`,
              background: item.src
                ? `center/cover url("${item.src}") no-repeat`
                : B.surface2,
              flexShrink: 0,
            }}>
              {i === 0 && (
                <span style={{
                  position: 'absolute', top: 0, left: 0,
                  background: B.accent, color: '#fff', fontSize: 9, fontWeight: 700,
                  padding: '2px 6px', borderBottomRightRadius: 4, letterSpacing: '0.02em',
                }}>PRIMARY</span>
              )}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                display: 'flex', justifyContent: 'center', gap: 2, padding: 2,
                background: 'linear-gradient(transparent, rgba(0,0,0,0.55))',
              }}>
                <button type="button" disabled={galleryBusy || i === 0}
                  onClick={() => moveItem(i, -1)} title="Move left"
                  style={galleryCtrlBtn(galleryBusy || i === 0)}>
                  <Icon name="chevron-l" size={12}/>
                </button>
                <button type="button" disabled={galleryBusy || i === galleryCount - 1}
                  onClick={() => moveItem(i, 1)} title="Move right"
                  style={galleryCtrlBtn(galleryBusy || i === galleryCount - 1)}>
                  <Icon name="chevron-r" size={12}/>
                </button>
                <button type="button" disabled={galleryBusy}
                  onClick={item.onRemove} title="Remove"
                  style={galleryCtrlBtn(galleryBusy)}>
                  <Icon name="x" size={12}/>
                </button>
              </div>
            </div>
          ))}

          {/* Add tile */}
          <button
            type="button"
            onClick={() => !galleryBusy && fileRef.current?.click()}
            disabled={galleryBusy}
            style={{
              width: 96, height: 68, borderRadius: 4,
              border: `1px dashed ${B.line}`, background: 'transparent',
              color: B.dim, cursor: galleryBusy ? 'wait' : 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 4, flexShrink: 0,
            }}>
            <Icon name={galleryBusy ? 'image' : 'plus'} size={16} stroke={2.2} style={{ color: B.accent }}/>
            <span style={{ fontSize: 10, fontWeight: 600 }}>
              {galleryBusy ? 'Uploading…' : (galleryCount ? 'Add more' : 'Add photos')}
            </span>
          </button>
        </div>
        {!isEdit && pending.length > 0 && (
          <div style={{ color: B.faint, fontSize: 11, fontStyle: 'italic', marginTop: 6 }}>
            {pending.length} photo{pending.length === 1 ? '' : 's'} will upload after you save.
          </div>
        )}
      </Field>

      {/* Placeholder style — used in displays when a jobsite has no photo. */}
      <Field label="Placeholder style (shown when there's no photo)">
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

      {error && <div style={{ color: B.danger, fontSize: 12, marginTop: 10 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <button onClick={onCancel} style={{
          background: 'transparent', border: 'none', color: B.dim,
          padding: '7px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
        }}>Cancel</button>
        <button onClick={submit} disabled={busy || !canSave} style={{
          background: canSave ? B.accent : B.surface2,
          color: canSave ? '#fff' : B.faint,
          border: 'none', padding: '7px 16px', borderRadius: 100,
          fontSize: 12, fontWeight: 600, cursor: canSave ? 'pointer' : 'not-allowed',
        }}>{saveLabel}</button>
      </div>
    </div>
  );
}

// Small control button used on gallery thumbnails (move/remove).
const galleryCtrlBtn = (disabled) => ({
  background: 'rgba(0,0,0,0.45)', border: 'none', color: '#fff',
  width: 20, height: 18, borderRadius: 3, padding: 0,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.4 : 1,
});

// ── Tab: Credentials ──────────────────────────────────────────────────
function CredentialsTab({ profile, onSaved }) {
  const [unionName, setUnionName] = useState(profile.union?.name || '');
  const [unionSince, setUnionSince] = useState(profile.union?.since || '');
  const [hours, setHours] = useState(profile.apprentice?.hours || 0);
  const [required, setRequired] = useState(profile.apprentice?.required || 8000);
  const [status, setStatus] = useState(profile.apprentice?.status || 'Apprentice');
  const [carrier, setCarrier] = useState(profile.insurance?.carrier || '');
  const [limit, setLimit] = useState(profile.insurance?.limit || '');
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
            <TextInput value={unionName} onChange={e => setUnionName(e.target.value)} placeholder="e.g. Local 184 — Carpenters"/>
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
            href={withAuthToken(docUrl)}
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
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingFilename, setPendingFilename] = useState(null);
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
        <TextInput value={name} onChange={e => setName(e.target.value)} placeholder="e.g. UT Contractor License"/>
      </Field>
      <Row>
        <Field label="Number">
          <TextInput value={number} onChange={e => setNumber(e.target.value)} placeholder="CON-UT-44219"/>
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

// ── Patch B helper components ─────────────────────────────────────────
// CompanyLogoMark renders a circular logo for a company. If the company
// has an uploaded logo, that's shown. Otherwise we fall back to the
// building-icon-on-surface placeholder.
//
// When companyId + onChanged are provided, the mark becomes clickable —
// the user can pick a file to upload (or replace) the logo without
// leaving the work-history row. The backend route enforces ownership
// (only the company's claimer, or its creator if unclaimed, can change
// the logo), so we don't need to gate the affordance client-side.
function CompanyLogoMark({ urls, size = 38, companyId, onChanged }) {
  const fileRef = React.useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const interactive = !!companyId && typeof onChanged === 'function';
  const src = urls?.thumb || urls?.medium;

  const onFilePicked = async (e) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.upload(`/photos/company/${companyId}/logo`, fd);
      onChanged?.();
    } catch (err) {
      setError(err.data?.error || 'Upload failed.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setBusy(false);
    }
  };

  // The inner content — either the photo or the building icon — is the
  // same regardless of interactivity. Interactive mode wraps it in a
  // button and adds a small upload badge.
  const Inner = (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      overflow: 'hidden', flexShrink: 0,
      border: `1px solid ${B.line}`,
      background: src
        ? `center/cover url("${src}") no-repeat`
        : B.surface,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: B.accent,
      position: 'relative',
    }}>
      {!src && <Icon name="building" size={Math.round(size * 0.47)}/>}
    </div>
  );

  if (!interactive) return Inner;

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <input
        type="file"
        ref={fileRef}
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={onFilePicked}
        style={{ display: 'none' }}
      />
      <button
        type="button"
        onClick={() => !busy && fileRef.current?.click()}
        title={src ? 'Click to replace logo' : 'Click to upload a logo'}
        disabled={busy}
        style={{
          padding: 0, border: 'none', background: 'transparent',
          cursor: busy ? 'wait' : 'pointer',
          position: 'relative', display: 'block',
          borderRadius: '50%',
        }}>
        {Inner}
        {/* Small upload badge bottom-right corner — always visible so the
            user knows it's interactive. Same pattern as JobsitePhotoCell. */}
        <div style={{
          position: 'absolute', bottom: -2, right: -2,
          width: 14, height: 14, borderRadius: '50%',
          background: 'rgba(42,31,23,0.7)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${B.surface}`,
        }}>
          <Icon name={busy ? 'image' : 'plus'} size={8} stroke={2.4}/>
        </div>
      </button>
      {error && (
        <div style={{
          position: 'absolute', top: '100%', left: 0,
          marginTop: 4, padding: '4px 8px',
          background: B.danger, color: '#fff',
          fontSize: 10, borderRadius: 2,
          whiteSpace: 'nowrap', zIndex: 5,
        }}>{error}</div>
      )}
    </div>
  );
}

// JobsitePhotoCell renders the small thumbnail next to a jobsite row in
// the work-history list — and offers a click-to-upload affordance so the
// user can attach a real photo (or replace the existing one) without
// leaving the row. The hidden file input lets us pick a file directly;
// the upload happens immediately and the parent reload reflects it.
function JobsitePhotoCell({ jobsite, onChanged }) {
  const fileRef = React.useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const hasPhoto = !!jobsite.photo_urls;
  const src = jobsite.photo_urls?.thumb || jobsite.photo_urls?.medium;

  const onFilePicked = async (e) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.upload(`/photos/jobsite/${jobsite.id}`, fd);
      onChanged?.();
    } catch (err) {
      setError(err.data?.error || 'Upload failed.');
      // Clear the error after a few seconds so the cell goes back to normal.
      setTimeout(() => setError(null), 3000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <input
        type="file"
        ref={fileRef}
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={onFilePicked}
        style={{ display: 'none' }}
      />
      <button
        type="button"
        onClick={() => !busy && fileRef.current?.click()}
        title={hasPhoto ? 'Click to replace photo' : 'Click to upload photo'}
        disabled={busy}
        style={{
          width: 50, height: 36, padding: 0,
          border: 'none', background: 'transparent',
          borderRadius: 2, overflow: 'hidden',
          cursor: busy ? 'wait' : 'pointer',
          position: 'relative', display: 'block',
        }}>
        {src ? (
          <div style={{
            width: '100%', height: '100%',
            background: `center/cover url("${src}") no-repeat`,
          }}/>
        ) : (
          <Photo kind={jobsite.photo_kind} label="" height={36}/>
        )}
        {/* Hover hint: a faint camera icon overlay. Always visible so the
            user knows it's interactive (without a designer-intensive
            hover-only treatment). */}
        <div style={{
          position: 'absolute', bottom: 2, right: 2,
          width: 14, height: 14, borderRadius: '50%',
          background: 'rgba(42,31,23,0.7)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name={busy ? 'image' : 'plus'} size={8} stroke={2.4}/>
        </div>
      </button>
      {error && (
        <div style={{
          position: 'absolute', top: '100%', left: 0,
          marginTop: 4, padding: '4px 8px',
          background: B.danger, color: '#fff',
          fontSize: 10, borderRadius: 2,
          whiteSpace: 'nowrap', zIndex: 5,
        }}>{error}</div>
      )}
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

// Patch C: append the current JWT to a URL as ?token=<jwt> so that opening
// the URL in a new browser tab (where the React app can't attach an
// Authorization header) still authenticates against /api routes. Matches
// the helper in ProfileSections.jsx — kept in both files so each module
// is self-contained.
function withAuthToken(url) {
  if (!url) return url;
  const token = auth.get();
  if (!token) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}token=${encodeURIComponent(token)}`;
}
