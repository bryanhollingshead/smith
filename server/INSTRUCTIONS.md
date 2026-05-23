# Smith — Patch A: Storage Layer + Profile Photos — Apply Instructions

This patch adds:

1. **Storage abstraction** (`server/src/storage.js`) — driver-pattern with `local` and `r2` drivers, selected by env var.
2. **Image processing** (`server/src/image-processing.js`) — Sharp pipeline that resizes to 3 WebP variants (thumb/medium/full). Discards originals.
3. **Migration 006** — adds `users.avatar_url` and `users.cover_url`.
4. **New photo routes** — `POST/DELETE /api/photos/avatar` and `/api/photos/cover`.
5. **Files endpoint** — `GET /api/files/*` to serve storage objects (used by the local driver; also by R2 driver when no public-base is configured).
6. **Credential docs migration** — `routes/credential-docs.js` rewritten to use storage.js. Existing license `doc_url` filenames continue to work.
7. **Frontend** — new `<SmithAvatar>` (smart avatar: prefers photo, falls back to initials), new `<PhotoUpload>` component.
8. **New deps:** `sharp`, `@aws-sdk/client-s3`.

Plus small inline edits to existing files documented at the bottom.

## Step 1: Drop files in place

```bash
cd ~/Desktop/smith-app
unzip -o ~/Downloads/smith-fix-storage-photos.zip
```

New/overwritten files:

```
server/.env.example                          (new)
server/migrations/006_photo_urls.sql         (new)
server/src/storage.js                        (new)
server/src/image-processing.js               (new)
server/src/routes/photos.js                  (new)
server/src/routes/files.js                   (new)
server/src/routes/credential-docs.js         (REPLACED — uses storage.js now)
server/package.json                          (REPLACED — adds sharp + aws-sdk)
server/tests/storage.sh                      (new)
client/src/components/SmithAvatar.jsx        (new)
client/src/components/PhotoUpload.jsx        (new)
server/INSTRUCTIONS.md                       (this file)
```

## Step 2: Install new dependencies

```bash
cd ~/Desktop/smith-app/server
npm install
```

Sharp downloads pre-built binaries — ~30 seconds. AWS SDK is ~10MB on disk — expected.

If `npm install` fails on Sharp:

```bash
npm install --include=optional sharp
```

## Step 3: Update your `.env`

Open `~/Desktop/smith-app/server/.env` (NOT `.env.example`). Add:

```
STORAGE_DRIVER=local
```

This keeps you on local-disk for now. **Don't add R2 credentials yet** — we verify everything locally first.

## Step 4: Apply migration + reseed

```bash
cd ~/Desktop/smith-app/server
npm run reset
```

You should see `applying 006_photo_urls.sql` in the output.

## Step 5: Inline edits to existing files

### Edit 5a — `server/src/index.js`

Wire in the new routes. Two import lines at the top with the others:

```js
import photosRouter from './routes/photos.js';
import filesRouter from './routes/files.js';
```

Two `app.use` lines with the existing route mounts:

```js
app.use('/api/photos', photosRouter);
app.use('/api', filesRouter);
```

### Edit 5b — `server/src/routes/profiles.js`

Expose `avatar_url` and `cover_url` on the profile object.

**(i) Add columns to the user SELECT.** Find this SELECT in `loadProfile`:

```js
SELECT id, email, email_verified, first_name, last_name, headline, location, about,
       avatar_tone, cover_kind, verified_smith, ...
```

Add `avatar_url, cover_url` somewhere in the column list (e.g. right after `cover_kind`).

**(ii) Add a helper near the top of the file** (after imports, before `loadProfile`):

```js
// avatar_url and cover_url are stored as JSON strings like
// { "thumb": "users/42/avatar-thumb-abc.webp", ... }. We parse them to
// objects and rewrite each variant to an absolute /api/files URL so the
// frontend can render them directly.
function parseUrls(stored) {
  if (!stored) return null;
  let parsed = stored;
  if (typeof stored === 'string') {
    try { parsed = JSON.parse(stored); } catch { return null; }
  }
  if (typeof parsed !== 'object' || !parsed) return null;
  const out = {};
  for (const [size, key] of Object.entries(parsed)) {
    if (typeof key === 'string') {
      const encoded = key.split('/').map(encodeURIComponent).join('/');
      out[size] = `/api/files/${encoded}`;
    }
  }
  return out;
}
```

**(iii) Add to the returned profile object** at the bottom of `loadProfile`. Anywhere in the big return object — natural placement is next to `avatar_tone`:

```js
    avatar_urls: parseUrls(u.avatar_url),
    cover_urls:  parseUrls(u.cover_url),
```

### Edit 5c — `client/src/pages/EditProfile.jsx` (frontend wire-up)

Open `EditProfile.jsx`. Imports at top:

```jsx
import { PhotoUpload } from '../components/PhotoUpload.jsx';
import { SmithAvatar } from '../components/SmithAvatar.jsx';
```

Add an avatar + cover section in the form (near the top of the editor):

```jsx
<div style={{ display: 'flex', gap: 24, marginBottom: 24, alignItems: 'flex-start' }}>
  <div>
    <div style={{ fontSize: 12, color: B.dim, fontStyle: 'italic', marginBottom: 8 }}>
      Profile photo
    </div>
    <PhotoUpload
      kind="avatar"
      currentUrls={profile.avatar_urls}
      onChange={(urls) => setProfile(p => ({ ...p, avatar_urls: urls }))}
      preview={(urls) => (
        <SmithAvatar
          urls={urls}
          initials={profile.initials}
          tone={profile.avatar_tone}
          size={96}
        />
      )}
      label="Upload photo"
    />
  </div>
  <div style={{ flex: 1 }}>
    <div style={{ fontSize: 12, color: B.dim, fontStyle: 'italic', marginBottom: 8 }}>
      Cover photo
    </div>
    <PhotoUpload
      kind="cover"
      currentUrls={profile.cover_urls}
      onChange={(urls) => setProfile(p => ({ ...p, cover_urls: urls }))}
      preview={(urls) => (
        <div style={{
          width: '100%', height: 120, borderRadius: 4,
          background: urls?.medium
            ? `center/cover url("${urls.medium}") no-repeat`
            : B.surface2,
          border: `1px solid ${B.line}`,
        }}/>
      )}
      label="Upload cover"
    />
  </div>
</div>
```

Adapt naming if your EditProfile state shape uses different variable names.

### Edit 5d — `client/src/components/ProfileSections.jsx` (use new avatar)

In ProfileHeader, import SmithAvatar:

```jsx
import { SmithAvatar } from './SmithAvatar.jsx';
```

Swap the existing `<Avatar ...>` in the header for:

```jsx
<SmithAvatar
  urls={profile.avatar_urls}
  initials={profile.initials}
  tone={profile.avatar_tone}
  size={120}  /* keep the size you already had */
/>
```

For the cover banner, where the gradient is drawn, prefer the cover URL when present. Something like:

```jsx
style={{
  background: profile.cover_urls?.medium
    ? `center/cover url("${profile.cover_urls.medium}") no-repeat`
    : /* your existing tone-based gradient here */,
  /* ...rest of styles */
}}
```

## Step 6: Restart the server

```bash
# Ctrl+C, then:
npm run dev
```

## Step 7: Run the storage smoke test

```bash
bash tests/storage.sh
```

Should print 7 green check marks ending in `🎉 All 7 storage checks pass.`

## Step 8: Test in the browser

Sign in. Edit Profile. Upload an avatar + cover. Confirm:
- Upload progress shows
- Preview updates immediately after upload completes
- After saving / refreshing, the new avatar appears on your profile + in TopNav

## Step 9: Switch to R2 (when ready)

1. Add R2 credentials to `server/.env`:

```
STORAGE_DRIVER=r2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=smith-uploads
R2_PUBLIC_BASE=        # leave blank for now
```

2. Restart the server.
3. Re-run `bash tests/storage.sh` — should still pass.
4. Check your Cloudflare R2 dashboard — you should see `users/<your-id>/avatar-thumb-...webp` etc.

If R2 errors, the server log will say why (wrong credential format, bucket not found, network reachability).

## Step 10: Commit

```bash
cd ~/Desktop/smith-app
git add .
git commit -m "Storage layer (local+R2) + profile photos (avatar+cover)"
git push
```

---

## What's NOT in this patch (coming in Patch B)

- Jobsite photos (up to 10 per jobsite, gallery)
- Post photos (up to 4 per post, real images)
- Company logo upload

Same patterns broadened. Patch B will be a faster session because Patch A built the foundation.

## Notes on R2 + deployment

When you deploy to Render later:
- Set `STORAGE_DRIVER=r2` in Render's env vars
- Set the 4 R2 vars there too
- Optionally configure R2 bucket for public access + set `R2_PUBLIC_BASE` to the bucket's public URL — images load direct from Cloudflare's CDN rather than proxying through Node. Faster + cheaper.

Local driver continues to work for local dev. Standard split: `STORAGE_DRIVER=local` locally, `STORAGE_DRIVER=r2` in production.
