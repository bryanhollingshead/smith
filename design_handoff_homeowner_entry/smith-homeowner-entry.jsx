/* Smith — Homeowner entry flows (practical / buildable)
   Two entry points that both mint a SEED home profile:
   1. "Hire me" from a tradesperson's public profile → address required
   2. Homeowner self-serve sign-up from the Smith marketing page

   Both converge on:
   3. AddressFound  — public-record + imagery auto-pull, confirm the home
   4. SeedDashboard — sparse "today" state with locked future modules as the carrot
*/

// Shared centered card shell (lighter than the big two-pane HomeFlowShell)
const EntryShell = ({ children, side, sideKind = 'frame', maxW = 480 }) => {
  const B = window.B_THEME;
  return (
    <div style={{ background: B.bg, color: B.text, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '18px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${B.line}` }}>
        <SmithLogoB/>
        <span style={{ color: B.faint, fontSize: 12.5 }}>Already have an account? <a href="#" style={{ color: B.accent, fontWeight: 600 }}>Sign in</a></span>
      </header>
      <main style={{ flex: 1, display: 'grid', gridTemplateColumns: side ? '1fr 1fr' : '1fr' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: side ? 'flex-end' : 'center', padding: '48px 56px' }}>
          <div style={{ width: '100%', maxWidth: maxW }}>{children}</div>
        </div>
        {side && (
          <div style={{ position: 'relative', overflow: 'hidden' }}>
            <Photo kind={sideKind} height="100%"/>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(42,31,23,0.2), rgba(42,31,23,0.72))' }}/>
            <div style={{ position: 'absolute', inset: 0, padding: 56, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              {side}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const EntryInput = ({ icon, label, hint, ...rest }) => {
  const B = window.B_THEME;
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ color: B.dim, fontSize: 12, fontStyle: 'italic', display: 'block', marginBottom: 6 }}>{label}</label>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: B.surface, border: `1px solid ${B.line}`, borderRadius: 8, padding: '13px 15px' }}>
        {icon && <Icon name={icon} size={16} style={{ color: B.dim }}/>}
        <input {...rest} style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: B.text, fontSize: 15, fontFamily: 'inherit' }}/>
      </div>
      {hint && <div style={{ color: B.faint, fontSize: 11.5, marginTop: 6, fontStyle: 'italic' }}>{hint}</div>}
    </div>
  );
};

// Address autocomplete dropdown (static mock)
const AddressField = ({ defaultValue = '847 E 9th Ave', open = true }) => {
  const B = window.B_THEME;
  return (
    <div style={{ position: 'relative', marginBottom: 16 }}>
      <label style={{ color: B.dim, fontSize: 12, fontStyle: 'italic', display: 'block', marginBottom: 6 }}>Your home address</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: B.surface, border: `1px solid ${B.accent}`, borderRadius: 8, padding: '13px 15px', boxShadow: `0 0 0 3px ${B.accentSoft}` }}>
        <Icon name="mappin" size={16} style={{ color: B.accent }}/>
        <input defaultValue={defaultValue} style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: B.text, fontSize: 15, fontFamily: 'inherit' }}/>
      </div>
      {open && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 6px)', background: B.surface, border: `1px solid ${B.line}`, borderRadius: 8, boxShadow: '0 12px 32px rgba(42,31,23,0.14)', overflow: 'hidden', zIndex: 5 }}>
        {[
          { main: '847 E 9th Ave', sub: 'Salt Lake City, UT 84103 · The Avenues', pick: true },
          { main: '847 E 9th St', sub: 'Salt Lake City, UT 84105 · Liberty Wells' },
          { main: '847 N 900 E', sub: 'Salt Lake City, UT 84102 · Capitol Hill' },
        ].map((a, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 15px', borderTop: i ? `1px solid ${B.line}` : 'none', background: a.pick ? B.accentSoft : 'transparent', cursor: 'pointer' }}>
            <Icon name="mappin" size={14} style={{ color: a.pick ? B.accent : B.faint }}/>
            <div style={{ flex: 1 }}>
              <div style={{ color: B.text, fontSize: 13.5, fontWeight: 600 }}>{a.main}</div>
              <div style={{ color: B.faint, fontSize: 11.5, fontStyle: 'italic' }}>{a.sub}</div>
            </div>
            {a.pick && <Icon name="check" size={14} stroke={3} style={{ color: B.accent }}/>}
          </div>
        ))}
        <div style={{ padding: '8px 15px', borderTop: `1px solid ${B.line}`, fontSize: 11, color: B.faint, display: 'flex', alignItems: 'center', gap: 6, fontStyle: 'italic' }}>
          <Icon name="shield" size={11}/> Powered by public address records
        </div>
        </div>
      )}
    </div>
  );
};

// ── 1. HIRE-ME ENTRY · address required to contact pro ──
const HireMeEntryB = () => {
  const B = window.B_THEME;
  return (
    <EntryShell
      maxW={480}
      sideKind="frame"
      side={
        <div style={{ color: '#fff', maxWidth: 380 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <Avatar tone="brick" initials="MW" size={52} ring="rgba(255,255,255,0.3)"/>
            <div>
              <div className="serif" style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>Marcus Whitfield</div>
              <div style={{ fontSize: 12.5, opacity: 0.8, fontStyle: 'italic' }}>Master Carpenter · 18 yrs · The Avenues</div>
            </div>
          </div>
          <div className="serif" style={{ fontSize: 30, fontWeight: 500, lineHeight: 1.15, letterSpacing: '-0.02em' }}>
            "Tell me where, and I'll tell you what it'll take."
          </div>
          <div style={{ fontSize: 14, opacity: 0.82, marginTop: 16, lineHeight: 1.6 }}>
            Marcus needs your address to scope the work and check he services your area. Smith turns it into a home profile you keep — for this project and every one after.
          </div>
        </div>
      }
    >
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: B.accentSoft, color: B.accent, padding: '5px 12px', borderRadius: 100, fontSize: 11.5, fontWeight: 600, marginBottom: 18 }}>
        <Icon name="briefcase" size={12}/> Hiring Marcus Whitfield
      </div>
      <h1 className="serif" style={{ margin: 0, fontSize: 32, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.1 }}>
        Where's the work happening?
      </h1>
      <p style={{ color: B.dim, fontSize: 14.5, lineHeight: 1.55, margin: '12px 0 26px' }}>
        Your address scopes the job and confirms Marcus covers your area. We'll start a private home profile — only you control who sees it.
      </p>

      <AddressField/>

      <div style={{ marginTop: 76 }}>
        <button style={{ width: '100%', background: B.text, color: B.surface, border: 'none', padding: '15px', borderRadius: 100, fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          Continue to Marcus <Icon name="arrow-r" size={15} stroke={2.4}/>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, color: B.faint, fontSize: 11.5, fontStyle: 'italic', justifyContent: 'center' }}>
          <Icon name="shield" size={12}/> Your address stays private until you share it with a pro.
        </div>
      </div>
    </EntryShell>
  );
};

// ── 2. HOMEOWNER SELF-SERVE SIGN-UP ─────────────────────
const HomeownerSignupB = () => {
  const B = window.B_THEME;
  return (
    <EntryShell
      maxW={460}
      sideKind="frame"
      side={
        <div style={{ color: '#fff', maxWidth: 400 }}>
          <div style={{ fontSize: 12, fontStyle: 'italic', opacity: 0.85, marginBottom: 16 }}>Smith — for the home</div>
          <div className="serif" style={{ fontSize: 34, fontWeight: 500, lineHeight: 1.12, letterSpacing: '-0.025em' }}>
            Your house, finally documented.
          </div>
          <div style={{ fontSize: 14.5, opacity: 0.85, marginTop: 18, lineHeight: 1.6 }}>
            Start with your address. Smith builds a living profile of your home — systems, history, what's behind the walls — so every future project is faster, cheaper, and yours to keep.
          </div>
          <div style={{ display: 'flex', gap: 24, marginTop: 28 }}>
            {[
              { v: '12k+', l: 'SLC homes' },
              { v: '6 min', l: 'avg setup' },
              { v: 'Free', l: 'to start' },
            ].map(s => (
              <div key={s.l}>
                <div className="serif" style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>{s.v}</div>
                <div style={{ fontSize: 11.5, opacity: 0.7, fontStyle: 'italic' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      }
    >
      <h1 className="serif" style={{ margin: 0, fontSize: 32, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.1 }}>
        Claim your home.
      </h1>
      <p style={{ color: B.dim, fontSize: 14.5, lineHeight: 1.55, margin: '12px 0 24px' }}>
        Two minutes to start. Add the rest whenever you like.
      </p>

      <AddressField open={false}/>
      <EntryInput icon="mail" label="Email" type="email" defaultValue="sarah.christen@gmail.com"/>
      <EntryInput icon="shield" label="Create a password" type="password" defaultValue="ssssssssssss" hint="12+ characters."/>

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, margin: '4px 0 22px', cursor: 'pointer' }}>
        <input type="checkbox" defaultChecked style={{ accentColor: B.accent, marginTop: 3 }}/>
        <span style={{ color: B.dim, fontSize: 12.5, lineHeight: 1.5 }}>
          I agree to the <a href="#" style={{ color: B.accent }}>Terms</a> & <a href="#" style={{ color: B.accent }}>Privacy</a>. I confirm I own or live at this address.
        </span>
      </label>

      <button style={{ width: '100%', background: B.text, color: B.surface, border: 'none', padding: '15px', borderRadius: 100, fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        Find my home <Icon name="arrow-r" size={15} stroke={2.4}/>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
        <div style={{ flex: 1, height: 1, background: B.line }}/>
        <span style={{ color: B.faint, fontSize: 11.5, fontStyle: 'italic' }}>or</span>
        <div style={{ flex: 1, height: 1, background: B.line }}/>
      </div>
      <button style={{ width: '100%', background: 'transparent', color: B.text, border: `1px solid ${B.line}`, padding: '13px', borderRadius: 100, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
        Continue with Google
      </button>
    </EntryShell>
  );
};

// ── 3. ADDRESS FOUND · public imagery + records pull ────
const AddressFoundB = () => {
  const B = window.B_THEME;
  return (
    <div style={{ background: B.bg, color: B.text, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '18px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${B.line}` }}>
        <SmithLogoB/>
        <span style={{ color: B.faint, fontSize: 12.5, fontStyle: 'italic' }}>Step 2 of 3 · Confirm your home</span>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <div style={{ width: '100%', maxWidth: 920 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: B.accentSoft, color: B.accent, padding: '5px 12px', borderRadius: 100, fontSize: 11.5, fontWeight: 600, marginBottom: 14 }}>
              <Icon name="check" size={12} stroke={3}/> Found it — pulled from public records
            </div>
            <h1 className="serif" style={{ margin: 0, fontSize: 34, fontWeight: 600, letterSpacing: '-0.025em' }}>Is this your home?</h1>
            <p style={{ color: B.dim, fontSize: 14, margin: '8px 0 0', fontStyle: 'italic' }}>
              We assembled this from county records and street imagery. You can fix anything that's off.
            </p>
          </div>

          <div style={{ background: B.surface, border: `1px solid ${B.line}`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 12px 40px rgba(42,31,23,0.10)' }}>
            {/* Street-view style imagery */}
            <div style={{ position: 'relative', height: 300 }}>
              <Photo kind="frame" height="100%"/>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(42,31,23,0) 55%, rgba(42,31,23,0.55))' }}/>
              {/* source chips */}
              <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', gap: 6 }}>
                {['Street view · 2024', '3 photos found'].map(c => (
                  <span key={c} style={{ background: 'rgba(14,19,16,0.6)', backdropFilter: 'blur(6px)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 100 }}>{c}</span>
                ))}
              </div>
              {/* thumbnails */}
              <div style={{ position: 'absolute', bottom: 14, right: 14, display: 'flex', gap: 6 }}>
                {['detail', 'workshop', 'concrete'].map((k, i) => (
                  <div key={i} style={{ width: 56, height: 42, borderRadius: 4, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.6)' }}>
                    <Photo kind={k} height="100%"/>
                  </div>
                ))}
              </div>
              <div style={{ position: 'absolute', left: 18, bottom: 16, color: '#fff' }}>
                <div className="serif" style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>847 E 9th Ave</div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>Salt Lake City, UT 84103 · The Avenues</div>
              </div>
            </div>

            {/* Auto-pulled facts */}
            <div style={{ padding: '22px 26px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h3 className="serif" style={{ margin: 0, fontSize: 16, fontWeight: 600, color: B.text }}>What we already know</h3>
                <span style={{ color: B.faint, fontSize: 11.5, fontStyle: 'italic' }}>Gallatin County Assessor · est. 2024</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {[
                  { l: 'Year built', v: '1924' },
                  { l: 'Square feet', v: '2,840' },
                  { l: 'Bed · bath', v: '4 · 2.5' },
                  { l: 'Lot', v: '0.18 ac' },
                  { l: 'Stories', v: '2 + basement' },
                  { l: 'Last sold', v: 'Sep 2022 · $726k' },
                  { l: 'Roof', v: 'Asphalt · ~2021' },
                  { l: 'Heating', v: 'Forced air · gas' },
                ].map(f => (
                  <div key={f.l} style={{ background: B.bg, border: `1px solid ${B.line}`, borderRadius: 6, padding: '11px 13px' }}>
                    <div style={{ color: B.faint, fontSize: 10.5, fontStyle: 'italic' }}>{f.l}</div>
                    <div className="serif" style={{ color: B.text, fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', marginTop: 2 }}>{f.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button style={{ flex: 1, background: B.text, color: B.surface, border: 'none', padding: '13px', borderRadius: 100, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  Yes, this is my home <Icon name="arrow-r" size={14} stroke={2.4}/>
                </button>
                <button style={{ background: 'transparent', color: B.text, border: `1px solid ${B.line}`, padding: '13px 22px', borderRadius: 100, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  Something's off
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

// ── 4. SEED DASHBOARD · today's sparse state + locked future ──
const SeedDashboardB = () => {
  const B = window.B_THEME;

  const LockedModule = ({ title, blurb, unlock, kind, h = 150 }) => (
    <section style={{ position: 'relative', background: B.surface, border: `1px solid ${B.line}`, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ filter: 'blur(3px)', opacity: 0.5, pointerEvents: 'none', height: h }}>
        <Photo kind={kind} height={h}/>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(251,247,238,0.4), rgba(251,247,238,0.92))', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 22 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: B.surface, border: `1px solid ${B.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: B.dim, marginBottom: 10 }}>
          <Icon name="shield" size={16}/>
        </div>
        <div className="serif" style={{ color: B.text, fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</div>
        <p style={{ color: B.dim, fontSize: 12, lineHeight: 1.5, margin: '5px 0 12px', maxWidth: 280 }}>{blurb}</p>
        <button style={{ background: B.accentSoft, color: B.accent, border: `1px solid ${B.accent}`, padding: '7px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{unlock}</button>
      </div>
    </section>
  );

  return (
    <ProjectShell active="home"
      project={{ ...window.HOME_SEED, name: '847 E 9th Ave', addr: 'Salt Lake City, UT', phase: 'New profile' }}
      otherProjects={[{ name: '847 E 9th Ave', sub: 'My home', cover: 'frame', dot: '#7A8A3F' }]}
      navItems={[
        { k: 'home',  label: 'My home',     icon: 'home',     sub: 'Just started' },
        { k: 'value', label: 'Value & equity', icon: 'briefcase', sub: 'Add details to unlock' },
        { k: 'rooms', label: 'Rooms',       icon: 'building', sub: '0 catalogued' },
        { k: 'vault', label: 'Photo vault', icon: 'image',    sub: '3 from public sources' },
        { k: 'maint', label: 'Maintenance', icon: 'check',    sub: 'Add details to unlock' },
        { k: 'projects', label: 'Projects', icon: 'send',     sub: 'Start your first' },
        { k: 'team',  label: 'My trades',   icon: 'users',    sub: 'None yet' },
      ]}
      roleData={{ label: 'Sarah · homeowner', icon: 'home', color: '#5B7A8A' }}
      role="homeowner"
      action={
        <button style={{ background: B.text, color: B.surface, border: 'none', padding: '9px 18px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Complete profile</button>
      }>
      {/* Hero with sparse state */}
      <div style={{ position: 'relative', height: 240, overflow: 'hidden' }}>
        <Photo kind="frame" height="100%"/>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(42,31,23,0.08) 30%, rgba(42,31,23,0.82))' }}/>
        <div style={{ position: 'absolute', left: 32, right: 32, bottom: 22 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', color: '#fff', padding: '5px 11px', borderRadius: 100, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', marginBottom: 12 }}>
            <Icon name="check" size={11} stroke={3}/> HOME PROFILE STARTED
          </div>
          <h1 className="serif" style={{ margin: 0, fontSize: 36, fontWeight: 600, color: '#fff', letterSpacing: '-0.025em' }}>847 E 9th Ave</h1>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13.5, marginTop: 6 }}>The Avenues · Built 1924 · 2,840 sqft · 4 bd / 2.5 ba</div>
        </div>
      </div>

      {/* Setup progress bar */}
      <div style={{ background: B.surface, borderBottom: `1px solid ${B.line}`, padding: '18px 32px', display: 'flex', alignItems: 'center', gap: 22 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
            <span className="serif" style={{ color: B.text, fontSize: 15, fontWeight: 600 }}>Your home profile is 18% complete</span>
            <span style={{ color: B.dim, fontSize: 12.5, fontStyle: 'italic' }}>4 of 22 details added</span>
          </div>
          <div style={{ height: 7, background: B.bg, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: '18%', height: '100%', background: B.accent }}/>
          </div>
        </div>
        <button style={{ background: B.accent, color: '#fff', border: 'none', padding: '11px 18px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          Add 3 details → unlock value
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '24px 32px', display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Next steps checklist */}
          <section style={{ background: B.surface, border: `1px solid ${B.line}`, borderRadius: 8, padding: '22px 26px' }}>
            <h2 className="serif" style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600, color: B.text, letterSpacing: '-0.01em' }}>Build out your home</h2>
            <p style={{ color: B.dim, fontSize: 12.5, fontStyle: 'italic', margin: '0 0 18px' }}>Each step unlocks more of your dashboard. Do them in any order, anytime.</p>
            {[
              { done: true, t: 'Confirm your address', s: 'Pulled from public records', pts: '' },
              { done: true, t: 'Basic facts auto-imported', s: 'Year, sqft, beds, baths', pts: '' },
              { done: false, t: 'Add your systems', s: 'Electrical, plumbing, HVAC, roof age', pts: 'Unlocks maintenance', hot: true },
              { done: false, t: 'Log a past project', s: 'Even a rough one — builds your value model', pts: 'Unlocks value & equity' },
              { done: false, t: 'Upload a few photos', s: 'Rooms, exterior, anything behind walls', pts: 'Unlocks photo vault' },
              { done: false, t: 'Connect a trade you trust', s: 'The pros who already know your house', pts: 'Unlocks fast bidding' },
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 0', borderTop: i ? `1px dashed ${B.line}` : 'none' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: step.done ? B.accent : 'transparent', border: `1.5px solid ${step.done ? B.accent : B.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  {step.done && <Icon name="check" size={12} stroke={3} style={{ color: '#fff' }}/>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="serif" style={{ color: B.text, fontSize: 14.5, fontWeight: 600, letterSpacing: '-0.01em', textDecoration: step.done ? 'line-through' : 'none', opacity: step.done ? 0.55 : 1 }}>{step.t}</span>
                    {step.hot && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: B.accent, background: B.accentSoft, padding: '2px 6px', borderRadius: 2 }}>DO NEXT</span>}
                  </div>
                  <div style={{ color: B.dim, fontSize: 12, fontStyle: 'italic', marginTop: 1 }}>{step.s}</div>
                </div>
                {step.pts && !step.done && <span style={{ color: B.accent, fontSize: 11, fontWeight: 600, fontStyle: 'italic', whiteSpace: 'nowrap', marginTop: 2 }}>{step.pts}</span>}
              </div>
            ))}
          </section>

          {/* Locked future — the carrot */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
              <h2 className="serif" style={{ margin: 0, fontSize: 18, fontWeight: 600, color: B.text, letterSpacing: '-0.01em' }}>What you'll unlock</h2>
              <span style={{ color: B.faint, fontSize: 12, fontStyle: 'italic' }}>· a glimpse of where this goes</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <LockedModule kind="kitchen" title="Value & equity" blurb="Live home value, equity, and pre-qualified credit to fund projects." unlock="Log a project to unlock"/>
              <LockedModule kind="detail" title="Behind the walls" blurb="Every photo your trades take before drywall — pinned to your floor plan." unlock="Add photos to unlock"/>
              <LockedModule kind="workshop" title="Smart maintenance" blurb="Material-aware care schedule tuned to what's actually in your home." unlock="Add systems to unlock"/>
              <LockedModule kind="concrete" title="Instant bidding" blurb="Fast, accurate estimates from pros — because your spec writes itself." unlock="Connect a trade to unlock"/>
            </div>
          </div>
        </div>

        {/* Right column */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* If they came via hire-me */}
          <section style={{ background: B.accentSoft, border: `1px solid ${B.accent}`, borderRadius: 8, padding: '18px 20px' }}>
            <div style={{ color: B.accent, fontSize: 11, fontStyle: 'italic', fontWeight: 600, marginBottom: 10 }}>YOUR FIRST PROJECT</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar tone="brick" initials="MW" size={44}/>
              <div style={{ flex: 1 }}>
                <div className="serif" style={{ color: B.text, fontSize: 15, fontWeight: 600 }}>Marcus is ready</div>
                <div style={{ color: B.dim, fontSize: 12, fontStyle: 'italic' }}>Waiting on your project details</div>
              </div>
            </div>
            <button style={{ width: '100%', marginTop: 14, background: B.text, color: B.surface, border: 'none', padding: '11px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Describe the work →
            </button>
          </section>

          {/* Public data card */}
          <section style={{ background: B.surface, border: `1px solid ${B.line}`, borderRadius: 8, padding: '20px 22px' }}>
            <h3 className="serif" style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: B.text }}>From public records</h3>
            <p style={{ color: B.dim, fontSize: 12, fontStyle: 'italic', margin: '0 0 14px' }}>We started you off with what's public. Confirm or correct each.</p>
            {[
              { l: 'Year built', v: '1924' },
              { l: 'Square feet', v: '2,840' },
              { l: 'Bed · bath', v: '4 · 2.5' },
              { l: 'Last sold', v: 'Sep 2022' },
            ].map((r, i) => (
              <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: i ? `1px dashed ${B.line}` : 'none' }}>
                <span style={{ color: B.faint, fontSize: 12, fontStyle: 'italic' }}>{r.l}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: B.text, fontSize: 13, fontWeight: 600 }}>
                  {r.v}
                  <button style={{ background: 'transparent', border: 'none', color: B.accent, cursor: 'pointer', padding: 0, display: 'inline-flex' }}><Icon name="edit" size={12}/></button>
                </span>
              </div>
            ))}
          </section>

          <section style={{ background: B.surface, border: `1px solid ${B.line}`, borderRadius: 8, padding: '18px 20px' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <Icon name="shield" size={18} style={{ color: B.accent, marginTop: 2, flexShrink: 0 }}/>
              <div>
                <div className="serif" style={{ color: B.text, fontSize: 14, fontWeight: 600 }}>Your home, your data</div>
                <p style={{ color: B.dim, fontSize: 12, lineHeight: 1.55, margin: '4px 0 0' }}>
                  Nothing here is public. You choose which pros see what, project by project. Export or delete anytime.
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </ProjectShell>
  );
};

// seed project meta for the shell switcher
window.HOME_SEED = { cover: 'frame', color: '#7A8A3F' };

Object.assign(window, {
  HireMeEntryB, HomeownerSignupB, AddressFoundB, SeedDashboardB,
});
