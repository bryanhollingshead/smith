/* Smith — Direction B: "Foreman"
   Warm paper-and-pencil. Cream surfaces, walnut text, terracotta accent,
   Fraunces display + Inter Tight body. Same screens as Direction A.
*/

const B = {
  bg: '#F5F1E8', surface: '#FBF7EE', surface2: '#EBE5D6',
  line: '#D8D0BC', text: '#2A1F17', dim: '#6B5D4D', faint: '#9A8E7B',
  accent: '#C8731F', accentSoft: '#C8731F12', amber: '#B8860B',
  ink: '#2A1F17',
};

// ── Logo ──────────────────────────────────────────────────
const SmithLogoB = ({ size = 26, color }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, color: color || B.text }}>
    <span className="serif" style={{
      fontWeight: 700, letterSpacing: '-0.02em', fontSize: size, fontStyle: 'italic',
    }}>Smith</span>
    <span style={{
      width: 6, height: 6, borderRadius: '50%', background: B.accent,
      display: 'inline-block', alignSelf: 'center', marginBottom: 2,
    }}/>
  </div>
);

// ── Top nav (desktop) ────────────────────────────────────
const TopNavB = ({ active = 'profile', onNav }) => {
  const items = [
    { k: 'feed', label: 'Feed', icon: 'home' },
    { k: 'profile', label: 'Profile', icon: 'user' },
    { k: 'connections', label: 'Network', icon: 'users' },
    { k: 'messages', label: 'Messages', icon: 'message', badge: 3 },
    { k: 'notifications', label: 'Alerts', icon: 'bell', badge: 2 },
  ];
  return (
    <header style={{
      background: B.surface, borderBottom: `1px solid ${B.line}`,
      position: 'sticky', top: 0, zIndex: 10,
    }}>
      <div style={{
        maxWidth: 1280, margin: '0 auto', padding: '0 32px',
        display: 'flex', alignItems: 'center', gap: 28, height: 68,
      }}>
        <SmithLogoB size={26}/>
        <div style={{
          background: B.bg, border: `1px solid ${B.line}`,
          borderRadius: 100, padding: '8px 14px', display: 'flex',
          alignItems: 'center', gap: 8, flex: 1, maxWidth: 380,
          color: B.dim,
        }}>
          <Icon name="search" size={16}/>
          <span style={{ fontSize: 13 }}>Search trades, companies, jobsites…</span>
        </div>
        <nav style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {items.map(it => (
            <button key={it.k} onClick={() => onNav?.(it.k)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: '8px 14px', border: 'none', background: 'transparent',
              color: active === it.k ? B.text : B.dim,
              borderBottom: active === it.k ? `2px solid ${B.accent}` : '2px solid transparent',
              position: 'relative', minWidth: 64,
            }}>
              <Icon name={it.icon} size={18}/>
              <span style={{ fontSize: 11, fontWeight: 500 }}>{it.label}</span>
              {it.badge && (
                <span style={{
                  position: 'absolute', top: 4, right: 8, background: B.accent,
                  color: '#fff', fontSize: 9, fontWeight: 700,
                  padding: '1px 5px', borderRadius: 8, minWidth: 14,
                }}>{it.badge}</span>
              )}
            </button>
          ))}
        </nav>
        <Avatar initials="MW" size={38} tone="rust" ring={B.surface}/>
      </div>
    </header>
  );
};

// ── Side nav ─────────────────────────────────────────────
const SidebarB = ({ active = 'profile', onNav }) => {
  const items = [
    { k: 'feed', label: 'Feed', icon: 'home' },
    { k: 'profile', label: 'My Profile', icon: 'user' },
    { k: 'connections', label: 'Network', icon: 'users' },
    { k: 'messages', label: 'Messages', icon: 'message', badge: 3 },
    { k: 'notifications', label: 'Alerts', icon: 'bell', badge: 2 },
    { k: 'companies', label: 'Companies', icon: 'building' },
  ];
  return (
    <aside style={{
      width: 248, background: B.surface, borderRight: `1px solid ${B.line}`,
      padding: '28px 0', position: 'sticky', top: 0, alignSelf: 'flex-start',
      height: '100%', flexShrink: 0,
    }}>
      <div style={{ padding: '0 28px 28px' }}><SmithLogoB/></div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map(it => (
          <button key={it.k} onClick={() => onNav?.(it.k)} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '11px 28px', border: 'none', background: active === it.k ? B.accentSoft : 'transparent',
            color: active === it.k ? B.accent : B.text,
            fontSize: 14, fontWeight: active === it.k ? 600 : 500,
            textAlign: 'left', position: 'relative',
            borderLeft: active === it.k ? `3px solid ${B.accent}` : '3px solid transparent',
            paddingLeft: active === it.k ? 25 : 28,
          }}>
            <Icon name={it.icon} size={18}/>
            <span>{it.label}</span>
            {it.badge && (
              <span style={{
                marginLeft: 'auto', background: B.accent, color: '#fff',
                fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 8,
              }}>{it.badge}</span>
            )}
          </button>
        ))}
      </nav>
    </aside>
  );
};

// ── Profile Header ───────────────────────────────────────
const ProfileHeaderB = ({ density = 'visual' }) => {
  const me = SAMPLE.me;
  return (
    <section style={{
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4, overflow: 'hidden',
    }}>
      <Photo kind="frame" label="cover · custom home framing" height={density === 'dense' ? 160 : 220}/>
      <div style={{ padding: density === 'dense' ? '20px 32px 28px' : '28px 40px 32px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginTop: density === 'dense' ? -64 : -88 }}>
          <div style={{ background: B.surface, padding: 5, borderRadius: '50%' }}>
            <Avatar initials={me.initials} size={density === 'dense' ? 110 : 144} tone={me.avatar}/>
          </div>
          <div style={{ flex: 1, paddingTop: density === 'dense' ? 70 : 96 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 className="serif" style={{
                margin: 0, fontSize: density === 'dense' ? 30 : 40, fontWeight: 600,
                color: B.text, letterSpacing: '-0.02em',
              }}>{me.name}</h1>
              {me.verified && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', background: B.accentSoft, color: B.accent,
                  borderRadius: 100, fontSize: 11, fontWeight: 600,
                }}>
                  <Icon name="verified" size={12} stroke={2}/> Verified Smith
                </span>
              )}
            </div>
            <p style={{ margin: '8px 0 0', color: B.text, fontSize: 17 }}>{me.headline}</p>
            <div style={{ display: 'flex', gap: 24, marginTop: 12, color: B.dim, fontSize: 13, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon name="mappin" size={14}/> {me.location}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon name="briefcase" size={14}/> {me.yearsExp} years building
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon name="users" size={14}/> 487 in network
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, paddingTop: density === 'dense' ? 70 : 96 }}>
            <button style={{
              background: B.text, color: B.surface, border: 'none',
              padding: '11px 20px', borderRadius: 100, fontWeight: 600, fontSize: 13,
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              <Icon name="plus" size={14} stroke={2.4}/> Connect
            </button>
            <button style={{
              background: 'transparent', color: B.text, border: `1px solid ${B.line}`,
              padding: '11px 18px', borderRadius: 100, fontWeight: 600, fontSize: 13,
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              <Icon name="message" size={14}/> Message
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 24, flexWrap: 'wrap' }}>
          {me.trades.map(t => (
            <span
              key={t.name}
              className="trade-chip"
              title={`${t.years} years of experience`}
              style={{
                padding: '6px 12px', background: B.bg, border: `1px solid ${B.line}`,
                borderRadius: 100, fontSize: 12, color: B.text, fontWeight: 500,
                display: 'inline-flex', alignItems: 'center', gap: 8,
                cursor: 'default',
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
      </div>
    </section>
  );
};

// ── Companies (paper-and-pencil treatment) ──────────────
const CompaniesB = ({ density = 'visual' }) => {
  const [open, setOpen] = React.useState({ highline: true, whitfield: true, paramount: false });
  return (
    <section style={{
      background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4,
      padding: density === 'dense' ? '24px 32px' : '32px 40px',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <h2 className="serif" style={{ margin: 0, fontSize: 24, fontWeight: 600, color: B.text, letterSpacing: '-0.01em' }}>Where I've worked</h2>
        <span style={{ color: B.faint, fontSize: 12 }}>3 companies · 6 jobsites</span>
      </div>
      <p style={{ margin: '0 0 24px', color: B.dim, fontSize: 14 }}>The companies, and the projects under each.</p>

      {/* Timeline w/ dots */}
      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute', left: 26, top: 8, bottom: 8, width: 1,
          background: B.line, zIndex: 0,
        }}/>
        {SAMPLE.companies.map((co, i) => (
          <div key={co.id} style={{ marginBottom: i === SAMPLE.companies.length - 1 ? 0 : 28, position: 'relative' }}>
            <button onClick={() => setOpen(o => ({ ...o, [co.id]: !o[co.id] }))} style={{
              width: '100%', background: 'transparent', border: 'none', padding: 0,
              display: 'flex', alignItems: 'flex-start', gap: 18, textAlign: 'left',
            }}>
              <div style={{
                width: 54, height: 54, background: B.bg, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: B.accent, flexShrink: 0, position: 'relative', zIndex: 1,
                border: `1px solid ${B.line}`,
              }}>
                <Icon name="building" size={22} stroke={1.4}/>
              </div>
              <div style={{ flex: 1, paddingTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="serif" style={{ color: B.text, fontWeight: 600, fontSize: 19, letterSpacing: '-0.01em' }}>{co.name}</span>
                  {!co.claimed && (
                    <span style={{
                      fontSize: 10, color: B.dim, padding: '2px 8px',
                      border: `1px dashed ${B.line}`, borderRadius: 100,
                      fontStyle: 'italic',
                    }}>company unclaimed</span>
                  )}
                </div>
                <div style={{ color: B.text, fontSize: 14, marginTop: 4 }}>{co.role} · <span style={{ color: B.dim }}>{co.type}</span></div>
                <div style={{ color: B.faint, fontSize: 12, marginTop: 4 }}>{co.from} – {co.to}</div>
              </div>
              <Icon name={open[co.id] ? 'chevron-d' : 'chevron-r'} size={18} style={{ color: B.dim, marginTop: 18 }}/>
            </button>

            {open[co.id] && (
              <div style={{ marginLeft: 72, marginTop: 14 }}>
                <div style={{ color: B.faint, fontSize: 11, marginBottom: 10, fontStyle: 'italic' }}>
                  Jobsites — {co.jobsites.length}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: density === 'dense' ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                  {co.jobsites.map((js, j) => (
                    <div key={j} style={{
                      background: B.bg, border: `1px solid ${B.line}`, borderRadius: 4,
                      overflow: 'hidden', display: 'flex',
                      flexDirection: density === 'dense' ? 'row' : 'column',
                    }}>
                      <Photo kind={js.photo} label={js.title.toLowerCase()}
                        height={density === 'dense' ? 76 : 132}
                        style={{ width: density === 'dense' ? 110 : '100%', flexShrink: 0 }}/>
                      <div style={{ padding: '10px 14px', flex: 1 }}>
                        <div className="serif" style={{ color: B.text, fontWeight: 600, fontSize: 14 }}>{js.title}</div>
                        <div style={{ color: B.dim, fontSize: 12, marginTop: 2 }}>{js.kind}</div>
                        <div style={{ color: B.faint, fontSize: 11, marginTop: 6 }}>{js.loc} · {js.dur}</div>
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
};

// ── Featured ─────────────────────────────────────────────
const FeaturedB = ({ density = 'visual' }) => (
  <section style={{ background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4, padding: '32px 40px' }}>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
      <h2 className="serif" style={{ margin: 0, fontSize: 24, fontWeight: 600, color: B.text, letterSpacing: '-0.01em' }}>Selected work</h2>
      <button style={{ background: 'transparent', border: 'none', color: B.accent, fontSize: 13, fontWeight: 600 }}>All projects →</button>
    </div>
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
      gridTemplateRows: density === 'dense' ? '180px' : '240px 130px', gap: 10,
    }}>
      {density === 'visual' ? (
        <>
          <div style={{ gridColumn: 'span 2', gridRow: 'span 2', position: 'relative', borderRadius: 4, overflow: 'hidden' }}>
            <Photo kind="frame" label="avenues residence" height="100%"/>
            <div style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
              padding: '40px 22px 18px', color: '#fff',
            }}>
              <div style={{ fontSize: 11, opacity: 0.8, fontStyle: 'italic' }}>Featured project · Custom Home</div>
              <div className="serif" style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>Avenues Residence</div>
            </div>
          </div>
          <Photo kind="kitchen" label="aspen grove kitchen" height="100%" style={{ borderRadius: 4 }}/>
          <Photo kind="wood" label="beaver creek lodge" height="100%" style={{ borderRadius: 4 }}/>
          <Photo kind="workshop" label="story mill library" height="100%" style={{ borderRadius: 4 }}/>
          <Photo kind="brick" label="14th & grand" height="100%" style={{ borderRadius: 4 }}/>
        </>
      ) : (
        SAMPLE.featured.slice(0, 4).map((f, i) => (
          <Photo key={i} kind={f.photo} label={f.title.toLowerCase()} height="100%" style={{ borderRadius: 4 }}/>
        ))
      )}
    </div>
  </section>
);

// ── Credentials ──────────────────────────────────────────
const CredentialsB = () => {
  const me = SAMPLE.me;
  return (
    <section style={{ background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4, padding: '32px 40px' }}>
      <h2 className="serif" style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 600, color: B.text, letterSpacing: '-0.01em' }}>Credentials & licensure</h2>
      <p style={{ margin: '0 0 24px', color: B.dim, fontSize: 14 }}>Third-party verified. The paperwork that backs the work.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {me.licenses.map((l, i) => (
          <div key={i} style={{
            border: `1px solid ${B.line}`, borderRadius: 4, padding: '16px 18px',
            background: B.bg, position: 'relative',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 4, background: B.accentSoft,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: B.accent,
              }}>
                <Icon name="shield" size={18}/>
              </div>
              {l.verified && (
                <Icon name="verified" size={18} style={{ color: B.accent }}/>
              )}
            </div>
            <div className="serif" style={{ color: B.text, fontWeight: 600, fontSize: 15 }}>{l.name}</div>
            <div style={{ color: B.faint, fontSize: 11, marginTop: 4 }}>
              {l.no} · Expires {l.exp}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 16, padding: '20px 22px', background: B.bg,
        border: `1px solid ${B.line}`, borderRadius: 4,
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32,
      }}>
        <div>
          <div style={{ color: B.faint, fontSize: 11, fontStyle: 'italic' }}>Union affiliation</div>
          <div className="serif" style={{ color: B.text, fontWeight: 600, fontSize: 17, marginTop: 6, letterSpacing: '-0.01em' }}>{me.union}</div>
          <div style={{ color: B.dim, fontSize: 13, marginTop: 2 }}>Member since 2008 · in good standing</div>
        </div>
        <div>
          <div style={{ color: B.faint, fontSize: 11, fontStyle: 'italic' }}>Apprenticeship hours</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
            <span className="serif" style={{ color: B.text, fontWeight: 700, fontSize: 24, letterSpacing: '-0.02em' }}>{me.apprentice.hours.toLocaleString()}</span>
            <span style={{ color: B.dim, fontSize: 13 }}>· {me.apprentice.status}</span>
          </div>
          <div style={{ height: 5, background: B.surface2, borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
            <div style={{ width: '100%', height: '100%', background: B.accent }}/>
          </div>
        </div>
      </div>
    </section>
  );
};

// ── Right rail ──────────────────────────────────────────
const RightRailB = () => (
  <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <section style={{ background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4, padding: '24px 26px' }}>
      <h3 className="serif" style={{ margin: '0 0 18px', fontSize: 17, fontWeight: 600, color: B.text, letterSpacing: '-0.01em' }}>Skills</h3>
      {[
        { skill: 'Custom Millwork', level: 5, endorsements: 47 },
        { skill: 'Framing', level: 5, endorsements: 38 },
        { skill: 'Cabinetry', level: 4, endorsements: 22 },
        { skill: 'Stair Building', level: 4, endorsements: 14 },
        { skill: 'Timber Frame', level: 3, endorsements: 9 },
      ].map(s => (
        <div key={s.skill} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ color: B.text, fontSize: 13, fontWeight: 500 }}>{s.skill}</span>
            <span style={{ color: B.faint, fontSize: 11 }}>{s.endorsements} endorsements</span>
          </div>
          <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
            {[1,2,3,4,5].map(n => (
              <div key={n} style={{
                flex: 1, height: 5, background: n <= s.level ? B.accent : B.surface2, borderRadius: 2,
              }}/>
            ))}
          </div>
        </div>
      ))}
    </section>

    <section style={{ background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4, padding: '24px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 className="serif" style={{ margin: 0, fontSize: 17, fontWeight: 600, color: B.text, letterSpacing: '-0.01em' }}>In your network</h3>
        <span style={{ color: B.faint, fontSize: 12 }}>487</span>
      </div>
      {SAMPLE.connections.slice(0, 4).map(c => (
        <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: `1px solid ${B.line}` }}>
          <Avatar initials={c.initials} size={38} tone={c.tone}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: B.text, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
            <div style={{ color: B.dim, fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.role}</div>
          </div>
        </div>
      ))}
      <button style={{
        width: '100%', marginTop: 14, padding: '10px', background: 'transparent',
        border: `1px solid ${B.line}`, color: B.text, fontSize: 12, fontWeight: 600,
        borderRadius: 100,
      }}>See all 487</button>
    </section>
  </aside>
);

// ── Profile page ─────────────────────────────────────────
const ProfilePageB = ({ density, navStyle }) => (
  <div style={{ background: B.bg, color: B.text, minHeight: '100%' }}>
    {navStyle === 'sidebar' ? (
      <div style={{ display: 'flex', minHeight: '100%' }}>
        <SidebarB active="profile"/>
        <main style={{ flex: 1, padding: '32px 40px', maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ProfileHeaderB density={density}/>
              <FeaturedB density={density}/>
              <CompaniesB density={density}/>
              <CredentialsB/>
            </div>
            <RightRailB/>
          </div>
        </main>
      </div>
    ) : (
      <>
        <TopNavB active="profile"/>
        <main style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ProfileHeaderB density={density}/>
              <FeaturedB density={density}/>
              <CompaniesB density={density}/>
              <CredentialsB/>
            </div>
            <RightRailB/>
          </div>
        </main>
      </>
    )}
  </div>
);

// ── Feed Post ────────────────────────────────────────────
const FeedPostB = ({ post }) => (
  <article style={{
    background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4, overflow: 'hidden',
  }}>
    <div style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <Avatar initials={post.who.initials} size={44} tone={post.who.tone}/>
      <div style={{ flex: 1 }}>
        <div className="serif" style={{ color: B.text, fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em' }}>{post.who.name}</div>
        <div style={{ color: B.dim, fontSize: 12 }}>{post.who.role} · <span style={{ color: B.faint }}>{post.time}</span></div>
      </div>
      <button style={{ background: 'transparent', border: 'none', color: B.dim }}>
        <Icon name="more" size={18}/>
      </button>
    </div>
    <div style={{ padding: '0 24px 18px', color: B.text, fontSize: 14.5, lineHeight: 1.6 }}>
      {post.copy}
      {post.tags && (
        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          {post.tags.map(t => (
            <span key={t} style={{
              padding: '4px 10px', background: B.accentSoft, color: B.accent,
              fontSize: 11, fontWeight: 600, borderRadius: 100,
            }}>{t}</span>
          ))}
        </div>
      )}
    </div>
    {post.photos && (
      <div style={{
        display: 'grid',
        gridTemplateColumns: post.photos.length === 1 ? '1fr' : `repeat(${Math.min(post.photos.length, 3)}, 1fr)`,
        gap: 2,
      }}>
        {post.photos.map((p, i) => (
          <Photo key={i} kind={p} label={post.stats?.project?.toLowerCase() || p} height={post.photos.length === 1 ? 380 : 240}/>
        ))}
      </div>
    )}
    {post.milestone && (
      <div style={{
        padding: '14px 24px', background: B.accentSoft, borderTop: `1px solid ${B.line}`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Icon name="award" size={20} style={{ color: B.accent }}/>
        <div>
          <div style={{ color: B.faint, fontSize: 11, fontStyle: 'italic' }}>Milestone</div>
          <div className="serif" style={{ color: B.text, fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em' }}>{post.milestone}</div>
        </div>
      </div>
    )}
    <div style={{
      padding: '6px 18px', borderTop: `1px solid ${B.line}`,
      display: 'flex', alignItems: 'center', gap: 4,
    }}>
      {[
        { icon: 'thumb', label: post.stats?.likes },
        { icon: 'comment', label: post.stats?.comments },
        { icon: 'share', label: 'Share' },
      ].map((b, i) => (
        <button key={i} style={{
          flex: 1, padding: '10px', background: 'transparent', border: 'none',
          color: B.dim, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontSize: 13, fontWeight: 500,
        }}>
          <Icon name={b.icon} size={16}/>
          {b.label && <span>{b.label}</span>}
        </button>
      ))}
    </div>
  </article>
);

// ── Feed page ────────────────────────────────────────────
const FeedPageB = ({ navStyle }) => {
  const Body = (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 40px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 320px', gap: 16, alignItems: 'flex-start' }}>
        <aside style={{ background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4, overflow: 'hidden', position: 'sticky', top: 88 }}>
          <Photo kind="frame" label="cover" height={64}/>
          <div style={{ padding: '0 22px 22px', marginTop: -28, textAlign: 'center' }}>
            <div style={{ display: 'inline-block', background: B.surface, padding: 4, borderRadius: '50%' }}>
              <Avatar initials="MW" size={64} tone="rust"/>
            </div>
            <div className="serif" style={{ color: B.text, fontWeight: 600, fontSize: 17, marginTop: 10, letterSpacing: '-0.01em' }}>Marcus Whitfield</div>
            <div style={{ color: B.dim, fontSize: 12, marginTop: 2 }}>Master Carpenter · Salt Lake City, UT</div>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 16, paddingTop: 16, borderTop: `1px solid ${B.line}` }}>
              <div>
                <div className="serif" style={{ color: B.text, fontWeight: 700, fontSize: 18 }}>487</div>
                <div style={{ color: B.faint, fontSize: 11, fontStyle: 'italic' }}>network</div>
              </div>
              <div>
                <div className="serif" style={{ color: B.text, fontWeight: 700, fontSize: 18 }}>23</div>
                <div style={{ color: B.faint, fontSize: 11, fontStyle: 'italic' }}>jobsites</div>
              </div>

            </div>
          </div>
        </aside>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4, padding: '16px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar initials="MW" size={42} tone="rust"/>
              <button style={{
                flex: 1, textAlign: 'left', padding: '11px 16px', background: B.bg,
                border: `1px solid ${B.line}`, color: B.dim, borderRadius: 100, fontSize: 14,
              }}>What are you building today, Marcus?</button>
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${B.line}` }}>
              {[
                { icon: 'image', label: 'Photo' },
                { icon: 'briefcase', label: 'Project update' },
                { icon: 'award', label: 'Milestone' },
              ].map(b => (
                <button key={b.label} style={{
                  flex: 1, padding: '8px', background: 'transparent', border: 'none',
                  color: B.dim, fontSize: 12, fontWeight: 500,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  <Icon name={b.icon} size={15} style={{ color: B.accent }}/> {b.label}
                </button>
              ))}
            </div>
          </div>
          {SAMPLE.feed.map((p, i) => <FeedPostB key={i} post={p}/>)}
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 88 }}>
          <section style={{ background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4, padding: '22px 24px' }}>
            <h3 className="serif" style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: B.text, letterSpacing: '-0.01em' }}>People you may know</h3>
            <p style={{ margin: '0 0 12px', color: B.faint, fontSize: 12, fontStyle: 'italic' }}>From your trade and area</p>
            {SAMPLE.connections.slice(0, 3).map(c => (
              <div key={c.name} style={{ paddingTop: 14, marginTop: 14, borderTop: `1px solid ${B.line}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar initials={c.initials} size={42} tone={c.tone}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: B.text, fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                  <div style={{ color: B.dim, fontSize: 11 }}>{c.role}</div>
                  <div style={{ color: B.faint, fontSize: 11, marginTop: 2, fontStyle: 'italic' }}>{c.mutual} mutual</div>
                </div>
                <button style={{
                  background: 'transparent', border: `1px solid ${B.accent}`,
                  color: B.accent, padding: '6px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700,
                }}>+</button>
              </div>
            ))}
          </section>

          <section style={{ background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4, padding: '22px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
              <h3 className="serif" style={{ margin: 0, fontSize: 16, fontWeight: 600, color: B.text, letterSpacing: '-0.01em' }}>The trade · industry news</h3>
              <a href="#" style={{ color: B.accent, fontSize: 11, fontWeight: 600 }}>See all</a>
            </div>
            <div style={{ color: B.faint, fontSize: 11, fontStyle: 'italic', marginBottom: 10 }}>
              Generic for now · personalizes by trade & role over time
            </div>
            {[
              {
                src: 'ENR',
                dot: 'Codes',
                title: '2024 IBC adoption hits 38 states — what changes for residential GCs',
                meta: '4 min read · 2d ago',
              },
              {
                src: 'Construction Dive',
                dot: 'Materials',
                title: 'Lumber futures slip 6% as housing starts soften into Q2',
                meta: '3 min read · 1d ago',
              },
              {
                src: 'OSHA',
                dot: 'Safety',
                title: 'Updated heat illness rule takes effect for outdoor crews June 1',
                meta: 'Bulletin · 4d ago',
              },
              {
                src: 'AGC',
                dot: 'Labor',
                title: 'Skilled trade wages up 7.2% YoY; carpenters lead the cohort',
                meta: '5 min read · 6d ago',
              },
            ].map((n, i) => (
              <div key={i} style={{ paddingTop: 12, marginTop: 12, borderTop: i ? `1px solid ${B.line}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: B.accent, padding: '2px 6px',
                    background: B.accentSoft, borderRadius: 2,
                  }}>{n.dot}</span>
                  <span style={{ color: B.faint, fontSize: 11 }}>{n.src}</span>
                </div>
                <div className="serif" style={{ color: B.text, fontSize: 13.5, fontWeight: 600, lineHeight: 1.35, letterSpacing: '-0.01em' }}>{n.title}</div>
                <div style={{ color: B.faint, fontSize: 11, marginTop: 4, fontStyle: 'italic' }}>{n.meta}</div>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </main>
  );

  return (
    <div style={{ background: B.bg, color: B.text, minHeight: '100%' }}>
      {navStyle === 'sidebar' ? (
        <div style={{ display: 'flex', minHeight: '100%' }}>
          <SidebarB active="feed"/>
          <div style={{ flex: 1 }}>{Body}</div>
        </div>
      ) : (<><TopNavB active="feed"/>{Body}</>)}
    </div>
  );
};

// ── Connections ─────────────────────────────────────────
const ConnectionsPageB = ({ navStyle }) => {
  const [tab, setTab] = React.useState('connections');
  const Body = (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 40px' }}>
      <h1 className="serif" style={{ color: B.text, fontSize: 36, fontWeight: 600, margin: 0, letterSpacing: '-0.02em' }}>Your network</h1>
      <p style={{ color: B.dim, fontSize: 15, marginTop: 6 }}>The people you've worked with, and the ones you should.</p>

      <div style={{ display: 'flex', gap: 28, marginTop: 28, borderBottom: `1px solid ${B.line}`, alignItems: 'flex-end' }}>
        {[
          { k: 'connections', label: 'Connections', count: 487 },
          { k: 'pending', label: 'Pending', count: 7 },
          { k: 'suggestions', label: 'Suggestions', count: 142 },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            padding: '12px 0', background: 'transparent', border: 'none',
            color: tab === t.k ? B.text : B.dim,
            borderBottom: tab === t.k ? `2px solid ${B.accent}` : '2px solid transparent',
            fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            {t.label}
            <span style={{ color: B.faint, fontSize: 11, fontWeight: 500 }}>{t.count}</span>
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', paddingBottom: 8 }}>
          <div style={{
            background: B.surface, border: `1px solid ${B.line}`, borderRadius: 100,
            padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, color: B.dim,
          }}>
            <Icon name="search" size={14}/>
            <span style={{ fontSize: 12 }}>Filter your network…</span>
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 14, marginTop: 24,
      }}>
        {SAMPLE.connections.map(c => (
          <div key={c.name} style={{
            background: B.surface, border: `1px solid ${B.line}`, borderRadius: 4, overflow: 'hidden',
          }}>
            <Photo kind={c.tone === 'sage' ? 'crew' : c.tone === 'rust' ? 'workshop' : c.tone === 'slate' ? 'steel' : 'wood'}
              label="" height={64}/>
            <div style={{ padding: '0 22px 22px', marginTop: -32 }}>
              <div style={{ background: B.surface, padding: 4, borderRadius: '50%', display: 'inline-block' }}>
                <Avatar initials={c.initials} size={62} tone={c.tone}/>
              </div>
              <div style={{ marginTop: 14 }}>
                <div className="serif" style={{ color: B.text, fontWeight: 600, fontSize: 17, letterSpacing: '-0.01em' }}>{c.name}</div>
                <div style={{ color: B.text, fontSize: 13, marginTop: 4 }}>{c.role}</div>
                <div style={{ color: B.dim, fontSize: 12, marginTop: 2 }}>{c.co}</div>
                <div style={{ color: B.faint, fontSize: 11, marginTop: 8, fontStyle: 'italic' }}>
                  {c.loc} · {c.mutual} mutual
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button style={{
                  flex: 1, background: 'transparent', border: `1px solid ${B.line}`,
                  color: B.text, padding: '9px', borderRadius: 100, fontSize: 12, fontWeight: 600,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  <Icon name="message" size={13}/> Message
                </button>
                <button style={{
                  background: B.text, border: 'none', color: B.surface,
                  padding: '9px 16px', borderRadius: 100, fontSize: 12, fontWeight: 600,
                }}>Connected</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );

  return (
    <div style={{ background: B.bg, color: B.text, minHeight: '100%' }}>
      {navStyle === 'sidebar' ? (
        <div style={{ display: 'flex', minHeight: '100%' }}>
          <SidebarB active="connections"/>
          <div style={{ flex: 1 }}>{Body}</div>
        </div>
      ) : (<><TopNavB active="connections"/>{Body}</>)}
    </div>
  );
};

// ── Onboarding ──────────────────────────────────────────
const OnboardingB = () => {
  const [step] = React.useState(2);
  const steps = [
    { n: 1, label: 'You' },
    { n: 2, label: 'Trade' },
    { n: 3, label: 'Companies' },
    { n: 4, label: 'Network' },
  ];
  return (
    <div style={{ background: B.bg, color: B.text, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '20px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${B.line}` }}>
        <SmithLogoB/>
        <span style={{ color: B.faint, fontSize: 12, fontStyle: 'italic' }}>Step {step} of 4</span>
      </header>

      <main style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'stretch' }}>
        <div style={{ padding: '56px 72px', maxWidth: 580, width: '100%', justifySelf: 'end' }}>
          <div style={{ display: 'flex', gap: 0, marginBottom: 36 }}>
            {steps.map((s, i) => (
              <div key={s.n} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: s.n <= step ? B.accent : B.surface,
                  border: `1px solid ${s.n <= step ? B.accent : B.line}`,
                  color: s.n <= step ? '#fff' : B.dim,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700,
                }} className="serif">{s.n}</div>
                <span style={{ fontSize: 12, color: s.n <= step ? B.text : B.dim, fontWeight: 500 }}>{s.label}</span>
                {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: s.n < step ? B.accent : B.line, marginLeft: 8 }}/>}
              </div>
            ))}
          </div>

          <div style={{ color: B.accent, fontSize: 12, fontStyle: 'italic', marginBottom: 10 }}>02 — your trade</div>
          <h1 className="serif" style={{ margin: 0, fontSize: 44, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.05 }}>
            What do you build?
          </h1>
          <p style={{ margin: '14px 0 32px', color: B.dim, fontSize: 16, lineHeight: 1.55 }}>
            Pick your primary trade. Add specializations next — most makers wear more than one hat.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { t: 'Carpentry', selected: true, ic: 'tool' },
              { t: 'Electrical', ic: 'tool' },
              { t: 'Plumbing', ic: 'tool' },
              { t: 'Concrete & Masonry', ic: 'tool' },
              { t: 'Roofing', ic: 'tool' },
              { t: 'HVAC', ic: 'tool' },
              { t: 'Painting & Finishing', ic: 'tool' },
              { t: 'Tile & Flooring', ic: 'tool' },
              { t: 'Project Management', ic: 'briefcase' },
              { t: 'General Contracting', ic: 'hardhat' },
            ].map(o => (
              <button key={o.t} style={{
                padding: '14px 18px', textAlign: 'left',
                background: o.selected ? B.accentSoft : B.surface,
                border: `1px solid ${o.selected ? B.accent : B.line}`,
                borderRadius: 4, color: B.text,
                display: 'flex', alignItems: 'center', gap: 12, fontSize: 13.5, fontWeight: 500,
              }}>
                <Icon name={o.ic} size={16} style={{ color: o.selected ? B.accent : B.dim }}/>
                {o.t}
                {o.selected && <Icon name="check" size={14} style={{ color: B.accent, marginLeft: 'auto' }}/>}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 36, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button style={{
              background: 'transparent', border: 'none', color: B.dim,
              fontSize: 14, fontWeight: 500, padding: '10px 0',
            }}>← Back</button>
            <button style={{
              background: B.text, border: 'none', color: B.surface,
              padding: '13px 32px', borderRadius: 100, fontSize: 14, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              Continue <Icon name="arrow-r" size={14} stroke={2.4}/>
            </button>
          </div>
        </div>

        <div style={{ position: 'relative', overflow: 'hidden' }}>
          <Photo kind="frame" label="for the ones who build" height="100%"/>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, rgba(42,31,23,0.2), rgba(42,31,23,0.7))',
          }}/>
          <div style={{
            position: 'absolute', left: 56, bottom: 64, color: '#fff', maxWidth: 400,
          }}>
            <div style={{ color: '#fff', opacity: 0.85, fontSize: 12, fontStyle: 'italic', marginBottom: 16 }}>
              Smith — for makers
            </div>
            <div className="serif" style={{ fontSize: 38, fontWeight: 500, lineHeight: 1.1, letterSpacing: '-0.025em' }}>
              The work is the résumé.
            </div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', marginTop: 18, lineHeight: 1.6 }}>
              A network for the people behind the build — carpenters, electricians, masons, GCs. Connect by the projects you've stood on, not just the titles you've held.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

Object.assign(window, {
  ProfilePageB, FeedPageB, ConnectionsPageB, OnboardingB, SmithLogoB, B_THEME: B,
});
