# Smith — Project Journal

A durable record of decisions made, work shipped, and what's still open.
Paste this at the start of a session so Claude is caught up in 30 seconds.
Update it at the end of each session.

**Last updated:** 2026-05-25 (end of landing page v2 session)
**Live URL:** https://smith-h86n.onrender.com
**Repo:** github.com/bryanhollingshead/smith
**Sole dev:** Bryan Hollingshead (product background)
**App root:** ~/Desktop/smith-app/

---

## ✅ Done — recent wins (in roughly reverse chronological order)

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
Photo uploads in prod throw `"signature does not match"` errors. Diagnostic:
```bash
# in Render Shell:
echo "SECRET len: ${#R2_SECRET_ACCESS_KEY}"
# returned 65; should be 64
```
**Fix:** Render → smith → Environment → Edit → reveal R2_SECRET_ACCESS_KEY → delete value → re-paste cleanly from password manager (no trailing whitespace) → Save. Then verify length is 64. ~5 min.

### Real customers can't get verification emails
Until Resend Path B is set up, signups from non-Bryan emails fail silently. Workaround:
```bash
psql $DATABASE_URL -c "UPDATE users SET email_verified = TRUE WHERE email = 'their@email.com' RETURNING id, email, email_verified;"
```
Run this in Render Shell for each new real customer. Not scalable, but handles small numbers until domain is verified.

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
