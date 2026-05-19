# Smith — SLC + Demo Seed Patch — Apply Instructions

This patch adds:
1. A new migration (`005_demo_flag.sql`) — adds `users.is_demo` column
2. A rewritten dev seed (`seed.js`) — SLC-themed cast + Bryan founder account
3. A new prod-safe demo seed (`seed-demo.js`) — 4 fully-fleshed demo accounts
4. A `npm run seed-demo` script
5. A new helper (`demo-gate.js`) — centralized demo-blocking checks
6. A "Demo" badge on profile pages (frontend file `ProfileSections.jsx`)

It also requires **three small one-line edits** to existing files you have, to
wire the demo-blocking into your connection and messaging routes. They are
listed at the bottom of this file.

## Step 1: Drop files in place

The zip mirrors your `server/` directory structure. Unzip overwrites:
- `server/migrations/005_demo_flag.sql` (new)
- `server/src/seed.js` (overwrite)
- `server/src/seed-demo.js` (new)
- `server/src/demo-gate.js` (new)
- `server/package.json` (overwrite — only adds `seed-demo` script)
- `client/src/components/ProfileSections.jsx` (overwrite — adds Demo badge)

## Step 2: Apply migration + reseed (dev)

```bash
cd ~/Desktop/smith-app/server
npm run reset
```

This:
- Drops all tables, re-runs all 6 migrations (including the new `005_demo_flag.sql`)
- Reseeds with the SLC cast
- Auto-runs `seedDemos()` so the demo accounts exist in dev too

You should see:
```
[migrate] applied 6 file(s)
[seed] done.
[seed-demo] 4 created, 0 already present.
```

## Step 3: Verify production demo seed works idempotently

```bash
npm run seed-demo
```

Should print `[seed-demo] 0 created, 4 already present.` — that's the
idempotency confirmation. Safe to run against a live prod DB; will never
overwrite a real user account.

## Step 4: Three small edits to wire in demo-blocking

These are the ONLY edits to existing route files. Each is a 1-2 line addition.

### Edit 1: `server/src/routes/connections.js`

Find the POST handler for `/request` (where someone sends a connection
request). Near the top of the handler, after `req.userId` is resolved and
`target_id` is read out of the body, add this check BEFORE the existing
validations:

```js
import { eitherIsDemo } from '../demo-gate.js';   // add to imports at top

// ... inside the POST /request handler, after target_id is parsed:
if (await eitherIsDemo(req.userId, target_id)) {
  return res.status(403).json({ error: 'Demo profiles cannot be connected to.' });
}
```

### Edit 2: `server/src/routes/messages.js`

Two spots in this file. Add the import at the top:

```js
import { isDemo, eitherIsDemo } from '../demo-gate.js';
```

In the `POST /threads` handler (create-or-fetch thread), add right after
`peerId` is parsed and before `areConnected` is checked:

```js
if (await eitherIsDemo(req.userId, peerId)) {
  return res.status(403).json({ error: 'Demo profiles cannot be messaged.' });
}
```

In the `POST /threads/:id/messages` handler (send a message), inside the
existing block where we re-check connection at send time, change the
existing `areConnected` line so it ALSO blocks if peer is a demo. Find:

```js
if (peerId && !(await areConnected(req.userId, peerId))) {
  return res.status(403).json({ error: 'You can only message your connections.' });
}
```

Replace with:

```js
if (peerId && (await isDemo(peerId))) {
  return res.status(403).json({ error: 'Demo profiles cannot be messaged.' });
}
if (peerId && !(await areConnected(req.userId, peerId))) {
  return res.status(403).json({ error: 'You can only message your connections.' });
}
```

### Edit 3: `server/src/routes/auth.js`

In the `POST /signin` handler, after the password is verified and BEFORE
the JWT is signed, add a check that refuses to sign in as a demo account:

```js
// After password check passes:
if (user.is_demo) {
  return res.status(403).json({ error: 'Demo accounts cannot be signed into.' });
}
```

The `is_demo` field will be on the `user` row you loaded from the DB.
If your existing code does `SELECT id, password_hash, ...` and doesn't
include `is_demo`, add it to the SELECT list.

### Edit 4: Backend — expose `is_demo` on profiles

In `server/src/routes/profiles.js`, in the `loadProfile()` function (or
wherever a single profile is loaded), make sure `is_demo` is on the
returned object. If your SELECT looks like:

```js
SELECT id, first_name, last_name, headline, location, ... FROM users ...
```

Add `is_demo` to the column list. Then in whatever object you return, include:

```js
is_demo: row.is_demo,
```

Same for any endpoints that return a *list* of users (suggestions, search,
connection cards) — add `is_demo` to the SELECT and pass it through to the
JSON response.

### Edit 5: Frontend — show the Demo badge

A new component `client/src/components/DemoBadge.jsx` is included in the
zip. Add it in three places:

**(a) Profile page header** — in `client/src/components/ProfileSections.jsx`,
import the badge at the top:

```js
import { DemoBadge } from './DemoBadge.jsx';
```

In `ProfileHeader`, right next to where the user's name is rendered, add:

```jsx
{profile.is_demo && <DemoBadge size="lg"/>}
```

(Spot it in your existing JSX — name renders something like `<h1>{profile.first_name} {profile.last_name}</h1>`. Add the badge inline after.)

**(b) Suggestion / connection cards** — in `client/src/pages/Network.jsx`,
import:

```js
import { DemoBadge } from '../components/DemoBadge.jsx';
```

In the card render where the name is shown, add:

```jsx
{card.is_demo && <DemoBadge/>}
```

**(c) New-message picker** — in `client/src/pages/Messages.jsx`'s
`NewMessagePicker` component, alongside the connection name. Since demos
aren't connections, they won't appear here for real users — but on the
profile page where someone might click "Message" on a demo, the disabled
button + badge tells the right story.

## Step 5: Restart your server and test

```bash
# In your server terminal: Ctrl+C, then
npm run dev
```

Things to verify:
- Sign in as `marcus.whitfield@smith.test` — should work, location now says SLC
- Sign in as `bryan.hollingshead@gmail.com` (password `framer-2024-mt`) — should work
- Visit Network → Suggestions — should include the 4 demo accounts with a "Demo" badge
- Try to click "Connect" or "Message" on a demo from another account — should fail with a 403 from the backend
- Try to sign in directly as `demo-carpenter@smith.app` — should be refused

## Step 6: Commit

```bash
cd ~/Desktop/smith-app
git add .
git commit -m "SLC seed reorient + production demo accounts (is_demo)"
git push
```
