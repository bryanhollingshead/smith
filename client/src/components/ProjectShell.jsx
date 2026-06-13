// Smith — Project Workspace shell
// Collapsible left rail with project switcher + feature nav + role footer.
// Wraps every workspace screen so the chrome is consistent. First consumer
// is the homeowner SeedDashboard; tradesperson surfaces will pick this up
// in later iterations.
//
// Port of smith-project-shell.jsx from the design handoff, adapted to our
// component library (Icon / Avatar / Wordmark / theme) and our router.

import React, { useState } from 'react';
import { B } from '../lib/theme.js';
import { Icon } from './Icon.jsx';
import { Avatar, Photo } from './Primitives.jsx';
import { useRouter } from '../lib/router.jsx';
import { ModeToggle } from './ModeToggle.jsx';

// The header wordmark for the workspace chrome. Direction B = upright
// Fraunces 600 with a period as the dot — same mark as Landing.jsx's
// Wordmark, kept inline here so this file is self-contained.
function ChromeWordmark({ size = 22 }) {
  return (
    <div className="serif" style={{
      fontSize: size, fontWeight: 600, letterSpacing: '-0.02em', color: B.text,
    }}>
      Smith<span style={{ color: B.accent }}>.</span>
    </div>
  );
}

const DEFAULT_ROLES = {
  homeowner:   { label: 'Homeowner',          icon: 'home',      color: B.homeowner },
  tradesperson:{ label: 'Tradesperson',       icon: 'tool',      color: B.success },
  gc:          { label: 'General contractor', icon: 'hardhat',   color: B.danger },
};

export function ProjectShell({
  active = 'home',
  role = 'tradesperson',
  collapsed: collapsedProp = false,
  collapsible = true,
  project,
  breadcrumb,
  action,
  navItems = [],
  otherProjects = [],
  roleData: roleDataProp,
  children,
}) {
  const { navigate } = useRouter();
  const [collapsed, setCollapsed] = useState(collapsedProp);
  const railWidth = collapsed ? 64 : 280;
  const roleData = roleDataProp || DEFAULT_ROLES[role] || DEFAULT_ROLES.tradesperson;
  const proj = project || { name: '—', addr: '', cover: 'frame', phase: '', color: B.accent };

  return (
    <div style={{ background: B.bg, color: B.text, minHeight: '100vh', display: 'flex' }}>
      {/* ── Left rail ─────────────────────────────────────────────────── */}
      <aside style={{
        width: railWidth,
        background: B.surface,
        borderRight: `1px solid ${B.line}`,
        display: 'flex', flexDirection: 'column',
        flexShrink: 0,
        transition: 'width 200ms ease',
      }}>
        {/* Brand + collapse toggle */}
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
            }}>S<span style={{ color: B.accent }}>.</span></div>
          ) : (
            <>
              <button onClick={() => navigate('/feed')} style={{
                background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
              }}>
                <ChromeWordmark/>
              </button>
              {collapsible && (
                <button onClick={() => setCollapsed(true)} title="Collapse rail" style={{
                  background: 'transparent', border: 'none', color: B.faint,
                  padding: 4, cursor: 'pointer', display: 'inline-flex',
                }}>
                  <Icon name="menu" size={16}/>
                </button>
              )}
            </>
          )}
        </div>

        {/* Project switcher */}
        <div style={{
          padding: collapsed ? '14px 8px' : '16px 18px',
          borderBottom: `1px solid ${B.line}`,
        }}>
          {collapsed ? (
            <button onClick={() => setCollapsed(false)} title={proj.name} style={{
              width: 44, height: 44, borderRadius: 4, margin: '0 auto',
              border: `2px solid ${proj.color || B.accent}`,
              overflow: 'hidden', background: 'transparent', padding: 0, cursor: 'pointer',
              display: 'block',
            }}>
              <Photo kind={proj.cover || 'frame'} height={40}/>
            </button>
          ) : (
            <>
              <div style={{
                color: B.faint, fontSize: 10, letterSpacing: '0.08em',
                textTransform: 'uppercase', fontWeight: 600, marginBottom: 8,
              }}>{role === 'homeowner' ? 'Home' : 'Project'}</div>
              <button style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px', background: B.bg, border: `1px solid ${B.line}`,
                borderRadius: 4, cursor: 'pointer', textAlign: 'left',
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 4,
                  border: `2px solid ${proj.color || B.accent}`,
                  overflow: 'hidden', flexShrink: 0,
                }}>
                  <Photo kind={proj.cover || 'frame'} height={40}/>
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
                  }}>{proj.addr || proj.phase || ''}</div>
                </div>
                <Icon name="chevron-d" size={14} style={{ color: B.faint }}/>
              </button>

              {otherProjects.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {otherProjects.slice(0, 2).map(p => (
                    <div key={p.name} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '5px 6px', borderRadius: 3, cursor: 'pointer',
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: p.dot || B.accent, flexShrink: 0,
                      }}/>
                      <span style={{
                        color: B.dim, fontSize: 11.5,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
                      }}>{p.name}</span>
                    </div>
                  ))}
                  {otherProjects.length > 2 && (
                    <div style={{
                      color: B.faint, fontSize: 11, padding: '5px 6px',
                      fontStyle: 'italic', cursor: 'pointer',
                    }}>+ {otherProjects.length - 2} more · all projects</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Nav */}
        <nav style={{
          flex: 1, padding: collapsed ? '14px 8px' : '14px 12px', overflowY: 'auto',
        }}>
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
              <button key={item.k} onClick={item.onClick} title={collapsed ? item.label : undefined} style={{
                width: '100%', display: 'flex', alignItems: 'center',
                gap: 12, padding: collapsed ? '10px 0' : '9px 10px',
                marginBottom: 2,
                justifyContent: collapsed ? 'center' : 'flex-start',
                background: isActive ? B.accentSoft : 'transparent',
                border: 'none', borderRadius: 4, cursor: 'pointer', textAlign: 'left',
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
                        color: B.text, fontSize: 13.5,
                        fontWeight: isActive ? 600 : 500,
                      }}>{item.label}</div>
                      {item.sub && (
                        <div style={{
                          color: B.faint, fontSize: 10.5, marginTop: 1, fontStyle: 'italic',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>{item.sub}</div>
                      )}
                    </div>
                    {item.badge != null && (
                      <span style={{
                        background: isActive ? B.accent : B.text, color: B.surface,
                        fontSize: 10, fontWeight: 700,
                        padding: '2px 6px', borderRadius: 100, lineHeight: 1.4,
                      }}>{item.badge}</span>
                    )}
                  </>
                )}
                {collapsed && item.badge != null && (
                  <span style={{
                    position: 'absolute', top: 4, right: 8,
                    width: 6, height: 6, borderRadius: '50%', background: B.accent,
                  }}/>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer — mode toggle (Tradesman ↔ Homeowner). Replaces the old
            static "You're viewing as" card. Caller can still pass roleData
            to override the visual (used for in-tradesman GC/Sub axis), but
            the default is the live mode toggle. */}
        <div style={{
          borderTop: `1px solid ${B.line}`,
          padding: collapsed ? '14px 8px' : '14px 18px',
        }}>
          {!collapsed && (
            roleDataProp ? (
              // Caller explicitly handed us a static role card (in-tradesman
              // GC/Sub view, etc) — render the legacy card, no toggle.
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
              </>
            ) : (
              <ModeToggle variant="card"/>
            )
          )}
          {collapsed && (
            <button onClick={() => setCollapsed(false)} title={roleData.label} style={{
              width: 36, height: 36, margin: '0 auto', borderRadius: '50%',
              background: roleData.color, color: '#fff', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name={roleData.icon} size={14}/>
            </button>
          )}
        </div>
      </aside>

      {/* ── Main column ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
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
                {proj.name && (
                  <span style={{ color: B.faint, fontSize: 13, fontStyle: 'italic' }}>
                    · {proj.name}
                  </span>
                )}
              </>
            )}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: B.bg, border: `1px solid ${B.line}`,
            borderRadius: 100, padding: '7px 14px', minWidth: 280,
            color: B.faint, fontSize: 12.5,
          }}>
            <Icon name="search" size={14}/>
            <span style={{ fontStyle: 'italic' }}>Search this {role === 'homeowner' ? 'home' : 'project'}…</span>
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
          {action}
          <Avatar tone={role === 'homeowner' ? 'cream' : 'wood'} initials="·" size={36}/>
        </header>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
