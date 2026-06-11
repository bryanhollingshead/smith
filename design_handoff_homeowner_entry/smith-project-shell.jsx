/* Smith — Project Workspace shell (Direction B)
   Collapsible left rail with project switcher + feature nav.
   Wraps every Project page so chrome is consistent.
*/

const ProjectShell = ({
  active = 'home', role = 'gc', collapsed = false, children,
  project, breadcrumb, action,
  navItems: navItemsProp, otherProjects: otherProjectsProp,
  roleData: roleDataProp, headerLabel,
}) => {
  const B = window.B_THEME;

  const proj = project || {
    name: 'Avenues Residence',
    addr: '142 Emigration Canyon Rd · Salt Lake City, UT',
    cover: 'frame',
    phase: 'Rough framing',
    day: 47,
    of: 184,
    color: '#C8731F',
  };

  const otherProjects = otherProjectsProp || [
    { name: 'Granary Row Lofts', sub: 'Highline Build Co.', cover: 'concrete', dot: '#7A8A3F' },
    { name: 'Millcreek Cabin', sub: 'Coleman & Daughters', cover: 'workshop', dot: '#A33A2A' },
    { name: 'Park Street Remodel', sub: 'Owner-direct', cover: 'detail', dot: '#5B7A8A' },
  ];

  const navItems = navItemsProp || [
    { k: 'home',     label: 'Home',     icon: 'home',      sub: 'Project overview' },
    { k: 'bids',     label: 'Bids',     icon: 'send',      sub: 'Open · 3', badge: 3 },
    { k: 'calendar', label: 'Calendar', icon: 'calendar',  sub: 'This week · 8 events' },
    { k: 'team',     label: 'Team',     icon: 'users',     sub: '12 people · 6 trades' },
    { k: 'tasks',    label: 'Tasks',    icon: 'check',     sub: 'Today · 7 open', badge: 7 },
    { k: 'files',    label: 'Files',    icon: 'image',     sub: 'Plans · photos · docs' },
    { k: 'decisions',label: 'Decisions',icon: 'star',      sub: '2 awaiting owner' },
    { k: 'budget',   label: 'Budget',   icon: 'briefcase', sub: 'On track' },
  ];

  const railWidth = collapsed ? 64 : 280;

  const ROLES = {
    homeowner: { label: 'Homeowner', icon: 'home',     color: '#5B7A8A' },
    solo:      { label: 'Solo trade', icon: 'tool',     color: '#7A8A3F' },
    sub:       { label: 'Sub · company', icon: 'briefcase', color: '#C8731F' },
    gc:        { label: 'General contractor', icon: 'hardhat', color: '#A33A2A' },
  };
  const roleData = roleDataProp || ROLES[role] || ROLES.gc;

  return (
    <div style={{ background: B.bg, color: B.text, minHeight: '100%', display: 'flex' }}>
      {/* ── Left rail ────────────────────── */}
      <aside style={{
        width: railWidth,
        background: B.surface,
        borderRight: `1px solid ${B.line}`,
        display: 'flex', flexDirection: 'column',
        flexShrink: 0,
        transition: 'width 200ms ease',
      }}>
        {/* Brand + collapse */}
        <div style={{
          padding: collapsed ? '20px 0' : '20px 22px',
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          borderBottom: `1px solid ${B.line}`,
          minHeight: 64, boxSizing: 'border-box',
        }}>
          {collapsed ? (
            <div className="serif" style={{
              fontSize: 22, fontWeight: 600, color: B.text, letterSpacing: '-0.02em',
            }}>S</div>
          ) : (
            <>
              <SmithLogoB/>
              <button title="Collapse rail" style={{
                background: 'transparent', border: 'none', color: B.faint,
                padding: 4, cursor: 'pointer', display: 'inline-flex',
              }}>
                <Icon name="menu" size={16}/>
              </button>
            </>
          )}
        </div>

        {/* Project switcher */}
        <div style={{
          padding: collapsed ? '14px 8px' : '16px 18px',
          borderBottom: `1px solid ${B.line}`,
        }}>
          {collapsed ? (
            <div title={proj.name} style={{
              width: 44, height: 44, borderRadius: 4, margin: '0 auto',
              border: `2px solid ${proj.color}`, overflow: 'hidden',
            }}>
              <Photo kind={proj.cover} height="100%"/>
            </div>
          ) : (
            <>
              <div style={{
                color: B.faint, fontSize: 10, letterSpacing: '0.08em',
                textTransform: 'uppercase', fontWeight: 600, marginBottom: 8,
              }}>Project</div>
              <button style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px', background: B.bg, border: `1px solid ${B.line}`,
                borderRadius: 4, cursor: 'pointer', textAlign: 'left',
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 4,
                  border: `2px solid ${proj.color}`, overflow: 'hidden', flexShrink: 0,
                }}>
                  <Photo kind={proj.cover} height="100%"/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="serif" style={{
                    color: B.text, fontWeight: 600, fontSize: 13.5,
                    letterSpacing: '-0.01em', whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{proj.name}</div>
                  <div style={{
                    color: B.dim, fontSize: 11, marginTop: 1, fontStyle: 'italic',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>Day {proj.day} · {proj.phase}</div>
                </div>
                <Icon name="chevron-d" size={14} style={{ color: B.faint }}/>
              </button>

              {/* Mini project peek */}
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {otherProjects.slice(0, 2).map(p => (
                  <div key={p.name} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '5px 6px', borderRadius: 3, cursor: 'pointer',
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', background: p.dot, flexShrink: 0,
                    }}/>
                    <span style={{
                      color: B.dim, fontSize: 11.5,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
                    }}>{p.name}</span>
                  </div>
                ))}
                <div style={{
                  color: B.faint, fontSize: 11, padding: '5px 6px', fontStyle: 'italic', cursor: 'pointer',
                }}>+ {otherProjects.length - 2} more · all projects</div>
              </div>
            </>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: collapsed ? '14px 8px' : '14px 12px', overflowY: 'auto' }}>
          {!collapsed && (
            <div style={{
              color: B.faint, fontSize: 10, letterSpacing: '0.08em',
              textTransform: 'uppercase', fontWeight: 600,
              padding: '4px 8px 8px',
            }}>Workspace</div>
          )}
          {navItems.map(item => {
            const isActive = item.k === active;
            return (
              <button key={item.k} title={collapsed ? item.label : undefined} style={{
                width: '100%', display: 'flex', alignItems: 'center',
                gap: 12, padding: collapsed ? '10px 0' : '9px 10px',
                marginBottom: 2,
                justifyContent: collapsed ? 'center' : 'flex-start',
                background: isActive ? B.accentSoft : 'transparent',
                border: 'none',
                borderRadius: 4, cursor: 'pointer', textAlign: 'left',
                position: 'relative',
              }}>
                {isActive && !collapsed && (
                  <div style={{
                    position: 'absolute', left: -12, top: 6, bottom: 6, width: 2,
                    background: B.accent, borderRadius: '0 2px 2px 0',
                  }}/>
                )}
                <Icon name={item.icon} size={16} style={{
                  color: isActive ? B.accent : B.dim, flexShrink: 0,
                }}/>
                {!collapsed && (
                  <>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        color: isActive ? B.text : B.text,
                        fontSize: 13.5, fontWeight: isActive ? 600 : 500,
                      }}>{item.label}</div>
                      {item.sub && (
                        <div style={{
                          color: B.faint, fontSize: 10.5, marginTop: 1, fontStyle: 'italic',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>{item.sub}</div>
                      )}
                    </div>
                    {item.badge && (
                      <span style={{
                        background: isActive ? B.accent : B.text, color: B.surface,
                        fontSize: 10, fontWeight: 700,
                        padding: '2px 6px', borderRadius: 100, lineHeight: 1.4,
                      }}>{item.badge}</span>
                    )}
                  </>
                )}
                {collapsed && item.badge && (
                  <span style={{
                    position: 'absolute', top: 4, right: 8,
                    width: 6, height: 6, borderRadius: '50%', background: B.accent,
                  }}/>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer — current role + back to network */}
        <div style={{
          borderTop: `1px solid ${B.line}`,
          padding: collapsed ? '14px 8px' : '14px 18px',
        }}>
          {!collapsed && (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', background: B.bg, border: `1px solid ${B.line}`,
                borderRadius: 4, marginBottom: 10,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: roleData.color, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon name={roleData.icon} size={13}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: B.faint, fontSize: 10, fontStyle: 'italic' }}>You're viewing as</div>
                  <div style={{ color: B.text, fontSize: 12.5, fontWeight: 600 }}>{roleData.label}</div>
                </div>
              </div>
              <a href="#" style={{
                color: B.dim, fontSize: 12, textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <Icon name="arrow-r" size={11} style={{ transform: 'rotate(180deg)' }}/>
                Back to Smith network
              </a>
            </>
          )}
          {collapsed && (
            <div title={roleData.label} style={{
              width: 36, height: 36, margin: '0 auto', borderRadius: '50%',
              background: roleData.color, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name={roleData.icon} size={14}/>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main column ────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <header style={{
          height: 64, padding: '0 32px', boxSizing: 'border-box',
          background: B.surface, borderBottom: `1px solid ${B.line}`,
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
            {breadcrumb ? breadcrumb : (
              <>
                <span className="serif" style={{
                  color: B.text, fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em',
                }}>{navItems.find(n => n.k === active)?.label || 'Home'}</span>
                <span style={{ color: B.faint, fontSize: 13, fontStyle: 'italic' }}>
                  · {proj.name}
                </span>
              </>
            )}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: B.bg, border: `1px solid ${B.line}`,
            borderRadius: 100, padding: '7px 14px', minWidth: 280, color: B.faint, fontSize: 12.5,
          }}>
            <Icon name="search" size={14}/>
            <span style={{ fontStyle: 'italic' }}>Search this project — bids, files, tasks…</span>
          </div>
          <button style={{
            background: 'transparent', border: `1px solid ${B.line}`, color: B.text,
            width: 36, height: 36, borderRadius: '50%', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            <Icon name="bell" size={15}/>
            <span style={{
              position: 'absolute', top: 4, right: 6, width: 7, height: 7,
              borderRadius: '50%', background: B.accent,
            }}/>
          </button>
          {action && action}
          <Avatar tone="brick" initials="MW" size={36}/>
        </header>

        {/* Content slot */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { ProjectShell });
