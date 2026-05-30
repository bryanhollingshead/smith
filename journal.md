# Smith — Project Journal

A durable record of decisions made, work shipped, and what's still open.
Paste this at the start of a session so Claude is caught up in 30 seconds.
Update it at the end of each session.

**Last updated:** 2026-05-29 (Jobs module phase 2 — Adzuna driver + ingestion scheduler shipped)
**Live URL:** https://smith-h86n.onrender.com
**Repo:** github.com/bryanhollingshead/smith
**Sole dev:** Bryan Hollingshead (product background)
**App root:** ~/Desktop/smith-app/

---

## ✅ Done — recent wins (in roughly reverse chronological order)

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
