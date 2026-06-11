# Handoff: Smith — Homeowner Entry Flows

## Overview
Two practical entry points by which a homeowner first lands on Smith, plus the two screens they converge on. The goal of these flows is to **mint a "seed" home profile from nothing but an address**, then immediately show the homeowner a sparse-but-real dashboard whose locked modules motivate them to add more detail over time. This is the top of the homeowner-acquisition funnel for a construction networking + project-management platform.

The four screens, in flow order:
1. **Hire-me entry** — homeowner clicked "Hire me" on a tradesperson's public profile; address is required to scope work and contact the pro.
2. **Homeowner self-serve sign-up** — homeowner signs up directly from the Smith marketing site (address + email + password).
3. **Address found** — both paths converge here: Smith auto-pulls public records + street imagery and asks the user to confirm the home.
4. **Seed dashboard** — the sparse "day one" home profile, with a setup checklist and blurred/locked future modules as the carrot.

## About the Design Files
The files in this bundle are **design references created in HTML/React-via-Babel** — prototypes that show intended look and behavior, **not production code to ship directly**. They use in-browser Babel and a hand-rolled icon/avatar/photo-placeholder kit so they can run with no build step.

The task is to **recreate these designs in the target codebase's existing environment** (e.g. a real React/Next app, Vue, SwiftUI, etc.), using its established component library, routing, and styling patterns. If no front-end environment exists yet, choose an appropriate framework (React + CSS-in-JS or Tailwind is a natural fit given the inline-style source) and implement there.

Do **not** ship the `<script type="text/babel">` + CDN-React setup to production — it's for prototype previewing only.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, copy, and layout are all intentional and should be recreated faithfully. Photographic content is represented by CSS gradient placeholders (the `Photo` component) — swap these for real street-view imagery / user uploads in production.

## How to preview
Open `preview.html` in the project (it stacks all four screens in labeled frames). It loads the four `.jsx` files + `smith.css`.

---

## Design Tokens

All from `smith.css` and the `B` (Direction B "Foreman") theme object defined in `smith-direction-b.jsx`.

### Colors
| Token | Hex | Use |
|---|---|---|
| `bg` | `#F5F1E8` | app background (warm cream) |
| `surface` | `#FBF7EE` | cards / panels |
| `surface2` | `#EBE5D6` | insets, track backgrounds |
| `line` | `#D8D0BC` | borders, dividers |
| `text` | `#2A1F17` | primary text (deep walnut) |
| `dim` | `#6B5D4D` | secondary text |
| `faint` | `#9A8E7B` | tertiary / italic captions |
| `accent` | `#C8731F` | terracotta — primary accent, CTAs-as-links, progress |
| `accentSoft` | `#C8731F1A` | accent at ~10% — chip/badge backgrounds |
| Success green | `#7A8A3F` / bg `#e9efde` | "good" status, includes chips |
| Danger red | `#A33A2A` / bg `#fbe8e2` | "attention" status, missing chips |
| Info blue | `#5B7A8A` | homeowner role color |

### Typography
- **Display / headings:** `Fraunces` (serif), weights 500–700, `letter-spacing: -0.01em to -0.025em`. Class `.serif`.
- **Body / UI:** `Inter Tight`, weights 400–700.
- **Mono (rare, data):** `IBM Plex Mono`. Class `.mono`.
- Italic is used heavily for captions/hints (`fontStyle: italic`, in `faint`/`dim`).
- Google Fonts import is at the top of `smith.css`.

### Radii & shape
- Inputs / cards in entry screens: `8px` (slightly rounder than the rest of the app's `4px`).
- Pills / buttons / chips: `100px` (fully round).
- Small status tags: `2px`.
- Photo thumbnails: `3–4px`.

### Shadows
- Card lift: `0 8px 28px rgba(42,31,23,0.08)`.
- Dropdown / modal: `0 12px 32px rgba(42,31,23,0.14)`.
- Focused input ring: `0 0 0 3px #C8731F1A` (accentSoft) with `1px solid accent` border.

### Spacing
Informal 4px-based scale. Common values: card padding `18–26px`; field gap `16px`; section gap `16–20px`; page gutters `32px`.

---

## Shared components (in `smith-shared.jsx`)
- **`<Icon name size stroke />`** — inline SVG stroke icons (1.6 default stroke). Names used in these flows: `mappin, mail, shield, check, arrow-r, briefcase, edit, home, building, image, users, send, star, tool, wind, chevron-r, chevron-d, menu, message, verified, plus, more`. Replace with the target codebase's icon set (e.g. Lucide — these are Feather/Lucide-style paths).
- **`<Avatar initials size tone ring />`** — circular gradient avatar with initials. `tone` ∈ `wood, steel, brick, sage, sand, rust, slate, cream`.
- **`<Photo kind height style />`** — gradient placeholder standing in for a real photo. **In production replace with real `<img>`** (street-view imagery, user uploads). `kind` just selects a gradient.

`smith-project-shell.jsx` exports **`<ProjectShell>`** — the collapsible left-rail + header chrome used by the Seed Dashboard (and all other workspace screens). Props used here: `active, project, otherProjects, navItems, roleData, role, action`.

---

## Screens

### 1. Hire-me entry — `HireMeEntryB`
**Purpose:** Homeowner clicked "Hire me" on tradesperson Marcus Whitfield's public profile. Capture address to scope the job + start a private home profile.

**Layout:** Full-height, two equal columns (`grid-template-columns: 1fr 1fr`).
- **Left** (form, max-width 480px, right-aligned in its column, 48×56px padding): a small `accentSoft` pill "Hiring Marcus Whitfield" (briefcase icon) → serif H1 "Where's the work happening?" (32px) → 14.5px `dim` subhead → **AddressField** (see below, shown in open/autocomplete state) → large spacer → full-width dark pill button "Continue to Marcus" (`text` bg, `surface` text, 15px/600, arrow-r icon) → centered shield-icon reassurance line in `faint` italic.
- **Right** (image panel): `Photo kind="frame"` full-bleed, overlaid with `linear-gradient(135deg, rgba(42,31,23,0.2), rgba(42,31,23,0.72))`. Bottom-anchored white content: Marcus's avatar (brick, 52px, translucent ring) + name/headline, then a serif pull-quote (30px/500) and a 14px supporting paragraph at 0.82 opacity.

**Header (shared by entry screens):** `SmithLogoB` left; "Already have an account? Sign in" right in `faint`, "Sign in" in `accent`.

### 2. Homeowner self-serve sign-up — `HomeownerSignupB`
**Purpose:** Direct sign-up from the Smith page.
**Layout:** Same two-column shell.
- **Left** (max-width 460px): serif H1 "Claim your home." → subhead → **AddressField** (closed state) → `EntryInput` Email (mail icon, prefilled `sarah.christen@gmail.com`) → `EntryInput` password (shield icon, masked, hint "12+ characters.") → terms checkbox row (accent checkbox, 12.5px `dim`, Terms/Privacy links in accent) → full-width dark pill "Find my home" → "or" divider (1px lines + faint label) → outline pill "Continue with Google".
- **Right:** image panel with marketing copy "Your house, finally documented." + a 3-stat row (`12k+ SLC homes`, `6 min avg setup`, `Free to start`).

### 3. Address found — `AddressFoundB`
**Purpose:** Confirmation moment after either entry. Show auto-assembled home + facts.
**Layout:** Single centered column (max-width 920px), own header ("Step 2 of 3 · Confirm your home").
- Centered intro: `accentSoft` pill "Found it — pulled from public records" (check icon) → serif H1 "Is this your home?" (34px) → italic subhead.
- **Card** (`surface`, `1px line`, radius 10, big shadow):
  - **Imagery band** (height 300): `Photo kind="frame"` with bottom gradient. Top-left source chips ("Street view · 2024", "3 photos found") on translucent dark blur. Bottom-right: three 56×42 thumbnail tiles (white 2px border). Bottom-left: serif address (26px) + city line.
  - **Facts band** (padding 22×26): header "What we already know" + source attribution right (italic faint). Then a **4-column grid** of 8 fact tiles (`bg`, `1px line`, radius 6): label (10.5px italic faint) + serif value (16px). Facts: Year built 1924, Square feet 2,840, Bed·bath 4·2.5, Lot 0.18 ac, Stories 2+basement, Last sold Sep 2022·$726k, Roof Asphalt·~2021, Heating Forced air·gas.
  - **Actions:** primary dark pill "Yes, this is my home" (flex:1) + outline pill "Something's off".

> NOTE for production: the assessor attribution currently reads "Gallatin County" (a Bozeman holdover) but the address is Salt Lake City — should read **Salt Lake County Assessor**. Fix on implementation.

### 4. Seed dashboard — `SeedDashboardB`
**Purpose:** Day-one home profile. Sparse real data + locked future modules to drive profile completion. Wrapped in `<ProjectShell>`.
**Left rail (`ProjectShell`):** project switcher pinned to "847 E 9th Ave"; nav items each carry a `sub` that signals emptiness ("0 catalogued", "Add details to unlock"); role badge "Sarah · homeowner" (blue `#5B7A8A`). Header action: dark pill "Complete profile".
**Content (scrolls):**
- **Hero** (height 240): home photo + gradient; translucent blur pill "HOME PROFILE STARTED" (check) → serif address (36px) → facts line.
- **Setup progress bar** (own band): "Your home profile is 18% complete" / "4 of 22 details added"; 7px track filled 18% in `accent`; right-side `accent` pill "Add 3 details → unlock value".
- **Body grid** `1fr 360px`:
  - **Left:**
    - **"Build out your home"** card — 6-row checklist. Rows 1–2 done (filled accent circle + check, strikethrough). Rows 3–6 open; row 3 carries a "DO NEXT" tag; each open row shows what it unlocks in accent italic on the right ("Unlocks maintenance", "Unlocks value & equity", etc.).
    - **"What you'll unlock"** — 2×2 grid of **LockedModule** cards: a blurred `Photo` (blur 3px, 0.5 opacity) under a cream gradient veil, centered lock (shield) icon, serif title, blurb, and an `accentSoft` outline pill ("Log a project to unlock", etc.). Modules: Value & equity, Behind the walls, Smart maintenance, Instant bidding.
  - **Right column:**
    - **"YOUR FIRST PROJECT"** card (`accentSoft` bg, accent border) — Marcus avatar + "Marcus is ready" + dark pill "Describe the work →". (Shown when the user arrived via hire-me; omit/replace for self-serve.)
    - **"From public records"** card — 4 editable fact rows (value + inline edit pencil in accent).
    - **Privacy reassurance** card — shield icon + "Your home, your data".

---

## Interactions & Behavior
- **Address autocomplete** (`AddressField`): on focus/typing, show dropdown of matching addresses from a public-address-records provider (e.g. Google Places, Smarty, Melissa). Selecting one sets the canonical address and triggers the records/imagery lookup. The mock shows the open state with the top result pre-highlighted.
- **Address → records pull:** on confirm, call a property-data provider (assessor/MLS aggregator such as ATTOM, CoreLogic, Estated) + a street-imagery provider (Google Street View Static API or Mapbox) to assemble the "Address found" screen. Show a brief loading state; populate facts; allow per-field correction.
- **"Something's off":** route to manual-edit of the facts grid.
- **Seed dashboard locked modules:** each is gated on a specific profile-completion action. Completing the action (add systems / log a project / upload photos / connect a trade) unlocks the corresponding full module and advances the progress bar. Wire each "unlock" CTA to the relevant add-detail sub-flow.
- **Buttons:** dark pills are primary; outline pills secondary; accent-on-accentSoft pills are "unlock/upgrade" affordances. Add hover (slight darken / lift) per the target design system.
- **Responsive:** the two-column entry shells should collapse to a single column (form first, image hidden or moved to top) under ~900px. The seed dashboard rail collapses to icons (the `collapsed` prop on `ProjectShell` already supports a 64px rail).

## State Management
- `address` (string), `selectedPlaceId`, `addressConfirmed` (bool).
- `homeFacts` object (year, sqft, beds, baths, lot, stories, lastSold, roof, heating) — seeded from the records API, each field user-editable.
- `imagery` (array of image URLs from street-view/aerial provider).
- `entrySource` enum: `hire-me` | `self-serve` — drives whether the "Marcus is ready / first project" card shows on the seed dashboard.
- `profileCompletion` derived from which detail-groups are filled; drives the progress bar and which modules are unlocked.
- Auth: email + password (or Google OAuth) — standard account creation; email-as-username (matches the rest of Smith's auth).

## Assets
- No bundled raster assets. All photography is placeholder gradients (`Photo`) — replace with real street-view/user imagery.
- Icons are inline SVG (Feather/Lucide-style) — map to the codebase's icon library.
- Fonts: Fraunces, Inter Tight, IBM Plex Mono (Google Fonts).

## Files in this bundle
- `preview.html` — open this to view all four screens stacked.
- `smith-homeowner-entry.jsx` — **the four flows** (`HireMeEntryB`, `HomeownerSignupB`, `AddressFoundB`, `SeedDashboardB`) plus `EntryShell`, `EntryInput`, `AddressField` helpers.
- `smith-shared.jsx` — `Icon`, `Avatar`, `Photo`, sample data.
- `smith-project-shell.jsx` — `ProjectShell` left-rail chrome (used by the seed dashboard).
- `smith-direction-b.jsx` — defines the `B` theme + `SmithLogoB` used throughout.
- `smith.css` — design tokens, fonts, photo-placeholder gradients.
