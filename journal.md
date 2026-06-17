# Smith — Project Journal

A durable record of decisions made, work shipped, and what's still open.
Paste this at the start of a session so Claude is caught up in 30 seconds.
Update it at the end of each session.

**Last updated:** 2026-06-13 (One account, two modes — intent-fork signup + post-login mode toggle)
**Live URL:** https://smith-h86n.onrender.com
**Repo:** github.com/bryanhollingshead/smith
**Sole dev:** Bryan Hollingshead (product background)
**App root:** ~/Desktop/smith-app/

---

## ✅ Done — recent wins (in roughly reverse chronological order)

### One account, two modes — intent fork + post-login mode toggle (2026-06-13)
Phase 7. Closes the model question opened by phase 6: phase 6 created a
separate homeowner signup path but left the two audiences as two account
shapes. Phase 7 reframes Smith as **ONE account that operates in two
modes — Tradesman or Homeowner**, with a server-persisted active mode,
an intent picker at signup, and a live mode toggle in the nav so any user
can flip between modes without losing the other side. Not yet pushed.

**The shape:**
- `users.role` (phase 6) is reinterpreted as the persistent **active
  mode** (`'tradesperson'` on the DB side, `'tradesman'` on the
  product-facing side). Same column, same data — no rename, no risk to
  existing rows. Every existing seed user (Marcus id=1, the smith-god
  accounts, the test homeowners minted during phase 6) keeps working.
- The "has each profile?" question is **derived server-side** rather
  than denormalized, so the flags can't drift:
    - `profiles.tradesman = EXISTS user_trades WHERE user_id=u.id`
    - `profiles.homeowner = EXISTS homes WHERE owner_user_id=u.id`
  Returned in `/api/auth/me`, `/signin`, `/signup`, and `/mode` so the
  client can decide whether a mode switch needs a setup flow.

**Migration 014 — one column:**
- `users.hiring_context TEXT NULL` with check
  `IN ('own_home','property_manager')`. **Display-label only** — drives
  whether the user's homeowner mode renders as "Homeowner" or "Property
  manager" everywhere. NEVER stored as the label string. NULL on every
  existing row → defaults to "Homeowner" if they ever switch.
- The original spec had three values (own_home / property_owner /
  property_manager); Bryan trimmed it to two during plan review for
  one-tap simplicity. "Property owner" is the kind of thing we can add
  back later by extending the check + the label map in `lib/mode.js`.

**Server endpoints:**
- `POST /api/auth/signup`  — accepts `role` + `hiring_context`. Writes
  `hiring_context` only when `role='homeowner'`; otherwise NULL.
- `POST /api/auth/signin`  — returns the new shape (role + hiring_context
  + profiles flags).
- `GET  /api/auth/me`      — same shape, plus the legacy profile fields
  TopNav already depends on (first_name, avatar_tone, etc).
- `PATCH /api/auth/me/mode` — body `{ mode: 'tradesman' | 'homeowner' }`.
  Updates `users.role` and returns the shaped user + `needs_setup`
  boolean. `needs_setup:true` is the cue that the target mode has no
  underlying profile yet — client routes to a setup flow before the
  new shell renders.
- `PATCH /api/profiles/me` — now also accepts `hiring_context` so users
  can flip "My home → A property I manage" after signup without
  re-running the homeowner-signup flow.

**Client:**
- `lib/mode.js` — single source of truth for label derivation. Exports
  `modeOf(user)`, `modeLabel(user)`, `labelForMode(user, mode)`,
  `hasProfile(user, mode)`, `iconForMode(mode)`. No string is ever
  stored or hardcoded — every "Homeowner" / "Property manager" on screen
  flows through these helpers.
- `lib/AuthContext.jsx` — adds `switchMode(mode)` that wraps the PATCH
  + optimistically updates `user`, returns `{ user, needsSetup }`.
- `components/ModeToggle.jsx` — two visual variants of the same
  affordance:
    - **`variant="pill"`** sits in the TopNav between search and the
      nav row (always-visible in tradesman shell).
    - **`variant="card"`** sits in the ProjectShell rail footer
      (homeowner shell), replacing the static "You're viewing as"
      card from phase 6.
  Both pull `modeLabel(user)` so a property manager sees
  **"Property manager"** as the current-mode label in the rail footer,
  not the literal string "Homeowner".
- `pages/SignUpStart.jsx` (route `/auth/start`) — the new first step
  of account creation. Two equal cards: **"I'm a tradesman"** → existing
  `/auth/signup`, **"I'm hiring"** → existing `/auth/homeowner`. Both
  downstream screens were untouched — the picker is a thin diverter.
- `pages/HomeownerSignup.jsx` — adds a two-pill `HiringContextChoice`
  above the AddressField. Default = `own_home`. Submitted as part of
  the existing signup body.
- `pages/ModeSetupHomeowner.jsx` (`/mode/setup-homeowner`) — for an
  already-signed-in tradesman who flips to homeowner mode with no
  `homes` row. Reuses HiringContextChoice + AddressField + `POST /homes`
  from phase 6, minus credentials. Has an escape hatch ("← Back to
  tradesman mode") that calls `switchMode('tradesman')`.
- `pages/ModeSetupTradesman.jsx` (`/mode/setup-tradesman`) — mirror
  flow for homeowners flipping to tradesman with no `user_trades` rows.
  Reuses `GET /trades` + `POST /profiles/me/trades` from the legacy
  onboarding wizard.
- `components/HomeownerShell.jsx` — new global shell for homeowner
  mode. Wraps every homeowner-mode route in `ProjectShell` with the
  homeowner nav (My home / Find a pro / My projects / Inquiries sent
  / Saved tradesmen). The unbuilt items render stub pages that say
  "Coming in the next handoff" — the shell ships now so the homeowner
  side has a real seat at the table even before those flows land.
- `pages/SeedDashboard.jsx` — refactored to be **headless**. The hero +
  progress + checklist + locked modules now sit inside whatever shell
  wraps it (HomeownerShell in practice). Removes the static
  `roleData={…You · homeowner…}` prop that was suppressing ModeToggle.
- `App.jsx` — authed branch forks on `modeOf(user)`:
    - Homeowner mode → wraps everything in MessagesProvider +
      HomeownerShell.
    - Tradesman mode → the existing TopNav + route tree (unchanged
      except the inline ModeToggle pill).
  `/mode/setup-homeowner` and `/mode/setup-tradesman` render outside
  both shells (they're transitional by definition). `/home/:id/confirm`
  (AddressFound) also renders outside the shell — it has its own
  "Step 2 of 3" chrome and doesn't want a second layer of frame.
- `pages/Landing.jsx` — `ROUTES.signup` redirected to `/auth/start`,
  so the LandingNav button, hero primary, and final-CTA all funnel
  through the intent picker. The "Own a home? Claim your home →"
  accent line below the hero stays direct to `/auth/homeowner` as a
  fast-path for users who already know.

**E2E verification (Playwright against local Vite + Express):**
1. ✅ Landing → "Create your profile" → `/auth/start` → intent picker
   renders.
2. ✅ Picker → "I'm a tradesman" → `/auth/signup`. ✓
3. ✅ Picker → "I'm hiring" → `/auth/homeowner`. ✓
4. ✅ Homeowner signup with `A property I manage` selected → POST
   `/signup` writes `hiring_context='property_manager'` → home minted
   → AddressFound confirm → SeedDashboard. **Rail-footer ModeToggle
   shows "Property manager"** (the derived label fires).
5. ✅ Click "Property manager" rail card → dropdown opens → pick
   "Tradesman" → server returns `needs_setup:true` → routed to
   `/mode/setup-tradesman` → pick Carpentry → save → `/feed`.
   **TopNav pill now shows "Tradesman"**.
6. ✅ Click "Tradesman" pill → pick "Property manager" → server returns
   `needs_setup:false` (the home from step 4 still exists) → lands on
   `/home/8` (HomeownerShell renders, no setup needed).
7. ✅ Existing user Marcus (id=1) signs in with seed credentials → lands
   on `/feed` with TopNav showing "Tradesman". No data touched.

8 screenshots at `/tmp/smith-verify/mode-*.png`.

**Notable bugs caught + fixed mid-build:**
- `signUp` in AuthContext was destructuring args and silently dropping
  `hiring_context`. First test showed `hiring_context: null` post-signup
  even though the form had `property_manager` selected. One-line fix.
- `SeedDashboard.jsx` was rendering its own `<ProjectShell>` and passing
  `roleData`, which both (a) double-wrapped the shell when HomeownerShell
  was added and (b) suppressed the new ModeToggle in favor of the legacy
  static card. Refactored SeedDashboard to a headless content block.
- `AddressFound` lives at `/home/:id/confirm` and was being routed through
  HomeownerShell, which produced a nested chrome (rail + the AddressFound
  "Step 2 of 3" header). Pulled it up to render outside both shells.

**Open / follow-ups:**
- The four homeowner stub pages (Find a pro, My projects, Inquiries
  sent, Saved tradesmen) need real implementations — each will be a
  handoff bundle in its own right. The shell + nav + mode toggle are
  the spine those flows hang off of.
- The "Property manager" hiring_context doesn't yet open a
  property-manager-specific view of the dashboard (e.g. multiple homes,
  units, tenants). For now it's a pure display-label distinction.
  Worth revisiting once we have a real property-manager design.
- `users.role` keeps the legacy `'tradesperson'` value on the DB side
  even though we say "Tradesman" everywhere user-visible. The
  product/DB language is intentionally split — touching the column
  would risk too many existing references. If we ever consolidate, do
  it as a rename migration with full code sweep.

### Homeowner entry module — phase 6, four screens shipped (2026-06-11)
First piece of the homeowner-acquisition funnel. Opens a second front for
Smith: tradespeople have been the only signup audience until now;
homeowners get a separate path that mints a "seed home profile" from
nothing but an address, then drops them onto a sparse-but-real dashboard
with locked future modules as the carrot. The four screens come from
`design_handoff_homeowner_entry/` (kept in the repo for reference).
Branch: not yet committed.

**Migration 013 — two schema additions:**
- `users.role` TEXT ('tradesperson' default · 'homeowner') with check
  constraint. Forks the post-signup journey: tradespeople still go
  through trade-selection onboarding; homeowners skip it
  (`onboarding_done=TRUE` stamped at signup).
- `homes` table — owner_user_id, full canonical address, place_id (stub
  for now), 11 nullable fact columns (year_built / square_feet / beds /
  baths / lot_acres / stories / last_sold_date+price / roof / heating),
  facts_source provenance, `entry_source` ('self-serve' | 'hire-me')
  with optional `pending_pro_slug`, `confirmed_at` to mark the
  AddressFound moment.

**New `/api/homes` + `/api/places` routes (`server/src/routes/homes.js`):**
- `GET  /api/places/autocomplete?q=`  — **public**, stubbed Google Places.
  Three canned matches around 847 E 9th Ave + neighbors. `// TODO: wire
  Google Places` at the call site.
- `POST /api/places/records`           — **public**, stubbed ATTOM /
  Street View. Returns the full fact set for the canonical demo
  address; sparse coverage for distractor places. `// TODO: wire ATTOM
  + Street View` markers in the file.
- `POST /api/homes`                    — authed. Mints from a confirmed
  place_id + facts override. Idempotent on (owner_user_id, place_id) so
  React StrictMode double-mounts can't pile up rows.
- `GET  /api/homes/:id`                — authed, owner-only.
- `GET  /api/homes/me/primary`         — authed, returns most-recent
  home; 404 if none.
- `PATCH /api/homes/:id`               — authed. Inline edits (year /
  sqft / beds / etc.) + a `confirm: true` sentinel that stamps
  `confirmed_at`. Editable writes flip `facts_source` to `'user'`.

**Setup progress derivation.** 22 total "details" distributed across the
six checklist rows (matches the design):
- Confirm address — 1
- Basic facts auto-imported — 3 (any of the 11 fact columns populated)
- Add systems — 5     (post-MVP)
- Log a project — 3   (post-MVP)
- Upload photos — 5   (post-MVP)
- Connect a trade — 5 (post-MVP)
Seed state from public records → 4/22 = 18% (matches the design's
display). Derived on the server in `deriveProgress()`; returned as
`home.progress = { added, total, pct }`.

**Client surface — four pages + one new shared component:**
- `client/src/components/ProjectShell.jsx` — collapsible left rail
  (280 ↔ 64 px), project switcher, nav items with `sub` text + badge,
  role footer (homeowner = blue `#5B7A8A`), header with action slot.
  Adapted from the handoff's `smith-project-shell.jsx` to use our
  Icon / Avatar / router. First consumer is the SeedDashboard;
  tradesperson surfaces will pick this up later.
- `client/src/components/HomeownerEntry.jsx` — `EntryShell` (two-pane
  with responsive collapse at ≤900 px), `EntryInput`, `AddressField`
  (live debounced autocomplete with focus-open dropdown matching the
  design's first-result-highlighted frame), `LockedModule`,
  `ChromeWordmark`.
- `pages/HireMeEntry.jsx`     · `/hire/:slug`        · public.
- `pages/HomeownerSignup.jsx` · `/auth/homeowner`    · public; copy
  varies on `?entry_source=hire-me` ("One step before you continue.")
  vs self-serve ("Claim your home.").
- `pages/AddressFound.jsx`    · `/home/:id/confirm`  · authed.
  Imagery band + 4-col facts grid; "Something's off" toggles inline
  edits, "Yes, this is my home" PATCHes confirm:true + any pending
  edits in one round-trip.
- `pages/SeedDashboard.jsx`   · `/home/:id`          · authed.
  Hero + progress bar derived from server, 6-row checklist, 2×2
  locked-module grid, right column with inline-editable "From public
  records" card. "Your first project / Marcus is ready" card only
  renders when `home.entry_source === 'hire-me'`.

**Routing rewire.** `App.jsx` registers the new paths inside the
existing public-and-then-authed branches. The PublicProfile "Hire Me"
button no longer opens `HireMeModal` — it routes to `/hire/:slug` (the
new flow). HireMeModal remains in the codebase but isn't launched
anywhere; decision per Bryan: don't support both surfaces yet, may
revisit later.

**Design tokens added.** `B` + `styles.css` got `dangerSoft` (#fbe8e2),
`success`/`successSoft` (#7A8A3F · #e9efde), and `homeowner` blue
(#5B7A8A). The handoff's other tokens already matched ours 1:1.

**Stubbed seams — what NOT to ship as real yet:**
- Google Places autocomplete (replace `STUB_PLACES`).
- ATTOM / Estated property records (replace `STUB_RECORDS`).
- Google Street View Static imagery (keep `Photo kind="frame"` until
  wired).
- Google OAuth on the signup screen (alert toast for now).
- All four locked-module unlock CTAs + the "Describe the work →" button
  on the hire-me dashboard route to `/todo/*` placeholders pending the
  next handoff (the post-seed flows: describe-the-work, then bidding,
  then project initiation).

**Local env note.** Added `REQUIRE_EMAIL_VERIFICATION=false` to
`server/.env` so signup → confirm → dashboard runs in dev without an
email-code roundtrip. Matches what `render.yaml` already does in prod.

**E2E verification (Playwright against local Vite + Express):**
1. ✅ `/hire/marcus-whitfield-5988` → side panel pulls the real pro
   profile; address picker auto-opens with 847 E 9th Ave highlighted.
2. ✅ Pick → `/auth/homeowner?…entry_source=hire-me&pro=…`; "One step
   before you continue." headline appears.
3. ✅ Fill credentials → `POST /api/auth/signup` 201 with role=homeowner
   → `POST /api/homes` 201 → `/home/2/confirm`.
4. ✅ AddressFound renders facts (1924, 2840, 4·2.5, 0.18 ac, etc.).
5. ✅ Confirm → `PATCH /api/homes/2` 200 → `/home/2` seed dashboard.
6. ✅ Dashboard shows "Marcus is ready" card + "Describe the work →"
   button (because entry_source=hire-me).
7. ✅ Reload — data persisted, dashboard re-renders identically.
8. ✅ Separate self-serve run: `/auth/homeowner` → submit → confirm →
   dashboard. "YOUR FIRST PROJECT" card count = 0 (correctly omitted
   for self-serve).
9. 🔍 Validation: empty submit → "Pick an address from the
   suggestions"; password < 12 chars → "Password must be at least 12
   characters."

Screenshots at `/tmp/smith-verify/homeowner-*.png` (8 frames covering
both paths).

**Known issues to handle when real providers go in:**
- **Address pre-fill on hire-me → signup hop:** the URL carries
  `?address=…&place_id=…`; the signup screen's AddressField fills in
  with the long pre-filled string and re-fires the autocomplete on it,
  which doesn't match any stub and returns 0 suggestions. Submit works
  fine (the pick is already locked in from the URL), but if the user
  clicks back into the field the dropdown briefly shows empty.
  Tightening this when Google Places is wired — real autocomplete will
  return matches for a full address string. Track here so it doesn't
  get lost.
- **MessagesProvider scope:** the seed dashboard renders inside
  `MessagesProvider` (App.jsx wraps the whole authed tree in it), so
  `/messages/unread-count` + the messaging WS fire on the homeowner
  dashboard. Probably fine, but homeowners may not want a network
  notification badge. Worth scoping per-role later.

**Next handoff:** "Describe the work →" (the hire-me follow-on flow),
then bidding + project initiation. The TODO seams in
`SeedDashboard.jsx` mark every entry point that needs wiring.

### Public-profile clean URL fix + Hire Me E2E reverified in prod (2026-06-08)
Shipped a one-file router fix that unblocked the Hire Me flow at the
shareable URL shape (`/profile/:slug`, no hash), then drove the full
end-to-end from a fresh unauthenticated browser against prod to
confirm. Commit `2f4723e`.

**The bug.** Hash routing (`#/feed`, `#/profile/:slug`) is fine inside
the app, but `VisibilityCard.jsx:21` generates the public share URL as
`${origin}/profile/${slug}` — clean path, no hash. Server SPA fallback
served `index.html` correctly, the SPA booted, but `parseHash()` saw an
empty `window.location.hash` and returned `/`. Signed-out visitors got
the Landing page; signed-in visitors got the Feed. **App.jsx already
had the right slug-routing branches (lines 60-63 logged-out, 85-91
logged-in) — they just never fired because `path` was `/`.**

**The fix (`client/src/lib/router.jsx`).** Two coordinated changes:
- `parseHash()` falls back to `window.location.pathname` (plus search)
  when the hash is empty. Drives the existing App.jsx slug matches.
- `RouterProvider` canonicalizes the URL on boot inside the useState
  initializer: if hash is empty + pathname ≠ `/`, `history.replaceState`
  rewrites to `/#<pathname>`. Prevents the ugly `/profile/xyz#/feed`
  shape after subsequent hash-based navigations.

The change keeps the hash-routing model intact — every other route
(`/auth/*`, `/jobs`, `/messages/:id`, etc.) is untouched, the canonicalize
only fires once on boot, and idempotent on repeat. Build is reproducible
via Vite contenthash → matched the deployed `index-nFj83ioj.js` so
"new bundle is live" was a curl one-liner.

**E2E reverification (Playwright in `/tmp/smith-verify/`).** Same setup
shape as the 2026-05-30 verification (fresh `BrowserContext` = no auth)
but driven against **prod**, not local:
1. ✅ `GET /profile/bryan-hollingshead-9890` → URL canonicalized to
   `/#/profile/bryan-hollingshead-9890`. `GET /api/public/profiles/:slug`
   200 with full profile JSON.
2. ✅ "Hire Bryan" button visible (PublicChrome shows Sign in / Build
   your profile — visitor is signed-out).
3. ✅ Modal opens, all 8 fields fill (name / email / phone / structure /
   job_type / location / timeline / message).
4. ✅ Submit → `POST /api/public/hire-me/bryan-hollingshead-9890` → **201
   `{"ok":true, "inquiry_id":2, …}`**. DoneStage renders: "Inquiry
   delivered / magic-link email at verify+…@example.com".

**Probes — server-side gates all firing:**
- 🔍 Bad email format → 400 `Email looks invalid.`
- 🔍 Slug with whitespace → 400 `Invalid slug` (regex gate on the
  profile route).
- 🔍 `GET /api/hire-me/inbox` unauthed → 401 `Missing bearer token`.
- 🔍 6th submit from same IP inside 10 min → 429 `Too many inquiries
  from your network.` Rate limiter (`public.js:24` — 5/IP/10min,
  in-memory) fires as designed.

**Gotcha worth remembering:** the rate-limiter check sits *before*
input validation (`public.js:135`), so every POST counts — including
malformed ones. Burned through my probe budget faster than expected.
Not a bug; useful to know during future manual testing.

**Open gap (small).** The test inquiry landed server-side
(`inquiry_id: 2`, sender `Verify Bot 2026-06-08T20-18-50-717Z`,
inquirer email `verify+1780949930717@example.com`), but I didn't
auth as Bryan to confirm it surfaces in the Inquiries inbox UI.
Sign in next session and archive/delete it.

**Artifacts:** `/tmp/smith-verify/drive.mjs` (Playwright runner) +
`01-profile.png` (rendered profile), `02-modal-empty.png`,
`03-modal-filled.png`, `04-success.png` (inquiry-sent stage).

### Browser verification of the Jobs module + apply-draft race fix (2026-05-30)
Drove all 10 phase-1→5 UI flows end-to-end in a headless Chromium via
Playwright (cold-start; no existing verifier skill). 19 screenshots in
`/tmp/smith-verify/shots/`, runner at `/tmp/smith-verify/verify.mjs`.

**Found + fixed mid-verify (commit `a058063`):** `POST /api/jobs/:id/draft`
crashed the server the first time it was hit from the browser. Cause: React
StrictMode double-mounts the modal in dev → `useEffect` fires twice →
two concurrent POSTs both pass the existing-row check, both INSERT, the
second hits the UNIQUE `(user_id, job_id)` constraint, route had no try/
catch → unhandled rejection → Node process exit. Fix: switched the INSERT
to `ON CONFLICT (user_id, job_id) DO NOTHING RETURNING id` with a SELECT
fallback when the insert returns 0 rows. **In prod the StrictMode trigger
is gone (only dev double-mounts), but the race is still real** for rapid
double-clicks, multi-tab, or any client retry — worth the fix regardless.

**All 10 flows pass end-to-end after the fix:**
1. ✅ Sign in (Marcus) → `/#/feed`.
2. ⚠️ Profile completeness card NOT visible. Correct behavior — Marcus's
   seed has all 4 unlocks `done:true`, and `ProfileCompletenessCard`
   hides itself when `unlocks.every(u => u.done)`. To see it rendered,
   need a less-complete profile.
3. ✅ Edit Profile shows resume banner + visibility card side by side.
4. ✅ Resume wizard upload stage opens cleanly.
5. ✅ "Go public" → API minted slug `marcus-whitfield-5988`. Public URL
   surfaced on card with Copy / View buttons.
6. ✅ Jobs feed renders 8 ranked cards (Master Carpenter top at score 37
   with Direct contact badge; Davis-Bacon row tagged Prevailing wage).
7. ✅ Apply with Smith modal opens with template-fallback banner
   (no `ANTHROPIC_API_KEY` set locally), recipient pre-filled, body
   editable. Send → status flipped, `✓ Applied` badge on card, mock_emails
   row recorded.
8. ✅ Prevailing wage filter → exactly 1 card.
9. ✅ Public profile in incognito (signed-out) renders with "Hire Marcus"
   CTA and minimal public chrome (Sign in / Build your profile).
10. ✅ Hire Me modal fills + submits → "Inquiry sent" done state.
11. ✅ Inquiries inbox shows Sam Builder card with 4 chips, "new" badge,
    proper counts (All 1, New 1).
12. ✅ Open conversation → `/messages/3` thread renders the structured
    intake as the first message.
13. ✅ Marcus's reply automatically minted a magic-link token + queued
    the inquirer email.
14. ✅ `/h/:token` in a third incognito context renders the conversation
    with proper attribution (You / Marcus Whitfield) + reply form +
    sign-up CTA.
15. ✅ Reply submitted → token burned. Reload → "already replied via this
    link" banner. **Single-use enforcement holds.**

**No console / page errors** captured across all three browser contexts.
Screenshots at `/tmp/smith-verify/shots/` — `06-apply-modal.png` is the
most representative end-to-end frame (Apply with Smith review-before-send
with template draft + recipient pre-fill).

**Smaller observations (worth flagging, not blocking):**
- Hire Me modal's "Send inquiry" button has a subtle busy state — easy
  to miss on slow connections. The `busy={busy}` disable + dim does
  fire, just visually muted.
- Public profile chrome shows no "Back to feed" button when the visitor
  is signed-out. Correct (visitor has no feed) but means a signed-in
  user viewing a peer's public profile uses the browser back button.
- Completeness card auto-hide makes it invisible for fully-populated
  profiles. Probably correct (it's a nudge, not a dashboard), but it'd
  be the only way to discover the unlocks list — no other surface
  enumerates them.

### Jobs module — phase 5 shipped: public profiles + Hire Me (2026-05-29) — **MODULE COMPLETE**
Fifth and final phase of the Jobs module. Closes the loop: Apply was the
outbound direction (tradesman → job), Hire Me is the inbound counterpart
(work → tradesman). Both route through the profile — both reward a
complete one.

**Migration 012 — five schema additions:**
- `users.is_public` (BOOLEAN, default FALSE — opt-in only, per locked decision)
- `users.public_slug` (TEXT, UNIQUE via partial index on non-NULL rows)
- `messages.sender_id` → NULL-able + new `messages.sender_name_override TEXT`.
  This is the load-bearing trick that lets inquirer-side messages live in a
  normal `message_threads` row without a Smith user account — the target's
  existing /api/messages UI Just Works for the conversation side.
- `hire_me_inquiries` — structured intake (name/email/phone + structure_type/
  job_type/location/timeline/message), links to a `message_thread_id`, has a
  `status` enum ('new'|'replied'|'archived'|'spam'), `is_connection_of`
  denormalized at insert for inbox prioritization, `ip` for abuse tracking.
- `hire_me_tokens` — magic-link replies. (target_thread_id, inquirer_email,
  token UNIQUE, expires_at, used_at). One row per email Smith sends to the
  inquirer; single-use on REPLY (GET-only view doesn't burn it).
- pg_trgm extension + partial GIN trigram index on
  `LOWER(first_name||last_name||headline||location)` WHERE is_public, for
  fast `LIKE '%query%'` public search.

**Slug generation (`server/src/slug.js`):**
- `first-last-####` shape (always has letters + hyphen — disambiguates from
  numeric ids in `/profile/<param>` routing without a DB lookup).
- 12 retries on suffix collision then falls back to 8-digit suffix.
- `newMagicToken()` produces base64url 32-char tokens (~190 bits).

**Backend endpoints:**
- `PATCH /api/profiles/me/visibility`     auth — opt-in/out; first opt-in
  generates slug. Opt-out preserves the slug so re-enabling later doesn't
  break shared links.
- `GET  /api/public/profiles/:slug`       NO auth — returns scrubbed profile
  (email + onboarding stripped on top of loadProfile's visitor defaults).
- `GET  /api/public/search?q=&trade=&location=`  NO auth — trigram search.
- `POST /api/public/hire-me/:slug`        NO auth — rate-limited per IP
  (5 / 10 min, in-memory bucket — move to Redis when prod justifies).
  Creates inquiry + thread + initial message (sender_id NULL, name override)
  + notification. `is_connection_of` set if inquirer email matches a user
  the target is connected to. Also fires a target-side email if the target
  has an email on file.
- `GET  /api/public/hire-me/thread/:token`         NO auth — load thread view.
- `POST /api/public/hire-me/thread/:token/reply`   NO auth — single-use.
- `GET  /api/hire-me/inbox`               auth — list inquiries, prioritized
  by (status=new DESC, is_connection_of DESC, created_at DESC), with per-
  status counts for the header.
- `GET  /api/hire-me/inbox/:id`           auth — single inquiry.
- `PATCH /api/hire-me/:id`                auth — status update.

**Magic-link integration (`server/src/hire-me.js`):**
- `notifyInquirerOfTargetReply(threadId, body, replierName)` — hooked into
  `POST /api/messages/threads/:id/messages` as fire-and-forget after the
  insert. Detects Hire Me threads via `hire_me_inquiries.message_thread_id`,
  mints a fresh `hire_me_tokens` row (7-day TTL), emails the inquirer with
  `/h/<token>`. First reply flips inquiry status 'new' → 'replied'.
- Reuses existing `mailer.js` (`sendMockEmail` always writes mock_emails +
  tries Resend) — no new email infra.

**Frontend:**
- `components/VisibilityCard.jsx` — toggle on Edit Profile. Shows current
  state + public URL with Copy + View buttons.
- `pages/PublicProfile.jsx` — `/profile/:slug` reachable signed-out.
  Custom slim header with cover/avatar/headline/location/trades + "Hire
  {first}" CTA (or "Your public profile" if you're viewing your own). Reuses
  AboutSection / FeaturedSection / CompaniesSection / CredentialsSection
  from ProfileSections with `isMe={false}` — owner-only affordances stay
  hidden via existing logic. Minimal `PublicChrome` instead of TopNav
  (avoids MessagesProvider context, doesn't require auth).
- `components/HireMeModal.jsx` — structured intake using `job-types.js`
  STRUCTURE_TYPES + JOB_TYPE_CATEGORIES (full vocab — same as jobsite form).
  Required: name, email, message. Done stage tells the inquirer to watch
  their email.
- `pages/MagicLinkReply.jsx` — `/h/:token` reachable signed-out. Loads
  thread (history + inquiry summary), one-shot reply form, single-use
  enforcement (server-side; UI shows "already used" banner if so). Sign-up
  CTA at the bottom — this IS the warm-signup funnel the journal called out.
- `pages/Inquiries.jsx` — `/inquiries` authed inbox. Filters
  (All/New/Replied/Archived) with counts. Cards show structured chips +
  message body + Mark spam / Archive / Open conversation → buttons.
- App.jsx routing disambiguates `/profile/:param`:
  - `^\d+$` → numeric id (existing authed view)
  - else → slug (PublicProfilePage, works signed-in and signed-out)
- TopNav: new "Inquiries" entry (hardhat icon, between Jobs and News).

**Verified end-to-end (server, curl):**
- PATCH /me/visibility (opt-in) → slug `marcus-whitfield-9344` generated.
- GET /public/profiles/marcus-whitfield-9344 → loads without auth, email
  correctly scrubbed (`email exposed? false`).
- GET /public/search?q=marcus → finds Marcus via trigram index.
- POST /public/hire-me/<slug> → inquiry id 1, thread 1, message 1 created,
  notification fired, target email queued.
- GET /hire-me/inbox (as Marcus) → 1 new inquiry, structured fields intact.
- POST /messages/threads/1/messages (Marcus replies) → magic-link token
  minted (`8EaU2Fl…`), email queued to inquirer with subject "Marcus
  Whitfield replied about Kitchen remodel".
- GET /public/hire-me/thread/<token> → returns both messages with correct
  attribution (TARGET vs INQUIRER labels).
- POST /public/hire-me/thread/<token>/reply → ok.
- Same token retried → 410 "Link already used".
- mock_emails trail: 2 emails (target notify + inquirer reply link).
- Client `vite build` clean (416 KB / 109 KB gzip — +26 KB over phase 4).

**NOT verified:** browser click-through of the public profile, Hire Me
modal, magic-link page, or Inquiries inbox. Builds + API contracts match.

**Default behavior in prod:** users are NOT public by default. Going public
is one click on Edit Profile. The Hire Me button on a public profile works
for any visitor — Smith account or not. Magic-link delivery depends on the
Resend Path A constraint (real delivery only to bryan.hollingshead@gmail.com
until Resend Path B + smith.app domain are live).

**Anti-spam this build:**
- IP-based rate limit (5 inquiries / 10 min, in-memory bucket).
- Required inquirer name + email + message (no captcha yet).
- Slug regex gate prevents path traversal in public endpoints.

If abuse appears: add a hCaptcha / Cloudflare Turnstile checkbox on the
Hire Me form, and tighten the rate limit. Both are quick swaps.

**Jobs module recap — what shipped across all 5 phases:**
1. Resume PDF import + completeness card (Haiku 4.5 extraction).
2. Adzuna driver + ingestion scheduler + admin source registry.
3. Matching algorithm + ranked feed UI + save/dismiss.
4. Assisted apply (Sonnet 4.6) + review-before-send modal + applied status.
5. Public profiles + Hire Me inbound flow + magic-link replies.

**Trusted Auto-Send (phase 6) is the only piece deferred** — the journal
entry from 05-29 is the design; `application_drafts` schema already
supports it (only `status='auto_sent'` value + an opt-in templates table
get added later, no schema rework).

**What still needs setup outside the code:**
- Adzuna creds (`ADZUNA_APP_ID`, `ADZUNA_APP_KEY`) — until set, the source
  is disabled and the Jobs feed shows the empty state.
- Anthropic key (`ANTHROPIC_API_KEY`) — until set, resume parsing 503s and
  assisted-apply falls through to the deterministic template.
- Resend Path B + smith.app domain — until live, Hire Me magic-link
  emails only deliver to bryan.hollingshead@gmail.com (Path A).

### Jobs module — phase 4 shipped: assisted apply (review-before-send) (2026-05-29)
Fourth of the 5 planned phases. **Foundation for Trusted Auto-Send** (phase 6
shares the same `application_drafts` table — only adds `status='auto_sent'` +
a templates table later).

**Migration 011 — additive, one table:**
- `application_drafts` (one row per `(user_id, job_id)` — UNIQUE constraint):
  `generated_body` (the model/template output, preserved verbatim),
  `edited_body` (user edits, nullable), `channel` ('email'|'sms'|'onsite'|
  'deeplink'), `status` ('draft'|'sent'|'auto_sent'), `recipient_email/phone`,
  `sent_at`, `send_error`, `llm_model` (NULL = template fallback),
  `created_at/updated_at`. CHECK constraints on channel + status.
  `updated_at` trigger reuses the `set_updated_at()` function from migration 001.

**LLM wrapper (`server/src/llm.js` — phase 1 stub filled in):**
- `draftApplicationMessage(profile, job) → { body, model }` using Sonnet 4.6,
  `output_config: { effort: 'medium' }`. Stable system prompt under
  `cache_control: ephemeral` so repeat drafts hit the prefix cache (sub-penny
  per draft after the first).
- **Three tiers of cost control** (as locked in the plan): model demotion
  → flag (`ASSISTED_APPLY_LLM=false`) → fall through to template draft. Each
  tier is documented; flipping the flag in Render env disables Anthropic
  spend without a redeploy.
- `templateDraftFallback()` produces a deterministic, edit-ready draft using
  the user's first name, primary trade, years, recent roles, licenses, and
  contact email. Never throws; the model path also degrades to template on
  any error/refusal.

**Public API (`server/src/routes/applications.js`):**
- `POST   /api/jobs/:id/draft`        idempotent — returns existing or creates
- `GET    /api/applications`          list (filters by `?status=`)
- `GET    /api/applications/:id`      single
- `PATCH  /api/applications/:id`      edit body/channel/recipient (4xx if sent)
- `POST   /api/applications/:id/send` route by channel (email/deeplink ship;
  sms+onsite return 501 — schema is in place, providers aren't wired)
- `DELETE /api/applications/:id`      lets user re-draft from scratch

Channels:
- **email** — `sendMockEmail()` from `mailer.js`. Always writes to
  `mock_emails` + logs + tries Resend. Treated as "sent" even when Resend
  delivery is silent (Path A constraints: real delivery only to Bryan's
  address until Resend Path B is up).
- **deeplink** — no real send; status flips to 'sent' so the row is closed,
  user copies the body and pastes into the source posting. The Done screen
  shows the body + "Copy text" + "Open source ↗".

**Frontend:**
- `client/src/components/ApplyModal.jsx` — review-before-send modal. Opens
  via `POST /jobs/:id/draft` (idempotent), shows the generated body in an
  editable textarea, channel picker (email vs deep-link), recipient field.
  Edits PATCH on blur. Send POSTs to `/applications/:id/send`. Done stage
  shows confirmation; deep-link stage adds "Copy text" + "Open source ↗".
- A small **"Drafted from a template"** info banner shows when `llm_model`
  is null (no Anthropic key set / flag off) so the user knows to expect a
  stiffer first draft.
- `pages/Jobs.jsx`: "View source ↗" replaced with **"Apply with Smith"**
  button on every job. After send → swaps to **"✓ Applied"** badge.
  `/api/jobs` now LEFT JOINs `application_drafts` so the `applied` /
  `applied_at` / `application_id` fields are present in the feed payload.

**Verified end-to-end (server, curl as Marcus, no Anthropic key set):**
- POST `/jobs/1/draft` → template fallback (`llm_model: null`), body reads
  naturally ("Hi Wasatch Build Co. team, I'm Marcus, a Carpentry with 18
  years…"), pre-fills recipient from `jobs.contact_email`.
- Re-POST is idempotent (same id).
- PATCH edits body + recipient. Send flips status='sent', `sent_at` set,
  `mock_emails` row recorded with `meta={application_id, job_id}`.
- Send-twice → 409 "Already sent". PATCH on sent → 409.
- POST `/jobs/3/draft` (no contact) auto-selects channel `deeplink`. Send
  is a no-op (status → 'sent', no email).
- `/api/jobs` feed correctly surfaces `applied: true` / `applied_at` after
  send — the "Apply with Smith" → "✓ Applied" swap will just work.
- Client `vite build` clean (390 KB / 104 KB gzip — +8 KB over phase 3).

**NOT verified:** browser click-through of the Apply modal — open, edit,
send, done states. API contract matches; build clean.

**Template draft has a minor wording rough edge** in the LLM-off path
("a Carpentry with 18 years" — should read "a carpenter"). Cosmetic; the
LLM path writes naturally. Will polish once we're running with a real key
and see how often the fallback fires.

**To enable LLM-drafted outreach in prod:**
1. `ANTHROPIC_API_KEY` in Render env (same key as the phase-1 resume parser).
2. Optional: `ASSISTED_APPLY_LLM=true` (default; explicit toggle for kill switch).
3. Cost guardrail: Sonnet 4.6 at ~$0.005/draft uncached, ~$0.001 with the
   stable-system-prompt cache hit. If real usage suggests this is too steep:
   demote to Haiku 4.5 in `llm.js` (one constant change) before killing the
   feature outright.

**Phase 5 next (final phase of Jobs module):** Public profiles + Hire Me —
`is_public` flag + `public_slug` (migration 012), `/profile/:slug`
unauthenticated render, `/api/public/search`, no-auth `POST
/api/public/hire-me/:slug` opens a Smith message thread + magic-link reply
flow.

### Jobs module — phase 3 shipped: matching + ranked feed UI (2026-05-29)
Third of the 5 planned phases. No migration (010 already laid the schema).

**Scoring algorithm (`server/src/jobs/match.js`):**
Blended (not strictly tiered) so a same-trade local with 0 mutuals can still
surface highly. Composition:
- Trade: **+20** if primary trade in `jobs.trade_tags`, **+10** per non-primary trade match
- Skill overlap: **+2** per shared skill (case-insensitive)
- Proximity: **+10** same city, **+5** same state (substring on `location` strings)
- Recency multiplier: **1.0** (≤14d), **0.8** (≤30d), **0.6** (≤60d), **0.4** older
- `final = (trade + skill + location) × recency`, rounded to 2 dp.

Verified against Marcus's seed data (carpentry primary, Cottonwood Heights):
Master Carpenter SLC posted 3d ago = **37** (20 primary + 10 secondary trade +
2 skill + 5 state); Cabinet Maker Provo posted 45d ago = **28.2** (47 base ×
0.6 recency). Non-carpentry jobs cluster at 0-5.

Deferred per the journal's "SLC algo improvements" section: company-overlap
referral signal, blend tuning beyond first pass.

**Recompute triggers (sync, fire-and-forget on profile path):**
- `recomputeMatchesForUser(userId)` upserts every job's score for one user.
  Called sync on first `GET /api/jobs` if `job_matches` is empty for the user,
  async (fire-and-forget) after `PATCH /me` (location change), `POST /me/trades`,
  `POST /me/skills`, and matching steps of `POST /me/interview/step`.
- `recomputeAllMatches()` loops every user × every job. Called at the end of
  every ingestion cycle in `ingestAllJobs()` (skipped if no churn).
- `ON CONFLICT (user_id, job_id) DO UPDATE` preserves `saved_at` and
  `dismissed_at` — those are user actions, not derived, so they stick across
  recomputes.

**Public Jobs feed endpoints (in `routes/jobs.js`):**
- `GET    /api/jobs`           ranked feed; filters `?trade=`, `?has_direct_contact=1`,
  `?prevailing_wage=1`, `?saved=1`, `?include_dismissed=1`, `?posted_since=<days>`,
  `?limit=`, `?offset=`. Sorted by (saved DESC, score DESC, posted_at DESC).
- `GET    /api/jobs/:id`       full detail + computed score, exposes
  description + contact fields hidden in list shape.
- `POST/DELETE /api/jobs/:id/save`     bookmark toggle (idempotent).
- `POST/DELETE /api/jobs/:id/dismiss`  hide-from-default (sticky across recomputes).

**Frontend (`client/src/pages/Jobs.jsx`):**
- New `/jobs` page wired into App.jsx + TopNav (`briefcase` icon, between
  Network and News).
- Filter chips: All / Saved / Direct contact / Prevailing wage.
- Job cards: title + company + location + relative posted time, salary,
  trade chips (canonical) + skill chips (first 4), badges ("Direct contact",
  "Prevailing wage"), match score + source attribution.
- Inline Save / Dismiss / View source ↗ buttons. Save + dismiss are
  optimistic with reload-on-error reconciliation.
- Empty state per filter — explains what to do or what to expect.

**Dev seed (`server/src/seed-jobs-dev.js`, `npm run seed-jobs-dev`):**
- 8 fake jobs across SLC metro + a couple of decoys (Provo cabinet maker,
  Park City finish, SF project manager). Mix of trades, salaries, prevailing
  wage flag, direct contact. Sources from a `dev_seed` row in `job_sources`
  (disabled so the scheduler ignores it). Idempotent: re-runs upsert on the
  dedup key + re-trigger `recomputeAllMatches()`.

**Verified end-to-end (server, curl as Marcus):**
- `GET /api/jobs` returns 8 ranked rows — Master Carpenter (37) > Cabinet
  Maker (28.2) > Finish Carpenter (27) > everything else.
- `?prevailing_wage=1` returns just the Davis-Bacon row.
- POST save / DELETE save toggle correctly.
- POST dismiss removes from default feed (total drops 8 → 7) and persists
  across `?include_dismissed=0` queries.
- DELETE dismiss restores. Cleaned up state at end of test.
- Client `vite build` clean (382 KB / 102 KB gzip — +7 KB over phase 2).

**NOT verified:** browser click-through of the Jobs page (chips, cards,
save/dismiss UX). Build passes, API wiring matches the page contract, but
the visual layer needs eyeballs.

**Default behavior in prod:**
- No real jobs flowing until Adzuna creds are set + `enabled=TRUE` on the
  source row (from phase 2). The Jobs page will show an empty state until then.
- Once jobs ingest, `recomputeAllMatches` runs in-cycle so the feed populates
  for every existing user without per-user triggers.

**Phase 4 next:** assisted apply — `POST /api/jobs/:id/draft` generates a
profile-derived outreach via Sonnet 4.6 (gated by `ASSISTED_APPLY_LLM`),
saves to `application_drafts` (migration 011), user reviews + sends via
email/sms/deep-link. Foundation for Trusted Auto-Send (phase 6).

### Jobs module — phase 2 shipped: Adzuna driver + ingestion (2026-05-29)
Second of the 5 planned phases. **Migration 010** adds the destination tables;
no UI yet (Jobs feed lands in phase 3 with matching).

**Migration 010 — additive, three tables:**
- `job_sources` — driver registry, mirrors `news_feeds`. Each row is one
  ingestion config (driver name + JSONB config + enabled flag + last-run health).
- `jobs` — normalized destination. `UNIQUE (source_driver, source_job_id)` is
  the dedup key (analogous to `news_articles.source_url`). 28 columns covering
  title/company/description/location/lat-lng/salary/url/contact/trade_tags/
  skill_tags/structure_type/job_type/is_prevailing_wage/is_direct_post/
  posted_by_user_id/posted_at/ingested_at/hidden. GIN indexes on both tag
  arrays for phase-3 ranking. `source_id` is ON DELETE SET NULL so deleting a
  source doesn't drop the jobs ingested from it.
- `job_matches` — empty for now, populated in phase 3. Composite PK
  `(user_id, job_id)` so recompute is INSERT…ON CONFLICT UPDATE. Two partial
  indexes for the two read patterns (ranked feed + saved list).

**Seed:** one `job_sources` row for Adzuna SLC (`country:us`,
`where:"Salt Lake City"`, `results_per_page:50`, `max_days_old:14`),
`enabled=FALSE`. Geography lives in JSONB so adding metros is one INSERT.

**JobSource driver interface (mirror of `storage.js`):**
- `server/src/jobs/sources/index.js` — driver registry, one export
  (`getDriver(name)` + `listDrivers()`). Adding a driver = add a file + register.
- `server/src/jobs/sources/adzuna.js` — `adzunaDriver.fetchPage(config, cursor)`
  returns `{items, nextCursor}`. Cursor is opaque to the ingester (`{page}` for
  Adzuna). Reads `ADZUNA_APP_ID`/`ADZUNA_APP_KEY` from env (never config blob).
  Hard timeout 20s, page cap configurable per source (default 3). Trade/skill
  tag inference is keyword-based (mirrors `ingest-news.js`); phase 3 wraps a
  richer matcher via job-types.js. Detects `prevailing wage`/`davis-bacon` for
  the phase-3 feed filter.

**Ingester (`server/src/ingest-jobs.js`):**
- Walks enabled `job_sources` rows, calls `driver.fetchPage` until `nextCursor`
  is null (or `HARD_PAGE_CAP=20` reached), upserts each item.
- Upsert uses `ON CONFLICT (source_driver, source_job_id) DO UPDATE` so edits
  at the source (salary changes, location fixes) propagate, and `ingested_at`
  refreshes on every cycle so source-health reads "last seen N hours ago."
  Insert-vs-update detected via the `xmax = 0` Postgres trick.
- Records `last_status`/`last_count` to `job_sources` so the admin UI can show
  "Adzuna SLC — 47 new 12 min ago" or "ERROR: ADZUNA_APP_ID + ADZUNA_APP_KEY
  not set" without log diving. Bad rows skip; failed source doesn't tank cycle.

**Scheduler (`index.js`):**
- Mirrors the news scheduler. 60-min cadence, prod only. Offset 90s from news
  startup (vs news's 30s) so external APIs aren't slammed in the same window.
- Mounted route file: `server/src/routes/jobs.js`.

**Admin endpoints (all `requireAdmin`):**
- `GET    /api/admin/jobs/sources`        list + health + `available_drivers`
- `POST   /api/admin/jobs/sources`        add a source
- `PATCH  /api/admin/jobs/sources/:id`    enable/disable/edit name+config
- `DELETE /api/admin/jobs/sources/:id`    drop (jobs survive via SET NULL)
- `POST   /api/admin/jobs/ingest`         run cycle now, return summary

`driver` is intentionally immutable via PATCH — change drivers by delete+
recreate to avoid silent shape changes mid-ingest.

**Dev npm script:** `npm run ingest-jobs` runs one cycle from CLI (mirrors
`npm run ingest` for news).

**Verified end-to-end:**
- Migration applies cleanly (`npm run migrate` → "applying 010_jobs.sql").
- Schema confirmed via direct DB query: 9/28/6 columns on the three tables.
- Seed Adzuna SLC row present, disabled.
- Server boots clean with both ingest schedulers wired (only fire in prod).
- All 4 admin endpoints work as Marcus (admin in dev). 401 without auth.
- Manual ingest with disabled source → empty summary (no-op).
- Manual ingest with enabled source, no Adzuna creds → clean error recorded
  to `last_status`: "ADZUNA_APP_ID + ADZUNA_APP_KEY not set". Loop survives.
- `npm run ingest-jobs` CLI works.

**To turn on in prod:**
1. Set `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` in Render env (free tier at
   developer.adzuna.com).
2. Flip the seed source to enabled via curl or Render Shell:
   `UPDATE job_sources SET enabled = TRUE WHERE driver = 'adzuna';`
   Or wait for an admin UI in phase 3.
3. Within 90s of next deploy, first ingest fires. Monitor via
   `GET /api/admin/jobs/sources` (or Render logs for `[ingest-jobs]`).

**Phase 3 next:** matching (job-types.js trade ↔ jobs.trade_tags + skill
overlap + proximity + recency, blended score), `job_matches` populated on
ingest + on profile edits, public Jobs feed UI (`GET /api/jobs`,
`GET /api/jobs/:id`, save/dismiss).

### Jobs module — phase 1 shipped: resume import + completeness (2026-05-29)
First of the 5 planned phases (see [[Jobs module (profile-first build) — planned]]).
**No migration needed — writes into existing tables.** Plan locked-in 8 decisions:
SLC for Adzuna (parameterized via `job_sources.config`), Haiku 4.5 for resume parse
+ Sonnet 4.6 for assisted-apply drafting (env-gated `ASSISTED_APPLY_LLM`),
`/profile/:slug` for public URL (slug always has letters → disambiguates from
numeric `/profile/:id`), magic-link for Hire Me reply, `is_public` default FALSE,
`auto_send_templates` deferred to phase 6, 5 PRs.

**Backend (new files):**
- `server/src/llm.js` — Anthropic SDK wrapper. `extractResumeFromText()` uses Haiku
  4.5 + `output_config.format` (json_schema) for guaranteed-shape structured output,
  with the long system prompt under `cache_control: ephemeral` for prefix caching.
  `draftApplicationMessage()` shell + `assistedApplyEnabled()` flag stub for phase 4.
- `server/src/resume-parse.js` — PDF → text (`pdf-parse@1.1.1`, pinned because 2.x
  needs Node 22+ and Render runs 20) → `extractResumeFromText()`. Rejects scanned
  PDFs (<80 chars of selectable text) so the model isn't hallucinating from nothing.
- Deps: `@anthropic-ai/sdk` + `pdf-parse@1.1.1`.

**Routes (added to `profiles.js`):**
- `POST /api/profiles/me/resume/parse` — multipart PDF upload, returns parsed JSON
  pre-fill, does NOT write.
- `POST /api/profiles/me/interview/step` — incremental save per section
  (`header`/`trades`/`skills`/`licenses`/`work_history`). Companies auto find-or-create
  by name (case-insensitive) so re-runs don't duplicate.
- `GET  /api/profiles/me/resume` — server-rendered printable HTML (browser
  print→PDF). Real PDF generation (puppeteer/pdfkit) deferred — HTML covers the case.
- `GET  /api/profiles/me/completeness` — outcome-linked unlocks: "Show up in
  tradesman search", "Verified badge", "Generate your Smith resume", "Hire Me page
  looks complete". Distinct from existing `/me/strength` (vanity %) — coexist for now.

**Frontend:**
- `components/ResumeImportWizard.jsx` — modal with two stages (upload → review).
  Review shows all parsed sections with per-section enable/disable + inline edits;
  one "Save to profile" click POSTs each enabled section via `interview/step`.
- `components/ProfileSections.jsx` — added `ProfileCompletenessCard` (outcome
  unlocks, hides when fully complete).
- `pages/EditProfile.jsx` — "Have a resume? Drop it in." banner above the tabs
  triggers the wizard.
- `pages/Profile.jsx` — wires `ProfileCompletenessCard` next to existing
  `ProfileStrengthBanner` (don't break what works; retire the old card later).

**Decisions baked into phase 1:**
- Anthropic SDK with `output_config.format: {type:"json_schema", schema}` is the
  canonical structured-output path (`output_format` is deprecated). Manual
  `JSON.parse(response.content[0].text)` because we're plain JS, not TS+Zod.
- Schema mirrors Smith's DB exactly so the interview-step writes are trivial maps.
- Cost guardrail: `extractResumeFromText` caps input at 30K chars (≈7-8K tokens) so
  a runaway PDF can't flood the model. Per-resume cost on Haiku 4.5 is sub-penny.
- Resume HTML render uses `loadProfile()` (same shape as the API) so it stays in
  sync as profile data evolves. No separate template/data model.

**Verified end-to-end (server, curl as Marcus dev account):**
- Auth gate works (all 4 endpoints 401 without token).
- `/me/completeness` returns 4 unlocks, all `done:true` for Marcus's fully-populated
  seed account — proves the gating logic.
- `/me/resume` renders Marcus's name, headline, about, trades, work history.
- `/me/resume/parse` returns clean 400 on no-file, 400 on bad PDF (pdf-parse fails).
- Server boots cleanly without `ANTHROPIC_API_KEY` set; only the parse endpoint
  errors with 503 ("not configured") when the key is missing.
- Client `vite build` clean.

**NOT verified (be honest):** the resume wizard modal UX — file picker → parse →
review → save — was not click-through tested in a browser. The component renders;
the API calls are wired correctly per the contract; the actual happy-path flow with
a real PDF + a real `ANTHROPIC_API_KEY` is the next thing to confirm in prod or
local with a key set. Frontend builds with no warnings.

**To enable in prod:** set `ANTHROPIC_API_KEY` in Render env. Optional:
`ASSISTED_APPLY_LLM=false` to disable the (not-yet-implemented) phase-4 path
preemptively — defaults to enabled.

**Phase 2 next:** Adzuna ingestion via JobSource driver → `job_sources` + `jobs`
tables (migration 010), background scheduler in `index.js` mirroring news.

### Jobs module (profile-first build) — planned (2026-05-29)
Single-player utility before the network exists. Jobs are the forcing function that builds
the profile (the real network asset), not a standalone board. Full build spec handed to
Claude Code separately; summary here so the journal carries the shape.
- **Phase order:** (1) resume/profile generation → (2) Adzuna ingestion via a JobSource
  driver (same pattern as news ingestion + storage driver; KSL/Craigslist OUT — scrape-only,
  ToS-hostile; direct user postings slot in later as just another driver) → (3) trade/skill
  matching via job-types.js → (4) assisted apply (review-before-send) → (5) public,
  searchable profiles.
- **Resume ingest CONFIRMED in scope:** most tradesmen have no resume, but enough do —
  PDF upload + parse pre-fills the profile (phase 1 secondary path); the light interview
  flow covers everyone else. Both write into the existing work_history / credentials /
  trades schema and render as a resume. Output is a Smith profile, not a document.
- **Profile-steering (clean, value-aligned — no dark patterns):**
  - Just-in-time capture — don't front-load a giant form; ask for fields at the moment
    they're needed (first apply, first Hire-Me readiness). Motivation stays intrinsic.
  - Soft apply-gating — applying needs the fields that job requires; Smith pre-fills, so
    the job itself is the reason to complete the profile.
  - Completeness tied to OUTCOMES not vanity %: "Add your license → Verified badge on your
    public profile," "Add 2 more jobs → your Hire Me page looks complete." Every step
    unlocks the thing they already want (work).
  - Resume fast-start CTA — "Have a resume? Drop it, profile built in 30s."
  - License/credential verification as status — tradesmen are proud of their tickets; a
    verified badge is a pull, not a nag.

### Hire Me flow — planned (2026-05-29)
The inbound counterpart to Apply. Apply = tradesman → job (outbound). Hire Me = work →
tradesman (inbound). Both route through the profile, so both reward a complete one.
- "Hire Me" button on every public profile.
- Click → structured inquiry form using job-types.js vocab (structure type / job type /
  location / timeline / message) so the tradesman gets a QUALIFIED lead, not "u available?".
- Inquirer needs no Smith account — capture name + contact + structured details. Doubles
  as a growth vector: the hirer is a warm signup target.
- Inquiry lands as a Smith notification + message thread (reuse existing messages infra);
  email fallback where relevant. Connection-of inquiries flagged/prioritized.
- Anti-spam: rate-limit + required contact info.
- Why it matters: turns the public profile from a static résumé into a lead-gen surface —
  the single strongest reason for a tradesman to complete AND publicize their profile
  (better profile → more Hire Me clicks → more work). Ties directly into the steering above.

### Trusted Auto-Send (deferred this build — but a flagship feature, don't lose it)
Out of scope for the current Jobs build (assisted apply / review-before-send ships first),
but this is the destination the apply architecture is being built toward and a real
differentiator vs every generic board.
- For matched jobs that publish a direct contact (email/phone — common in trades), Smith
  sends a tailored, profile-derived outreach automatically, no per-message review.
- Strictly opt-in + per-template: user approves a template + match criteria ONCE, then
  Smith fires on qualifying matches. Never silent, never spray-and-pray.
- Direct-contact listings only (a real person Smith emails/texts) — never botted
  third-party forms. Keeps it non-spammy and ToS-clean.
- Gated on proven match precision: enable only after assisted-apply data shows matches are
  tight enough that auto-send won't burn the user's (or Smith's) reputation.
- The application_drafts table (channel + status fields) is being built NOW to support
  this later with zero schema rework.

### Smith God accounts — phase 1 LIVE in prod (2026-05-29)
Prod flag confirmed done (was the one open step from the 05-28 build).
- Verified in Render Shell: 4 accounts flagged `is_smith_god = TRUE` —
  Hephaestus Smith (id 7), Ptah Memphis (8), Vulcan Rome (9), Ilmarinen Kalevala (10).
  Suggestions + auto-accept key off the flag, not email, so the feature is live.
- **Decision needed — god account emails are `@smith.test`, not `@smith.app`.**
  Functionally fine (flag-driven), but `.test` is the reserved throwaway TLD → reads as
  leftover seed data, can't receive a real code if verification is ever switched back on,
  and looks unfinished if a user clicks through to a god's profile. Leaving as-is during
  soft launch. Revisit if these become permanent branded accounts: real @smith.app
  mailboxes or at least a consistent non-.test convention.
- **Wayland not created.** 05-28 example list named him; current pantheon is 4. Treating
  4 as the intended starter set unless decided otherwise.
- **Still to verify (behavioral, not SQL):** log in as an under-connected account → confirm
  gods surface under Suggestions with the `⚒ Smith original` line, and that connecting to
  one lands as `accepted` immediately. Proves the shipped code path against real prod data.

### Smith God accounts — phase 1 (2026-05-28)
A handful of existing accounts representing smith deities (Hephaestus, Vulcan, Ptah, Ilmarinen, Wayland, etc.) now surface as network "Suggestions" for new/under-connected users — a branding/onboarding device — without distorting the real friends-of-friends logic.
- **Migration 009** — `users.is_smith_god BOOLEAN NOT NULL DEFAULT FALSE` + partial index `WHERE is_smith_god`. Column only; which accounts are gods is set by hand.
- **Flag accounts** (run in Render Shell with the real email list):
  ```bash
  psql $DATABASE_URL -c "UPDATE users SET is_smith_god = TRUE WHERE email IN ('hephaestus@smith.app', ...);"
  psql $DATABASE_URL -c "SELECT id, first_name, last_name, email, is_smith_god FROM users WHERE is_smith_god;"  # verify
  ```
- **`GET /connections/suggestions`** — the 2-tier algo (FoF → same-location) is **unchanged**; afterward it **additively** appends up to 3 random gods (`ORDER BY random()`) not already in the list or connected. Total can exceed `limit` by ≤3 so gods never crowd out real people. `is_smith_god` added to the shared `CARD_SQL`, so every card carries the flag (gods `true`).
- **Auto-accept** (`POST /connections/request`): if the target `is_smith_god`, the connection inserts as `'accepted'` immediately (no pending), the request notification is skipped, and the connector gets a `connection_accepted` notification ("welcomed you to their network", actor = the god).
- **Frontend** (`Network.jsx`): suggestion cards show a subtle `⚒ Smith original` italic line under the location when `is_smith_god`. Connect button stays "Connect" for now.
- Verified locally end-to-end: god appears + flagged in suggestions, connect → accepted, viewer gets welcome, god gets no request.
- **Out of scope (later phases):** LLM messaging in god voices · @-invocation in posts · special UI (separate section / card style) · pantheon page · "Receive guidance" copy.

### Avatars everywhere — people/connection surfaces (2026-05-28)
- **Root-cause bug:** `connections.js` had its **own** `parseUrls` that returned the raw storage *keys* (`users/1/avatar-thumb-….webp`) instead of building URLs via `publicUrl()`. So `<SmithAvatar>` got bad URLs → images 404'd → silently fell back to the initials monogram. Broke **every** connection-card avatar (Network page + the profile right-rail) since avatars were added — only surfaced when Bryan (first connection with a photo) showed "BH". (commit `5b7e0f8`)
- **Generalized the fix** so it stops being whack-a-mole: added one shared **`keysToUrls(stored)`** helper in `storage.js` (the canonical key→URL converter — use it everywhere, never hand-roll per route). Wired avatars into the endpoints that only returned `avatar_tone` before — **search** + **notifications** (`misc.js`) and **messages** (thread list + conversation peer). Frontend now uses `SmithAvatar` (safe drop-in; falls back to initials when no photo) in: Feed "People you may know", profile right-rail, TopNav search, Alerts, Messages (3 spots). (commits `13b3bb2`, `d0e8c67`, `21ac14e`)
- **Profile right-rail "In your network"** also became clickable → navigates to `/profile/:id` (was a non-interactive `<div>`). (commit `13b3bb2`)
- **Lesson (again):** duplicated per-file serializers drift and rot — one shared helper. And `SmithAvatar` only shows a photo if the endpoint actually returns `avatar_urls`, so the frontend swap and the backend SELECT must land together.
- Note: created 2 throwaway prod accounts while diagnosing (verification's off, so signup was the only way to read prod data without DB access). Cleanup: `DELETE FROM users WHERE email LIKE 'zz-verify-check-%' OR email LIKE 'zz-avatar-probe-%';`

### Profile polish + soft-launch auth (2026-05-27, after Jobsite v2)
- **Jobsite photos = one uniform card per photo.** After several wrong takes (hero + thumbnail strip → 1-per-row full-width stack → 2-up spanning grid with bordered tiles), the right model is dead simple: each photo renders as the *same* card as a single-photo jobsite (image + title / structure·job / location beneath), all in one uniform grid. A jobsite with N photos → N identical cards (same text). `JobsiteGallery` component deleted; `CompaniesSection` now `flatMap`s jobsites → per-photo cards. **Lesson:** when the ask is "make X look like Y," render X with Y's *exact* structure — don't build a parallel variant. (commit `80c3c02`)
- **About bio now renders.** It was saved + returned by the API (`profiles.js`) but **no component displayed it** — the page jumped from header straight to Selected work. Added `AboutSection` (in `ProfileSections.jsx`) under the header: serif heading + bio with line breaks preserved; owner gets an empty-state prompt; hidden for visitors when empty. (commit `538e3c5`)
- **Email verification switched OFF for soft launch.** New `REQUIRE_EMAIL_VERIFICATION` flag in `auth.js`, set to `"false"` in `render.yaml`. When off: signup creates already-verified accounts (no code emailed) and signin + `/auth/me` report `email_verified: true` — bypassing the confirm-email gate for **both new and already-stuck accounts**, with no DB edits or client rebuild. Flip to `"true"` + redeploy once smith.app + Resend Path B are live (signups during the window stay verified — their DB row is genuinely TRUE). (commit `668ea73`)
  - Key fact: the verification gate is **entirely client-side** (`App.jsx:61` reads `user.email_verified`). `requireVerified` exists in `middleware.js` but is applied to **no routes**.

### Jobsite v2 — structured fields + multi-photo galleries (2026-05-27)
- Jobsite form reworked: **structure type** picker, **job type** picker (trade-aware — the user's primary trade sorts to the top, but everything stays visible), single **year** (replaces freeform "Duration"), and an auto-suggested **name** ("Holladay service upgrade" = location + job type, editable)
- `client/src/lib/job-types.js` — `STRUCTURE_TYPES` + a 12-trade job-type vocabulary (starter list; refine after trade interviews). `orderedJobTypeCategories(primaryTrade)` does the sort
- **Multi-photo galleries**: new `jobsite_photos` table (position-ordered, first = primary, reorderable). `jobsites.photo_url` kept as a *denormalized mirror of the primary* so legacy read paths (cards, Featured Work, edit thumbnails) work unchanged
- **Migration 008** — additive only. `kind`/`duration` kept (NOT NULL loosened) so pre-v2 rows still render via fallback (`structure_type · job_type` || `kind`; `year` || `duration`)
- Backend: gallery add/remove/reorder endpoints in `photos.js` (each resyncs the primary mirror); `profiles.js` returns `photos[]` per jobsite in position order
- Frontend: `JobsiteForm` rebuilt as one form for add + edit; profile display renders the full gallery (primary full-width + thumbnail grid)
- **Bug caught + fixed:** the profile display (`ProfileSections.jsx`) initially only read the single `photo_urls` mirror, so only the primary showed even when multiple uploaded. Fixed to iterate `photos[]`
- Deploy: `render.yaml` now has `preDeployCommand: cd server && npm run migrate` — migrations auto-apply before cutover (was manual in Render Shell)
- Shipped: commits `a7b4238` (schema + backend + form) and `ddfe26f` (gallery display + auto-migrate)

### Landing page v2 (2026-05-25)
- Split marketing surface (`/`) from auth surface (`/auth/signin`)
- New `pages/Landing.jsx` — nav + hero with architectural blueprint + credibility band + 3 feature cards + manifesto pull-quote + how-it-works 3-step + final CTA + sitemap footer
- Stripped marketing out of `SignIn.jsx`
- Updated `App.jsx` routing — unauthenticated visitors land on marketing page, not sign-in form
- Uses existing tokens (Inter Tight + Fraunces + IBM Plex Mono, B palette)

### Hourly news ingestion (2026-05-24)
- 19 RSS feeds seeded in prod (Construction Dive, ENR, OSHA, BLS, etc.)
- `setInterval` in `server/src/index.js` runs `ingestAll()` every 60 min in production
- First run: 30s after server boot
- Failures are logged but never throw — won't crash the server
- Articles flowing into `news_articles` table

### Real email via Resend (2026-05-24)
- Resend API key configured in Render env
- New `mailer.js` writes to mock_emails table + logs + sends via Resend
- Sender: `onboarding@resend.dev` (Path A sandbox)
- Limitation: **only delivers to bryan.hollingshead@gmail.com** (Resend account email)
- Other recipients get silent 403 errors

### Render deployment (2026-05-24)
- Postgres `basic-256mb` ($7/mo) + Web Service Starter ($10/mo) = $17/mo
- Single web service serving both API and React build (Option A architecture)
- `render.yaml` blueprint — declarative infrastructure
- R2 storage already wired (env vars set via Render dashboard)
- 8 migrations applied + seed-demo run (populates trades catalog + 4 demo accounts)

### Patch B — multi-photo uploads (2026-05-23)
- Cloudflare R2 wired as storage driver
- Avatar + cover + post photos + jobsite photos + company logos
- SmithAvatar component propagated everywhere
- Click-to-upload UX with thumbnails
- Render in TopNav search, feed, profile timeline, featured work grid

### Earlier wins
- Credential doc upload + auth-via-query-string fix
- Public profile filter (only show licenses with attached docs)
- Storage layer with driver pattern (local in dev, R2 in prod)

---

## 📚 Context-to-write — unlocks deeper roadmap work (2026-06-11)

Working agreement coming out of phase 6: the handoff-bundle pattern (per-flow
README + JSX prototypes) is doing the heavy lifting for individual screens and
should keep being the unit of delivery. What slows me down across flows is
**cross-flow context** — the stuff that's true everywhere but isn't written
down anywhere. Four short docs would unblock me for project management,
bidding, and project initiation work without changing how we work today.

**Length target for each: 1-2 pages. Prose-heavy beats bullet-heavy. The
homeowner-handoff README's ~150 lines was the sweet spot — long enough to
cover ambiguities, short enough that I read every word.**

Priority order (do them in this order; later ones depend on earlier ones):

1. **`docs/domain-model.md` — entity glossary + relationships.**
   Project management is about to introduce project, jobsite, room, bid,
   milestone, task, decision, change-order, punch-item, document. I don't
   currently know which Smith treats as first-class vs derived vs nope.
   The homes-vs-projects-vs-jobsites overlap during phase 6 was the kind
   of thing this catches. Flat list, one-line definition each, "X has many
   Y" relationships, and a tag per entity for "exists today" vs "planned."
   Helps me avoid inventing names that collide with what you mean.

2. **`docs/roles-and-permissions.md` — role × capability table.**
   Homeowner, solo trade, sub, GC — who can invite whom, who sees budgets,
   who posts in feeds, who edits a home/project, who can leave a project,
   what happens to data when they do. ProjectShell already names gc/solo/
   sub; we just added homeowner. A canonical view lets me make permission
   calls without round-tripping. Doesn't need to be exhaustive — just the
   ones we know.

3. **`docs/product-principles.md` — what Smith is, isn't, defers.**
   "We're for the people who build. We don't gamify. We don't compete with
   LinkedIn on jobs-board mechanics. We defer X." When a design is
   ambiguous, this is what tells me whether to lean toward the
   construction-management answer or the social-network answer. Right now
   I infer from journal entries + Landing copy, which works but leaks.

4. **`docs/integration-roadmap.md` — sequence of external services.**
   I've already stubbed Google Places, ATTOM, Street View, Google OAuth,
   and there's still Resend Path B pending. Knowing roughly when each
   lands ("Resend in two weeks, OAuth Q3, Places when we expand outside
   SLC") lets me invest the right amount in each stub vs leave room for
   the real wire-up.

**Things explicitly NOT worth writing:**
- Architecture docs / "how the codebase is structured" — readable from code.
- Style guides for components or coding conventions — discoverable from
  existing files.
- API documentation — `openapi.yaml` + the route files self-document.

**Instruction for future-Claude reading the journal:** if Bryan asks you
to do project management, bidding, or project-initiation work and ANY of
docs 1-4 above are still missing, push back gently before you start. Don't
silently invent the missing context — flag it, propose what you'd need,
and offer to draft the doc together. The cost of a 20-minute alignment
conversation is far less than the cost of building three flows on the
wrong domain model.

---

## 🔥 Vision themes — captured as we go

A holding area for the deep "why" — the emotionally compelling forces
animating Smith. These belong **upstream** of product principles (and
should be the source the principles derive from). To be lifted into
`docs/vision.md` (a context-to-write doc that doesn't exist yet — see
note at end of this section). **Captured here in Bryan's voice; do not
paraphrase into neutral corporate speak when lifting.**

### Three animating themes (2026-06-17, Bryan)

Bryan: *"Some of the themes that keep surfacing for me are
**civilizationmaxxing**, **celebrating the art of building and
creating**, and **keeping communities close and connected**. Those are
some of the more emotionally compelling forces that are animating my
push to build this product."*

**1. Civilizationmaxxing.** The literal act of building the civilization
upward. Not in a tech-bro sense — in the most ancient sense: foundations,
walls, roofs, water, light, infrastructure, the durable physical world
that makes everything else possible. The tradespeople who do this work
are civilization-builders. The hashtag is already in the demo seed
(`#civilizationmaxxing` shows up on Bryan's seeded feed post about the
Temple of Athena) — it's been in the cultural DNA from day one.

**2. Celebrating the art of building and creating.** This is a craft-
worship product. Trades are skilled artisans whose work is treated as
disposable infrastructure in most of the market. Smith treats the work
as ART — the carpenter's joinery, the mason's wall, the electrician's
panel — and gives the craftsperson a portfolio, a peer network, and
a public profile that says *this person made something that lasts.*

**3. Keeping communities close and connected.** The neighborhood / civic
fabric. Tradespeople who serve a town for thirty years know the houses,
know the families, fixed everyone's plumbing. Homeowners who organize
the picnic, fund the park bench, hire the local pro. Smith is the
substrate that makes that proximity legible and reciprocal in a world
that defaults to atomization. This is what the future homeowner-mode
roadmap (neighborhood social, civic-funding, longitudinal home memory)
lives inside of.

**Note (vision doc needed).** The "context-to-write" list above
(docs/domain-model.md, roles-and-permissions.md, product-principles.md,
integration-roadmap.md) was framed around build-unblocking docs. It
should now also include — as priority #0, upstream of the others — a
`docs/vision.md` capturing these themes. When `docs/product-principles.md`
gets written, it should explicitly trace each principle back to one of
these themes so the connection between the deep "why" and the tactical
"how" is documented.

---

## 🧭 Product principles — captured as we go

A holding area for durable product principles surfaced during build work,
to be lifted into `docs/product-principles.md` (context-to-write item #3
above) when that doc gets written. **When that happens, move these entries
into the doc and delete this section** so there's one source of truth.

### Homeowner enrichment is opt-in, just-in-time at value-moments (2026-06-17)
Bryan: *"I want to give them the ability to enrich without requiring or
encouraging unless it brings real value such as during the spec writing
and bid process."*

**The principle.** Homeowner-mode data enrichment (rooms, dimensions,
systems, materials, floor plans, photos) is **only ever surfaced inside
flows where the answer directly improves the outcome the homeowner already
wants**. The data lands as a side effect of getting something useful — not
as a chore.

**Banned patterns.**
- "Complete your profile" nags or progress bars
- Generic onboarding questionnaires beyond initial address-confirm
- Soft-feature-locking ("add 3 more details to unlock X")
- Background reminders to "tell us more about your home"

**The right shape.** When a homeowner starts a job spec / bid request,
the wizard asks "which room, what dimensions, what materials" because
more accurate bids come back. Same data we'd want to collect anyway, but
the homeowner has a concrete reason to share it. Other qualifying
moments: filing a maintenance task, requesting an insurance quote,
asking for a renovation value-impact projection.

**Why this matters.** Generic profile-building is the trap that kills
proptech engagement. The home profile gets rich over time *because* the
homeowner uses the platform's value moments — not from a one-shot
onboarding sprint. Empty rooms, blank systems, missing dimensions are
first-class states, not nag triggers.

**How it shapes decisions.**
- Treat home data as **lazy-populated by design**. Every screen should
  render gracefully on a near-empty home row.
- The homeowner-mode roadmap order should weight features that have
  natural "ask me about my house" moments (spec writing, bidding,
  maintenance scheduling) *earlier* than features that don't, because
  they deliver enrichment as a byproduct.
- Resist adding "complete your profile" widgets even when the data
  would help downstream features. Wait for the downstream feature to
  surface the ask in context.

This pairs with the homeowner-mode framing principle (the
home-management/proptech lens, not the find-a-pro lens) — both protect
the long-arc product from default-LinkedIn patterns.

---

## 🔴 Blocking — fix soon

### R2 SECRET — 65 chars instead of 64
**Status (2026-05-27):** likely resolved — multi-photo uploads succeeded in prod this session. Confirm the length is 64 (diagnostic below) and delete this entry if so.
Photo uploads in prod throw `"signature does not match"` errors. Diagnostic:
```bash
# in Render Shell:
echo "SECRET len: ${#R2_SECRET_ACCESS_KEY}"
# returned 65; should be 64
```
**Fix:** Render → smith → Environment → Edit → reveal R2_SECRET_ACCESS_KEY → delete value → re-paste cleanly from password manager (no trailing whitespace) → Save. Then verify length is 64. ~5 min.

### Real customers can't get verification emails
**Status (2026-05-27): MITIGATED — verification turned OFF for soft launch** via `REQUIRE_EMAIL_VERIFICATION=false` (render.yaml). Signups now work without a code; no per-user SQL needed. **Re-enable** (flip to `"true"` + redeploy) once Resend Path B / smith.app is live. See "Profile polish + soft-launch auth" above.
Original issue: until Resend Path B is set up, codes only deliver to bryan.hollingshead@gmail.com, so other signups couldn't verify. Old per-user workaround (not needed while the flag is off):
```bash
psql $DATABASE_URL -c "UPDATE users SET email_verified = TRUE WHERE email = 'their@email.com';"
```

---

## ⏸ Open — when ready (no urgency)

### Rotate Rentcast API key (low priority — exposure was low, not zero)
**Status (2026-06-17):** Key `85efb…` got read into a Claude Code conversation transcript on 2026-06-15 when a corrupted `server/.env` had to be `cat`'d to diagnose a paste-script failure. Not committed, not pushed, not in any public location — but it sat in a conversation context that's reviewable by Anthropic. Bryan decided the exposure is low enough to defer rotation. When you do rotate:
1. https://app.rentcast.io → API → Regenerate
2. Update `server/.env` locally + Render env var
3. Manual Deploy on Render to pick up the new key

### Wire real address autocomplete + property records (priority — Bryan wants this next)
**Status (2026-06-11):** Stubbed during phase 6 — `STUB_PLACES` only returns
three SLC matches around 847 E 9th Ave, so any real address (Bryan's test
case: `5614 S Laurelwood`) returns no suggestions. Bryan asked for the
real thing wired next: "it will be magical."

**Vendor decisions (Bryan confirmed wants real):**
- **Autocomplete:** Google Places Autocomplete (New). Best UX, session-token
  pricing keeps per-lookup cost down (~$0.017/session at last check —
  verify on the GCP billing page before wiring). $300 free credit on new
  GCP accounts covers months of soft-launch volume. Server-side proxy so
  the API key never reaches the browser.
- **Property records: ATTOM** (over Estated). ATTOM is the industry-grade
  pick — used originally by Zillow/Redfin, comprehensive coverage, stable.
  Pricier per call but the safer bet. Estated was the budget alternative
  but Black Knight/ICE acquired them in 2023 and the API's long-term fate
  is uncertain; not worth integrating against a product that may sunset.
  ATTOM offers a free trial — sign up first, verify SLC suburb coverage
  with the Laurelwood address before committing.
- **Skipped:** CoreLogic (enterprise sales only), HouseCanary (valuation-
  focused, overkill), Rentcast/Realie (newer, less coverage), direct
  county-assessor scraping (per-county brittle).

**Implementation seams (already clean in `server/src/routes/homes.js`):**
- Replace `STUB_PLACES` + the `/places/autocomplete` handler with a
  server-side proxy to Google Places. Use session tokens (passed through
  from the client) so all keystrokes + the final Place Details call bill
  as one session. Map the Place Details response into the same shape the
  client already consumes (`{ place_id, main, sub, _components }`).
- Replace `STUB_RECORDS` + the `/places/records` handler with an ATTOM
  call keyed by lat/lon (Places returns coords) or canonical address.
  Map ATTOM's response into our existing `facts_source_attribution` +
  fact-column shape; the client doesn't need to change.
- Add a `home_lookups_cache` table or in-memory LRU keyed by place_id →
  both APIs charge per call and re-querying the same home wastes money.
  TTL maybe 30 days for facts (records don't change often), 24h for
  geocoding.
- API keys live in `server/.env` (`GOOGLE_PLACES_API_KEY`, `ATTOM_API_KEY`)
  — already gitignored. Set the same vars in Render env via the dashboard
  (mark `sync: false` in `render.yaml` so they don't get overwritten).

**What Bryan needs to provide before this lands:**
- GCP project + Google Places API key (enable the Places API + set up
  billing; the free credit covers soft launch but billing must be enabled
  even to use the free tier).
- ATTOM free-trial signup → API key.
- Confirm the Laurelwood address resolves cleanly in ATTOM's coverage
  before going further (avoids the failure mode of wiring everything then
  discovering the address isn't in the dataset).

Estimated ~2 hours implementation once keys are in hand, plus the
verification probes against real addresses.

### Domain registration — smith.app (planned this week)
- Decision: smith.app via Cloudflare Registrar (already have R2 there, keeps DNS clean)
- ~$15/yr
- Backup names if taken: smith.build, smithwork.app, smithtrades.com

### Resend Path B (depends on domain)
- Add smith.app as verified Resend domain (4-5 DNS records in Cloudflare)
- Set `RESEND_FROM_EMAIL=noreply@smith.app` in Render env
- After verification, can send to any email (sandbox restriction lifts)
- ~30 min once domain is registered

### Cloudflare R2 key rotation
- Original R2 access keys still in play (set during initial dev)
- Bryan mentioned wanting to rotate before truly opening Smith to the public
- Process: Cloudflare R2 → create new key → update value in Render env + local `.env` → delete old key
- ~15 min

### Custom domain on Render
- Once smith.app is registered, add it as custom domain in Render service settings
- Cloudflare DNS: CNAME pointing to Render
- SSL auto-provisioned by Render
- Update `CLIENT_ORIGIN` env in Render to `https://smith.app`

### Polish profile screens — for landing screenshots
Friends are populating real data in dev. When complete, capture polished screenshots for landing page slots:
- Marcus's full profile page (cover, avatar, "Where I've worked," credentials)
- Featured Work grid with real photos
- Edit Profile work history showing photo upload affordance + Hercules logo
- Feed post with photo attached
- Credential card with "View document" link
- TopNav search dropdown showing Hercules logo result

### Slot product screens into landing
Once polished screenshots exist, swap in:
1. **Hero right column** — replace architectural blueprint with layered Smith UI composition (profile page + jobsite tile + credential card)
2. **Inside each feature card** — small product snippet at top of each card instead of SVG mark
3. **New "Inside Smith" gallery section** — full-bleed product gallery between feature cards and manifesto pull-quote

Code slots are intentionally clean in Landing.jsx for easy swap.

---

## 💡 Future / ideas (no commitment yet)

### Future / when ready: SLC algo improvements
Connection-suggestion ranking boosts we discussed but deferred (the current algo is only friends-of-friends by mutual count → same-location fallback):
- **Company-overlap boost** — rank up people who've worked at a company you've also worked at (shared `work_history.company_id`), even if you never overlapped in time. Strong signal in trades (same GC/sub crews).
- **Same-trade boost** — rank up people who share one of your trades (especially your primary), scoped to region. Helps a new electrician find other electricians nearby.
- **Blend, don't replace** — combine into a weighted score (mutual count + company overlap + trade match + proximity) rather than strict tiers, so a same-trade local with 0 mutuals can still surface.
- Keep the smith-god additive bonus seats on top regardless of ranking.

### Perplexity-style news synthesis
- Current state: raw articles from 19 RSS feeds, basic tag inference
- Vision: cluster related articles, LLM-synthesize 2-3 sentence summaries per story cluster, personalize by user's trades
- Reference: Perplexity Discover/News surface
- Big project — ~1-2 weeks of dedicated work
- Foundation already in place (ingestion → articles table)

### Construction Project Management module (Phase 2)
- Separate product surface for managing actual jobsite projects
- Currently aspirational — Smith is the network/identity layer first

### Production monitoring
- Sentry or similar for error tracking once real users are active
- Not needed yet (one real user: Bryan)

### Shutdown hang fix
- Ctrl+C on local dev server occasionally hangs
- Annoying but not blocking
- Low priority

### Orphaned R2 cleanup script
- When users delete posts/profiles, R2 objects become orphaned
- Not a problem until storage costs matter
- Sweep script would scan DB → list of valid keys → diff against R2 listing → delete orphans

---

## 🎯 Constants / reference

- **Tech stack:** Node 20+ Express ESM · React 18 · Vite 5 · Postgres · Cloudflare R2
- **Render service ID:** srv-d89ffcjbc2fs73f60jbg
- **Production URL:** https://smith-h86n.onrender.com
- **R2 bucket:** smith-uploads
- **R2 account ID:** 38b6e027a043c0e00f86e921a8852fae
- **Resend default sender:** onboarding@resend.dev (Path A)
- **Demo password (4 prod demo accounts):** demo-account-* (random, set in seed-demo.js — not signable; is_demo=true blocks login)
- **Dev seed password:** framer-2024-mt
- **Bryan's prod account:** bryan.hollingshead@gmail.com (id=1, lowercase in DB)
- **Bryan's local dev account:** Marcus Whitfield (marcus.whitfield@smith.test / framer-2024-mt, id=1 in dev)
- **JWT_EXPIRES_IN:** 7d
- **RESET_TOKEN_TTL_MIN:** 30
- **EMAIL_CODE_TTL_MIN:** 15
- **News ingestion cadence:** every 60 min in production

---

## 🛠️ Workflow notes

- **File workflow:** Claude generates artifacts → Bryan downloads from artifacts panel → files land in `~/Downloads/` (Safari often overwrites same-name files, no `(1)` suffix)
- **Standard install:** `cp ~/Downloads/file.jsx ~/Desktop/smith-app/...`
- **Verify install:** grep for a known-new string with `grep -c`
- **Git commits:** single-line messages only (multi-line causes `dquote>` hangs in zsh)
- **Two terminal pattern (dev):** server on port 4000, vite on port 5173
- **Prod-mode local test:** `NODE_ENV=production node src/index.js` (port 4000 serves both API + client/dist)
- **Render Shell access:** dashboard.render.com → smith → Shell tab
- **Render Logs:** dashboard.render.com → smith → Logs (filter with search box, `mailer` / `ingest` / etc.)
- **Render auto-deploys** on every push to main branch via Blueprint webhook
- **DB migrations auto-apply on deploy** via `render.yaml` `preDeployCommand` (`npm run migrate`, idempotent) — no more manual `migrate` in Render Shell. Note: this runs against prod *before* cutover, so a bad migration blocks the deploy (safe)
- **Confusion alert:** Cloudflare R2 dashboard (orange logo, R2 sidebar) vs Render dashboard (white/purple, services list) — easy to mix up when both are open in tabs

---

## 📝 Notes on landing page (Sep 2026)

### Design decisions made
- Architecture: split `/` (marketing) from `/auth/signin` (auth) — cleaner than combined page
- Hero visual: architectural blueprint as placeholder until polished product screens are available
- Trade band: 6 trades named explicitly above the fold (Carpenters · Electricians · Masons · Plumbers · GCs & Subs · Foremen) — replaces fake testimonials with self-identification
- Feature cards: dropped soft gradient blobs (Bryan called them "blah"), replaced with custom SVG marks
- Card 3 copy: changed "showed up clean for two years" → "the journeyman everyone's foreman wishes they could keep" (avoids drug-test connotation)
- Manifesto quote: "LinkedIn is for desk jobs. Smith is for people who actually build things — and want their work to speak for itself." — placeholder for real customer quote
- 3-step "How it works" section added (was missing entirely)
- Footer expanded from one row to sitemap

### Open landing-page questions
- Final CTA copy ("The work is what counts. Let it count.") — keep or refine
- Whether to soften/sharpen the LinkedIn manifesto line
- Hero blueprint — keep as fallback after screenshots ship, or remove?

---

End of journal. Update at end of each session.
