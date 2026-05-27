// Smith — Profile page sections
// Ported from smith-direction-b.jsx — ProfileHeaderB, CompaniesB, FeaturedB,
// CredentialsB, RightRailB. Each takes a `profile` object as returned by
// /api/profiles/me or /api/profiles/:id.

import React, { useState } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from '../components/Icon.jsx';
import { Avatar, Photo } from '../components/Primitives.jsx';
import { SmithAvatar } from './SmithAvatar.jsx';
import { api, auth } from '../lib/api.js';
import { useRouter } from '../lib/router.jsx';

// ── Header ──────────────────────────────────────────────────────────────
export function ProfileHeader({ profile, isMe, onEdit, onConnect, onMessage }) {
  // Cover: prefer a real uploaded cover photo (medium variant, fits well at
  // 220px header height). Fall back to the placeholder Photo render keyed
  // off cover_kind.
  const coverPhotoUrl = profile.cover_urls?.medium || profile.cover_urls?.full;

  return (
    <section style={{
      background: B.surface, border: `1px solid ${B.line}`,
      borderRadius: 4, overflow: 'hidden',
    }}>
      {coverPhotoUrl ? (
        <div style={{
          height: 220,
          background: `center/cover url("${coverPhotoUrl}") no-repeat`,
        }}/>
      ) : (
        <Photo kind={profile.cover_kind} label="cover" height={220}/>
      )}
      <div style={{ padding: '28px 40px 32px', position: 'relative' }}>
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 24, marginTop: -88,
        }}>
          <div style={{ background: B.surface, padding: 5, borderRadius: '50%' }}>
            <SmithAvatar
              urls={profile.avatar_urls}
              initials={profile.initials}
              size={144}
              tone={profile.avatar_tone}
            />
          </div>
          <div style={{ flex: 1, paddingTop: 96 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 className="serif" style={{
                margin: 0, fontSize: 40, fontWeight: 600,
                color: B.text, letterSpacing: '-0.02em',
              }}>{profile.name}</h1>
              {profile.verified_smith && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', background: B.accentSoft, color: B.accent,
                  borderRadius: 100, fontSize: 11, fontWeight: 600,
                }}>
                  <Icon name="verified" size={12} stroke={2}/> Verified Smith
                </span>
              )}
            </div>
            {profile.headline && (
              <p style={{ margin: '8px 0 0', color: B.text, fontSize: 17 }}>{profile.headline}</p>
            )}
            <div style={{
              display: 'flex', gap: 24, marginTop: 12,
              color: B.dim, fontSize: 13, flexWrap: 'wrap',
            }}>
              {profile.location && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="mappin" size={14}/> {profile.location}
                </span>
              )}
              {profile.years_experience > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="briefcase" size={14}/> {profile.years_experience} years building
                </span>
              )}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon name="users" size={14}/> {profile.network_size} in network
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, paddingTop: 96 }}>
            {isMe ? (
              <button onClick={onEdit} style={primaryBtn}>
                <Icon name="edit" size={14} stroke={2.4}/> Edit profile
              </button>
            ) : (
              <ConnectButton profile={profile} onConnect={onConnect}/>
            )}
            {!isMe && (
              (() => {
                const canMessage = profile.connection?.status === 'accepted';
                return (
                  <button
                    onClick={async () => {
                      if (!canMessage) return;
                      try {
                        const { thread_id } = await api.post('/messages/threads', { peer_id: profile.id });
                        window.location.hash = `#/messages/${thread_id}`;
                        onMessage?.(thread_id);
                      } catch (e) {
                        alert(e.data?.error || 'Could not start message thread.');
                      }
                    }}
                    disabled={!canMessage}
                    style={{
                      ...ghostBtn,
                      opacity: canMessage ? 1 : 0.5,
                      cursor: canMessage ? 'pointer' : 'not-allowed',
                    }}
                    title={canMessage
                      ? `Message ${profile.first_name}`
                      : 'Connect first to send a message'}
                  >
                    <Icon name="message" size={14}/> Message
                  </button>
                );
              })()
            )}
          </div>
        </div>

        {/* Trade chips with reveal-years-on-hover */}
        {profile.trades.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 24, flexWrap: 'wrap' }}>
            {profile.trades.map(t => (
              <span
                key={t.id}
                className="trade-chip"
                tabIndex={0}
                title={`${t.years} years of experience`}
                style={{
                  padding: '6px 12px', background: B.bg, border: `1px solid ${B.line}`,
                  borderRadius: 100, fontSize: 12, color: B.text, fontWeight: 500,
                  display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'default',
                }}
              >
                {t.name}
                <span
                  className="trade-chip-yrs"
                  style={{
                    background: B.text, color: B.surface,
                    fontSize: 10, fontWeight: 600, padding: '2px 7px',
                    borderRadius: 100, fontFamily: 'inherit',
                    display: 'inline-flex', alignItems: 'baseline', gap: 2,
                    maxWidth: 0, paddingLeft: 0, paddingRight: 0, marginLeft: -8,
                    overflow: 'hidden', opacity: 0,
                    transition: 'max-width 180ms ease, opacity 140ms ease, padding 180ms ease, margin 180ms ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.years}
                  <span style={{ fontSize: 9, opacity: 0.75, fontStyle: 'italic' }}>yr</span>
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// Connect / Pending / Connected button — lives on profile header for non-self.
function ConnectButton({ profile, onConnect }) {
  const [busy, setBusy] = useState(false);
  const status = profile.connection?.status;

  const send = async () => {
    setBusy(true);
    try {
      await api.post('/connections/request', { target_id: profile.id });
      onConnect?.();
    } finally { setBusy(false); }
  };

  if (status === 'accepted') {
    return <button style={primaryBtn} disabled><Icon name="check" size={14} stroke={2.4}/> Connected</button>;
  }
  if (status === 'pending') {
    return <button style={ghostBtn} disabled>Request pending</button>;
  }
  return (
    <button onClick={send} disabled={busy} style={primaryBtn}>
      <Icon name="plus" size={14} stroke={2.4}/> Connect
    </button>
  );
}

// ── Where I've worked ──────────────────────────────────────────────────
export function CompaniesSection({ profile, isMe, onEdit }) {
  // Default open = the most recent (current) company; collapse the rest.
  const [open, setOpen] = useState(() => {
    const out = {};
    profile.work_history.forEach((w, i) => { out[w.id] = i === 0; });
    return out;
  });

  if (profile.work_history.length === 0) {
    return (
      <EmptySection
        title="Where I've worked"
        ownPrompt={{
          headline: 'Tell people where you\u2019ve worked.',
          body:     'Add the companies you\u2019ve been on payroll for, and the jobsites you\u2019ve actually stood on. The work is the r\u00e9sum\u00e9.',
          cta:      'Add work history',
        }}
        otherPrompt={`${profile.first_name || 'They'} hasn\u2019t added work history yet.`}
        isMe={isMe}
        onEdit={onEdit}
        icon="building"
      />
    );
  }

  const totalSites = profile.work_history.reduce((sum, w) => sum + (w.jobsites?.length || 0), 0);

  return (
    <section style={{
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
      padding: '32px 40px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 6,
      }}>
        <h2 className="serif" style={{
          margin: 0, fontSize: 24, fontWeight: 600,
          color: B.text, letterSpacing: '-0.01em',
        }}>Where I've worked</h2>
        <span style={{ color: B.faint, fontSize: 12 }}>
          {profile.work_history.length} {profile.work_history.length === 1 ? 'company' : 'companies'} · {totalSites} {totalSites === 1 ? 'jobsite' : 'jobsites'}
        </span>
      </div>
      <p style={{ margin: '0 0 24px', color: B.dim, fontSize: 14 }}>
        The companies, and the projects under each.
      </p>

      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute', left: 26, top: 8, bottom: 8, width: 1,
          background: B.line, zIndex: 0,
        }}/>
        {profile.work_history.map((co, i) => (
          <div
            key={co.id}
            style={{
              marginBottom: i === profile.work_history.length - 1 ? 0 : 28,
              position: 'relative',
            }}
          >
            <button
              onClick={() => setOpen(o => ({ ...o, [co.id]: !o[co.id] }))}
              style={{
                width: '100%', background: 'transparent', border: 'none', padding: 0,
                display: 'flex', alignItems: 'flex-start', gap: 18, textAlign: 'left',
              }}
            >
              <div style={{
                width: 54, height: 54, borderRadius: '50%',
                flexShrink: 0, position: 'relative', zIndex: 1,
                border: `1px solid ${B.line}`,
                overflow: 'hidden',
                background: co.company_logo_urls?.thumb || co.company_logo_urls?.medium
                  ? `center/cover url("${co.company_logo_urls.thumb || co.company_logo_urls.medium}") no-repeat`
                  : B.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: B.accent,
              }}>
                {!co.company_logo_urls && <Icon name="building" size={22} stroke={1.4}/>}
              </div>
              <div style={{ flex: 1, paddingTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="serif" style={{
                    color: B.text, fontWeight: 600, fontSize: 19, letterSpacing: '-0.01em',
                  }}>{co.company_name}</span>
                  {!co.company_claimed && (
                    <span style={{
                      fontSize: 10, color: B.dim, padding: '2px 8px',
                      border: `1px dashed ${B.line}`, borderRadius: 100,
                      fontStyle: 'italic',
                    }}>company unclaimed</span>
                  )}
                </div>
                <div style={{ color: B.text, fontSize: 14, marginTop: 4 }}>
                  {co.role} · <span style={{ color: B.dim }}>{co.company_type}</span>
                </div>
                <div style={{ color: B.faint, fontSize: 12, marginTop: 4 }}>
                  {co.from_year} – {co.is_current ? 'Present' : (co.to_year || '')}
                </div>
              </div>
              <Icon
                name={open[co.id] ? 'chevron-d' : 'chevron-r'}
                size={18}
                style={{ color: B.dim, marginTop: 18 }}
              />
            </button>

            {open[co.id] && co.jobsites?.length > 0 && (
              <div style={{ marginLeft: 72, marginTop: 14 }} className="fade-in">
                <div style={{
                  color: B.faint, fontSize: 11, marginBottom: 10, fontStyle: 'italic',
                }}>
                  Jobsites — {co.jobsites.length}
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: 10,
                }}>
                  {co.jobsites.flatMap(js => {
                    // One card per photo, each carrying the jobsite's
                    // descriptive text — so every photo reads in context,
                    // identical to the single-photo cards. A no-photo jobsite
                    // still yields one (placeholder) card.
                    const photos = (js.photos && js.photos.length)
                      ? js.photos
                      : [{ id: 'primary', urls: js.photo_urls || null }];
                    return photos.map(p => ({ js, p }));
                  }).map(({ js, p }) => (
                    <div key={`${js.id}-${p.id}`} style={{
                      background: B.bg, border: `1px solid ${B.line}`, borderRadius: 4,
                      overflow: 'hidden', display: 'flex', flexDirection: 'column',
                    }}>
                      {p.urls ? (
                        <div style={{
                          height: 132,
                          background: `center/cover url("${p.urls.medium || p.urls.full || p.urls.thumb}") no-repeat ${B.bg}`,
                        }}/>
                      ) : (
                        <Photo kind={js.photo_kind} label={js.title.toLowerCase()} height={132}/>
                      )}
                      <div style={{ padding: '10px 14px', flex: 1 }}>
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
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Selected work (featured grid) ──────────────────────────────────────
export function FeaturedSection({ profile, isMe, onEdit, navigate }) {
  const all = profile.work_history.flatMap(w => w.jobsites || []);
  const featured = all.filter(j => j.is_featured);
  const list = (featured.length ? featured : all).slice(0, 10);

  if (list.length === 0) {
    const focus = profile.work_history.length === 0 ? 'add-company' : 'newest-company';
    const smartOnEdit = (isMe && navigate)
      ? () => navigate(`/profile/edit?tab=history&focus=${focus}`)
      : onEdit;
    return (
      <EmptySection
        title="Selected work"
        ownPrompt={{
          headline: 'Show off your best work.',
          body:     'Pick up to ten jobsites you\'re proud of — these anchor your profile and tell visitors what you build.',
          cta:      'Add a project',
        }}
        otherPrompt={`${profile.first_name || 'They'} hasn\u2019t added selected work yet.`}
        isMe={isMe}
        onEdit={smartOnEdit}
        icon="briefcase"
      />
    );
  }

  const [hero, ...rest] = list;
  return (
    <section style={{
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
      padding: '32px 40px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 20,
      }}>
        <h2 className="serif" style={{
          margin: 0, fontSize: 24, fontWeight: 600,
          color: B.text, letterSpacing: '-0.01em',
        }}>Selected work</h2>
        <span style={{ color: B.faint, fontSize: 12 }}>{all.length} total</span>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gridTemplateRows: '240px 130px', gap: 10,
      }}>
        <div style={{
          gridColumn: 'span 2', gridRow: 'span 2',
          position: 'relative', borderRadius: 4, overflow: 'hidden',
        }}>
          {hero.photo_urls ? (
            <div style={{
              width: '100%', height: '100%',
              background: `center/cover url("${hero.photo_urls.full || hero.photo_urls.medium}") no-repeat`,
            }}/>
          ) : (
            <Photo kind={hero.photo_kind} label={hero.title.toLowerCase()} height="100%"/>
          )}
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
            padding: '40px 22px 18px', color: '#fff',
          }}>
            <div style={{ fontSize: 11, opacity: 0.8, fontStyle: 'italic' }}>
              Featured · {[hero.structure_type, hero.job_type].filter(Boolean).join(' · ') || hero.kind}
            </div>
            <div className="serif" style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>
              {hero.title}
            </div>
          </div>
        </div>
        {rest.map((js) => (
          js.photo_urls ? (
            <div
              key={js.id}
              title={js.title}
              style={{
                background: `center/cover url("${js.photo_urls.medium || js.photo_urls.full}") no-repeat`,
                borderRadius: 4,
              }}
            />
          ) : (
            <Photo
              key={js.id}
              kind={js.photo_kind}
              label={js.title.toLowerCase()}
              height="100%"
              style={{ borderRadius: 4 }}
            />
          )
        ))}
      </div>
    </section>
  );
}

// ── Credentials & licensure ────────────────────────────────────────────
export function CredentialsSection({ profile, isMe, onEdit }) {
  if (profile.licenses.length === 0 && !profile.union && !profile.apprentice?.hours) {
    return (
      <EmptySection
        title="Credentials & licensure"
        ownPrompt={{
          headline: 'Back up your work.',
          body:     'Add your licenses, union membership, or apprenticeship hours. Third-party-verifiable credentials make a profile real.',
          cta:      'Add credentials',
        }}
        otherPrompt={`${profile.first_name || 'They'} hasn\u2019t added credentials yet.`}
        isMe={isMe}
        onEdit={onEdit}
        icon="shield"
      />
    );
  }

  return (
    <section style={{
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
      padding: '32px 40px',
    }}>
      <h2 className="serif" style={{
        margin: '0 0 6px', fontSize: 24, fontWeight: 600,
        color: B.text, letterSpacing: '-0.01em',
      }}>Credentials & licensure</h2>
      <p style={{ margin: '0 0 24px', color: B.dim, fontSize: 14 }}>
        Third-party verified. The paperwork that backs the work.
      </p>

      {profile.licenses.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {profile.licenses.map(l => (
            <div key={l.id} style={{
              border: `1px solid ${B.line}`, borderRadius: 4, padding: '16px 18px',
              background: B.bg,
            }}>
              <div style={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                marginBottom: 10,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 4, background: B.accentSoft,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: B.accent,
                }}>
                  <Icon name="shield" size={18}/>
                </div>
                {l.verified && <Icon name="verified" size={18} style={{ color: B.accent }}/>}
              </div>
              <div className="serif" style={{ color: B.text, fontWeight: 600, fontSize: 15 }}>
                {l.name}
              </div>
              <div style={{ color: B.faint, fontSize: 11, marginTop: 4 }}>
                {l.number} · Expires {l.expiration}
              </div>
              {l.doc_url && (
                <a
                  href={withAuthToken(l.doc_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    marginTop: 10, color: B.accent, fontSize: 11, fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  <Icon name="shield" size={11}/> View document
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {(profile.union || profile.apprentice?.hours > 0) && (
        <div style={{
          marginTop: 16, padding: '20px 22px', background: B.bg,
          border: `1px solid ${B.line}`, borderRadius: 4,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32,
        }}>
          {profile.union && (
            <div>
              <div style={{ color: B.faint, fontSize: 11, fontStyle: 'italic' }}>
                Union affiliation
              </div>
              <div className="serif" style={{
                color: B.text, fontWeight: 600, fontSize: 17, marginTop: 6,
                letterSpacing: '-0.01em',
              }}>{profile.union.name}</div>
              <div style={{ color: B.dim, fontSize: 13, marginTop: 2 }}>
                {profile.union.since
                  ? `Member since ${profile.union.since} · in good standing`
                  : 'In good standing'}
              </div>
            </div>
          )}
          {profile.apprentice?.hours > 0 && (
            <div>
              <div style={{ color: B.faint, fontSize: 11, fontStyle: 'italic' }}>
                Apprenticeship hours
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                <span className="serif" style={{
                  color: B.text, fontWeight: 700, fontSize: 24, letterSpacing: '-0.02em',
                }}>{profile.apprentice.hours.toLocaleString()}</span>
                <span style={{ color: B.dim, fontSize: 13 }}>· {profile.apprentice.status}</span>
              </div>
              <div style={{
                height: 5, background: B.surface2, borderRadius: 3,
                marginTop: 8, overflow: 'hidden',
              }}>
                <div style={{
                  width: `${Math.min(100, (profile.apprentice.hours / Math.max(1, profile.apprentice.required)) * 100)}%`,
                  height: '100%', background: B.accent,
                }}/>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ── Right rail: skills + small network preview ────────────────────────
export function ProfileRightRail({ profile, isMe, recentConnections, onEdit }) {
  const [skills, setSkills] = useState(profile.skills);
  const [openSkill, setOpenSkill] = useState(null);

  React.useEffect(() => { setSkills(profile.skills); }, [profile.skills]);

  const toggleEndorse = async (skill) => {
    const wasEndorsed = !!skill.endorsed_by_me;
    setSkills(ss => ss.map(s => s.id === skill.id
      ? { ...s, endorsed_by_me: !wasEndorsed, endorsements: s.endorsements + (wasEndorsed ? -1 : 1) }
      : s
    ));
    try {
      const data = wasEndorsed
        ? await api.delete(`/profiles/${profile.id}/skills/${skill.id}/endorse`)
        : await api.post(`/profiles/${profile.id}/skills/${skill.id}/endorse`);
      setSkills(ss => ss.map(s => s.id === skill.id
        ? { ...s, endorsed_by_me: data.endorsed_by_me, endorsements: data.endorsements }
        : s
      ));
    } catch {
      setSkills(ss => ss.map(s => s.id === skill.id
        ? { ...s, endorsed_by_me: wasEndorsed, endorsements: s.endorsements + (wasEndorsed ? 1 : -1) }
        : s
      ));
    }
  };

  return (
    <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {skills.length === 0 ? (
        <section style={{
          background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
          padding: '24px 26px',
        }}>
          <h3 className="serif" style={{
            margin: '0 0 10px', fontSize: 17, fontWeight: 600,
            color: B.text, letterSpacing: '-0.01em',
          }}>Skills</h3>
          {isMe ? (
            <>
              <p style={{
                color: B.dim, fontSize: 13, margin: '0 0 14px', lineHeight: 1.55,
              }}>
                Add the specific things you’re good at — stair building, conduit
                bending, custom millwork. Connections can endorse them.
              </p>
              <button onClick={onEdit} style={{
                background: 'transparent', border: `1px solid ${B.line}`,
                color: B.text, padding: '7px 14px', borderRadius: 100,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <Icon name="plus" size={12} stroke={2.4}/> Add skills
              </button>
            </>
          ) : (
            <p style={{
              color: B.faint, fontSize: 13, margin: 0, fontStyle: 'italic',
            }}>
              No skills listed yet.
            </p>
          )}
        </section>
      ) : (
        <section style={{
          background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
          padding: '24px 26px',
        }}>
          <h3 className="serif" style={{
            margin: '0 0 18px', fontSize: 17, fontWeight: 600,
            color: B.text, letterSpacing: '-0.01em',
          }}>Skills</h3>
          {skills.map(s => {
            const canOpenModal = s.endorsements > 0;
            return (
              <div key={s.id} style={{
                marginBottom: 12, padding: '8px 10px', margin: '0 -10px 4px',
                borderRadius: 4, transition: 'background 120ms ease',
                background: 'transparent',
              }}
              onMouseEnter={e => {
                if (canOpenModal) e.currentTarget.style.background = B.bg;
              }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', gap: 8,
                }}>
                  <button
                    onClick={() => canOpenModal && setOpenSkill(s)}
                    disabled={!canOpenModal}
                    title={canOpenModal ? 'See who endorsed this' : ''}
                    style={{
                      flex: 1, textAlign: 'left',
                      background: 'transparent', border: 'none', padding: 0,
                      cursor: canOpenModal ? 'pointer' : 'default',
                      color: B.text, fontSize: 13, fontWeight: 500,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                      gap: 8,
                    }}>
                    <span>{s.name}</span>
                    <span style={{
                      color: canOpenModal ? B.dim : B.faint, fontSize: 11,
                      textDecoration: canOpenModal ? 'underline' : 'none',
                      textDecorationColor: B.line,
                      textUnderlineOffset: 2,
                    }}>
                      {s.endorsements} endorsement{s.endorsements === 1 ? '' : 's'}
                    </span>
                  </button>
                  {!isMe && (
                    <EndorseButton
                      endorsed={s.endorsed_by_me}
                      onClick={() => toggleEndorse(s)}
                    />
                  )}
                </div>
                <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <div key={n} style={{
                      flex: 1, height: 5,
                      background: n <= s.level ? B.accent : B.surface2,
                      borderRadius: 2,
                    }}/>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {openSkill && (
        <EndorsersModal
          profileId={profile.id}
          skill={openSkill}
          onClose={() => setOpenSkill(null)}
        />
      )}

      {recentConnections?.length > 0 && (
        <section style={{
          background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
          padding: '24px 26px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 14,
          }}>
            <h3 className="serif" style={{
              margin: 0, fontSize: 17, fontWeight: 600,
              color: B.text, letterSpacing: '-0.01em',
            }}>In your network</h3>
            <span style={{ color: B.faint, fontSize: 12 }}>{profile.network_size}</span>
          </div>
          {recentConnections.slice(0, 4).map((c, i) => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 0',
              borderTop: i === 0 ? 'none' : `1px solid ${B.line}`,
            }}>
              <Avatar
                initials={(c.first_name[0] || '') + (c.last_name[0] || '')}
                size={38}
                tone={c.avatar_tone}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  color: B.text, fontSize: 13, fontWeight: 600,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{c.first_name} {c.last_name}</div>
                <div style={{
                  color: B.dim, fontSize: 11,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{c.current_role || c.headline}</div>
              </div>
            </div>
          ))}
        </section>
      )}
    </aside>
  );
}

// ── shared button styles ───────────────────────────────────────────────
const primaryBtn = {
  background: B.text, color: B.surface, border: 'none',
  padding: '11px 20px', borderRadius: 100, fontWeight: 600, fontSize: 13,
  display: 'inline-flex', alignItems: 'center', gap: 8,
  cursor: 'pointer',
};
const ghostBtn = {
  background: 'transparent', color: B.text, border: `1px solid ${B.line}`,
  padding: '11px 18px', borderRadius: 100, fontWeight: 600, fontSize: 13,
  display: 'inline-flex', alignItems: 'center', gap: 8,
};

function EndorseButton({ endorsed, onClick }) {
  return (
    <button
      onClick={onClick}
      title={endorsed ? 'Click to remove endorsement' : 'Endorse this skill'}
      style={{
        flexShrink: 0, padding: '4px 10px', borderRadius: 100,
        background: endorsed ? B.accent : 'transparent',
        border: `1px solid ${endorsed ? B.accent : B.line}`,
        color: endorsed ? '#fff' : B.dim,
        fontSize: 11, fontWeight: 700,
        display: 'inline-flex', alignItems: 'center', gap: 4,
        cursor: 'pointer',
        transition: 'all 120ms ease',
      }}
      onMouseEnter={e => {
        if (!endorsed) {
          e.currentTarget.style.borderColor = B.accent;
          e.currentTarget.style.color = B.accent;
        }
      }}
      onMouseLeave={e => {
        if (!endorsed) {
          e.currentTarget.style.borderColor = B.line;
          e.currentTarget.style.color = B.dim;
        }
      }}
    >
      <Icon name={endorsed ? 'check' : 'plus'} size={11} stroke={2.6}/>
      <span>{endorsed ? 'Endorsed' : 'Endorse'}</span>
    </button>
  );
}

function EndorsersModal({ profileId, skill, onClose }) {
  const { navigate } = useRouter();
  const [endorsers, setEndorsers] = useState(null);
  const [error, setError] = useState(null);

  React.useEffect(() => {
    let cancelled = false;
    api.get(`/profiles/${profileId}/skills/${skill.id}/endorsers`)
      .then(d => { if (!cancelled) setEndorsers(d.endorsers); })
      .catch(e => { if (!cancelled) setError(e.data?.error || 'Could not load.'); });
    return () => { cancelled = true; };
  }, [profileId, skill.id]);

  const goToProfile = (id) => {
    onClose();
    navigate(`/profile/${id}`);
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(42,31,23,0.4)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} className="fade-in">
      <div onClick={e => e.stopPropagation()} style={{
        background: B.surface, border: `1px solid ${B.line}`, borderRadius: 6,
        width: '100%', maxWidth: 480, maxHeight: '80vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
      }}>
        <div style={{
          padding: '20px 24px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', borderBottom: `1px solid ${B.line}`,
        }}>
          <div>
            <div className="serif" style={{
              fontSize: 18, fontWeight: 600, color: B.text, letterSpacing: '-0.01em',
            }}>Endorsements</div>
            <div style={{ color: B.dim, fontSize: 13, marginTop: 2 }}>
              {skill.name} · {skill.endorsements} {skill.endorsements === 1 ? 'person' : 'people'}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: B.dim, cursor: 'pointer', padding: 4,
          }}>
            <Icon name="x" size={20}/>
          </button>
        </div>

        <div className="scroll-thin" style={{
          padding: '8px 0', overflowY: 'auto', flex: 1,
        }}>
          {endorsers === null && !error && (
            <div style={{ padding: 20, color: B.faint, fontSize: 13, fontStyle: 'italic' }}>
              Loading…
            </div>
          )}
          {error && (
            <div style={{ padding: 20, color: B.danger, fontSize: 13 }}>{error}</div>
          )}
          {endorsers && endorsers.map(e => (
            <button
              key={e.id}
              onClick={() => goToProfile(e.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 24px', background: 'transparent', border: 'none',
                textAlign: 'left', cursor: 'pointer',
              }}
              onMouseEnter={ev => { ev.currentTarget.style.background = B.bg; }}
              onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; }}
            >
              <SmithAvatar
                urls={e.avatar_urls}
                initials={e.initials}
                size={42}
                tone={e.avatar_tone}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="serif" style={{
                  color: B.text, fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em',
                }}>{e.name}</div>
                <div style={{
                  color: B.dim, fontSize: 12,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{e.headline || '—'}</div>
              </div>
              <Icon name="chevron-r" size={16} style={{ color: B.faint }}/>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptySection({ title, ownPrompt, otherPrompt, isMe, onEdit, icon }) {
  return (
    <section style={{
      background: B.surface, border: `1px dashed ${B.line}`, borderRadius: 4,
      padding: isMe ? '28px 36px' : '24px 36px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        {isMe && (
          <div style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
            background: B.bg, border: `1px solid ${B.line}`,
            color: B.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={icon || 'plus'} size={18} stroke={1.6}/>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="serif" style={{
            margin: 0, fontSize: isMe ? 20 : 16, fontWeight: 600,
            color: B.text, letterSpacing: '-0.01em',
          }}>{title}</h2>

          {isMe ? (
            <>
              <p style={{
                color: B.text, fontSize: 15, fontWeight: 500,
                margin: '8px 0 4px', letterSpacing: '-0.005em',
              }}>{ownPrompt.headline}</p>
              <p style={{
                color: B.dim, fontSize: 13.5, margin: '0 0 14px', lineHeight: 1.55,
              }}>{ownPrompt.body}</p>
              <button onClick={onEdit} style={{
                background: B.text, border: 'none', color: B.surface,
                padding: '9px 18px', borderRadius: 100,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                <Icon name="plus" size={12} stroke={2.4}/> {ownPrompt.cta}
              </button>
            </>
          ) : (
            <p style={{
              color: B.faint, fontSize: 13.5, margin: '8px 0 0',
              fontStyle: 'italic',
            }}>{otherPrompt}</p>
          )}
        </div>
      </div>
    </section>
  );
}

export function ProfileStrengthBanner({ onEdit }) {
  const [data, setData] = React.useState(null);
  const [dismissed, setDismissed] = React.useState(() => {
    try { return localStorage.getItem('smith.strength.dismissed') === '1'; }
    catch { return false; }
  });

  React.useEffect(() => {
    let cancelled = false;
    api.get('/profiles/me/strength')
      .then(d => { if (!cancelled) setData(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (dismissed || !data) return null;
  if (data.pct >= 100) return null;

  const todo = (data.checklist || []).filter(c => !c.done).slice(0, 2);

  const dismiss = () => {
    try { localStorage.setItem('smith.strength.dismissed', '1'); } catch {}
    setDismissed(true);
  };

  return (
    <section style={{
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
      padding: '18px 24px',
      display: 'flex', alignItems: 'center', gap: 18,
    }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <svg width={56} height={56} viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="24" stroke={B.surface2} strokeWidth="4" fill="none"/>
          <circle
            cx="28" cy="28" r="24" stroke={B.accent} strokeWidth="4" fill="none"
            strokeLinecap="round"
            strokeDasharray={`${(data.pct / 100) * 150.8} 150.8`}
            transform="rotate(-90 28 28)"
            style={{ transition: 'stroke-dasharray 600ms ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: B.text, fontWeight: 700, fontSize: 13,
          fontFamily: 'inherit',
        }}>{data.pct}%</div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="serif" style={{
          color: B.text, fontWeight: 600, fontSize: 16, letterSpacing: '-0.01em',
        }}>Your profile is {data.pct}% complete.</div>
        {todo.length > 0 && (
          <div style={{ color: B.dim, fontSize: 13, marginTop: 4 }}>
            Next: {todo.map((t, i) => (
              <React.Fragment key={t.label}>
                <span style={{ color: B.text, fontWeight: 500 }}>{t.label.toLowerCase()}</span>
                {i < todo.length - 1 ? ', then ' : '.'}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button onClick={onEdit} style={{
          background: B.text, border: 'none', color: B.surface,
          padding: '8px 16px', borderRadius: 100,
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>Complete profile</button>
        <button onClick={dismiss}
          title="Dismiss (you can revisit anytime by editing your profile)"
          style={{
            background: 'transparent', border: 'none', color: B.faint,
            padding: 6, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center',
          }}>
          <Icon name="x" size={16}/>
        </button>
      </div>
    </section>
  );
}

// Patch C: append the current JWT to a URL as ?token=<jwt> so that opening
// the URL in a new browser tab (where the React app can't attach an
// Authorization header) still authenticates against /api routes. The
// backend's requireAuth middleware accepts the query-string fallback for
// exactly this case.
//
// Returns the URL unchanged if there's no token available (signed-out
// users navigating to a shared link — they'll see the normal 401 from
// the server, not an opaque error).
function withAuthToken(url) {
  if (!url) return url;
  const token = auth.get();
  if (!token) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}token=${encodeURIComponent(token)}`;
}
