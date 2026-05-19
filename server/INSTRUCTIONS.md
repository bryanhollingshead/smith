# Smith — API Spec & Commandment Patch — Apply Instructions

This patch adds:
1. **`docs/API_COMMANDMENT.md`** — Smith's architectural constitution: the additive-only API rules
2. **`docs/api.yaml`** — Full OpenAPI 3.1 spec covering all ~45 endpoints (59 path+method combos)
3. **`server/src/routes/openapi.js`** — Serves the spec + Swagger UI at `/api/docs`
4. **`server/src/middleware-version.js`** — Reads `Smith-Version` header (currently unused, plumbed for the future)
5. **`server/tests/api-shape.sh`** — Smoke test that catches accidental contract drift

Plus **two small edits to existing files** to wire it together.

## Step 1: Drop files in place

```bash
cd ~/Desktop/smith-app
unzip -o ~/Downloads/smith-fix-api-spec.zip
```

You should see these 6 new files in the unzip output:
- `docs/API_COMMANDMENT.md`
- `docs/api.yaml`
- `server/src/routes/openapi.js`
- `server/src/middleware-version.js`
- `server/tests/api-shape.sh`
- `server/INSTRUCTIONS.md` (this file)

## Step 2: Edit `server/src/index.js`

Three additions to this file. Open it in your editor.

**(a) Add the new imports near the existing route imports.** Find this block at the top:

```js
import messagesRouter from './routes/messages.js';
import { attachMessagingWS } from './routes/messages-ws.js';
```

Add these two lines immediately after:

```js
import openapiRouter from './routes/openapi.js';
import { readClientVersion } from './middleware-version.js';
```

**(b) Wire the version middleware in BEFORE any route handlers.** Find where the JSON body parser is registered:

```js
app.use(express.json({ limit: '1mb' }));
```

Add this line right after it:

```js
app.use(readClientVersion);
```

**(c) Mount the OpenAPI router alongside the existing routes.** Find:

```js
app.use('/api', credentialDocsRouter);
app.use('/api/messages', messagesRouter);
```

Add this line right after them:

```js
app.use('/api', openapiRouter); // serves /openapi.yaml, /openapi.json, /docs
```

That's all for `index.js` — three additions, none touching existing lines.

## Step 3: Edit `client/src/lib/api.js`

We want every outbound request from the web client to carry the `Smith-Version` header. The current build's date is `2026-05-19`.

Open `client/src/lib/api.js`. Find the `fetch(...)` call inside the helper that does HTTP requests. It'll look something like:

```js
const r = await fetch(url, {
  method,
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: body ? JSON.stringify(body) : undefined,
});
```

Add a Smith-Version header into the headers object:

```js
const r = await fetch(url, {
  method,
  headers: {
    'Content-Type': 'application/json',
    'Smith-Version': '2026-05-19',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: body ? JSON.stringify(body) : undefined,
});
```

If your `api.js` has multiple fetch calls (e.g. one for JSON, one for multipart upload), add the header to each. The version string `2026-05-19` is today's date — we update this when we ship a client build locked to a specific API generation. For now, "today" is fine.

**Note:** This header is currently informational. The server reads it into `req.smithVersion` but no route gates behavior on it. The plumbing is in place for when (if) we ever need it.

## Step 4: Restart the server

```bash
cd ~/Desktop/smith-app/server
# Ctrl+C the running server, then:
npm run dev
```

Watch for any startup errors — most likely culprit is a typo in the index.js edits.

## Step 5: Visit the API docs

Open your browser to:

```
http://localhost:5173/api/docs
```

(Or directly: `http://localhost:4000/api/docs`)

You should see a Swagger UI with **Smith API** as the title and every endpoint listed by tag (Auth, Profiles, Connections, etc.). Click any endpoint to see the request/response schema. The "Authorize" button in the top right lets you paste a JWT to test authenticated endpoints right from the browser.

## Step 6: Run the smoke test

```bash
cd ~/Desktop/smith-app/server
bash tests/api-shape.sh
```

You should see 10 green checkmarks ending in:

```
🎉  All 10 API shape checks pass.
```

This test will become more important over time. As you add endpoints, add one more check here — if the response shape ever drifts from what we documented, the test fails loudly.

## Step 7: Read the commandment

This is genuinely worth 5 minutes of your time:

```bash
open docs/API_COMMANDMENT.md
```

When you bring on other developers (or come back to this codebase yourself in 6 months), this is the first thing to read. It codifies the additive-only discipline we've agreed to.

## Step 8: Commit

```bash
cd ~/Desktop/smith-app
git add .
git commit -m "API: OpenAPI spec + additive-only commandment + docs UI"
git push
```

---

## What this does NOT do

- Does NOT move any endpoints. No path versioning, no URL changes.
- Does NOT change any existing endpoint behavior. Backward-compatible in every direction.
- Does NOT install any npm dependencies. Swagger UI is loaded from a CDN.
- Does NOT add any new auth/authorization requirements.

## What this enables

- **Single source of truth** for the API contract (`docs/api.yaml`)
- **Browsable documentation** at `/api/docs` — share that URL with future devs
- **The additive-only commandment** is codified, not just a verbal agreement
- **Version plumbing** in place — when we want to gate behavior on client build dates later, it's a one-liner per route
- **Drift detection** via the smoke test — catches accidental breaks before they ship

---

## Future enhancements (defer until needed)

- Swap Swagger UI for **Redoc** or **Scalar** when you want sleeker docs (10-line change)
- Add `js-yaml` as a dep so `/api/openapi.json` works (only if a tool wants JSON)
- Add CI check that runs `api-shape.sh` on every push
- Generate a TypeScript client from the spec when mobile dev starts (`openapi-typescript-codegen` or similar)
