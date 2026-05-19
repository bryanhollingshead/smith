# Smith API — The Commandment

**The Smith API is forever-compatible. Old shapes never change.**

This is the constitutional rule for Smith's API design. It is not a guideline,
suggestion, or "we'll try." It's the rule that lets us avoid versioning
forever — and the moment we break it, we either pay a real cost or have to
introduce versioning to recover.

Smith chose this path deliberately: we will design carefully, document
thoroughly, and bake in flexibility from the start. Companies operating at
much larger scale (Stripe, Shopify, Square) have proven this works. The price
of admission is discipline.

---

## The rules

### 1. Fields are never renamed.

If a field is named `first_name` today, it is named `first_name` until the
heat death of the universe. If we ever invent a better name, we **add a new
field alongside the old one** and document the old name as legacy. The old
field continues to be populated forever.

### 2. Fields are never removed from responses.

If a feature gets retired, the corresponding fields stay in the response
as `null`, `false`, `[]`, or `0`. Clients that read the field keep working;
they just see "nothing happening."

### 3. Endpoints are never deleted or moved.

`/api/profiles/me` is `/api/profiles/me` forever. If we re-architect the
profile endpoint, the new version gets a **new URL** (e.g. `/api/me`,
`/api/profile-v2/me`, whatever fits). The old endpoint stays alive returning
sensible data.

### 4. Field types are never narrowed.

If a field is `string | null` today, it cannot become `string` (non-null)
tomorrow — that would break clients handling the null case. We can only
**widen** existing types (e.g. add new enum values, allow new optional
sub-fields).

### 5. Enum values can be added, never removed.

A new `post_type` value can join the family (`milestone`, `hiring`,
`project`, `photo`, …). Existing values stay valid forever. Clients should
treat unknown enum values gracefully — usually by ignoring or showing them
as raw text.

### 6. Required request fields can never be added.

A request that worked yesterday must work tomorrow. New input fields are
**always optional** with a sensible default. If we need a field to be
required for a new use case, we add a **new endpoint** with the stricter
contract.

### 7. HTTP status codes are stable per case.

If "unauthorized" returns 401 today, it returns 401 forever. If "not found"
returns 404 today, that's permanent. New conditions can use new codes;
existing conditions can't change codes.

### 8. When in doubt — add, don't change.

- Need new behavior? **New endpoint.**
- Need new data on a response? **New field.**
- Need to fix a typo in a field name? **Live with the typo.**
- Need to remove a field? **Set it to null/empty in responses; don't actually remove it.**

The cost of an ugly field name is nothing compared to the cost of a breaking
change.

---

## The escape hatch

There are real cases where we'd want to ship a breaking change. The
commandment permits it under one of these conditions:

1. **No real clients depend on the field.** We added something speculatively,
   the frontend never used it, no mobile app shipped — we can yank it before
   anyone notices. Burden of proof is on the dev proposing the change.

2. **A `Smith-Version` date is in place.** The plumbing for client-supplied
   versioning is shipped (see below). When we ship a true break, new behavior
   is gated to clients sending a `Smith-Version` header past the change date.
   Old clients keep the old behavior. This is the Stripe model — used as a
   last resort.

If neither — the change doesn't ship. Find another way.

---

## Plumbing in place

Even though we're not using it yet, the wiring is here:

- **`Smith-Version` header.** Frontend sends `Smith-Version: 2026-05-19` on
  every request (the date of that client build). Server reads it into
  `req.smithVersion`. Currently the server ignores it. If we ever need
  version-gated behavior, this becomes one if-statement in a route, not a
  cross-cutting retrofit.

- **OpenAPI spec.** `docs/api.yaml` is the source of truth for what every
  endpoint does. Every change to the API requires an update here. The
  Swagger UI at `/api/docs` makes it browsable.

- **API-shape smoke test.** `server/tests/api-shape.sh` hits a few key
  endpoints and asserts the response shape hasn't drifted. Catches accidental
  breaks during development.

---

## Practical workflow when adding/changing endpoints

When adding a **new** endpoint:
1. Write the route handler.
2. Add it to `docs/api.yaml`.
3. If response shape is non-trivial, add a smoke check to `api-shape.sh`.

When changing an **existing** endpoint:
1. Ask: am I breaking rules 1–7?
2. If yes, **stop**. Add a new endpoint instead. Or, very rarely, gate via
   `Smith-Version`.
3. If purely additive (new optional field, new endpoint, new enum value):
   update `docs/api.yaml`, ship.

When in doubt: ask before shipping.

---

## When this rule does NOT apply

- **Admin-only endpoints** (`/api/admin/*`) — used by Smith team only, no
  external clients. Can change freely.
- **Dev endpoints** (`/api/auth/dev/*`) — disabled in production, no external
  contract.
- **Internal helpers / database schema** — the *outside* shape of the API is
  what we promise. Internal refactors are unrestricted as long as the API
  surface stays stable.

---

This document is the architectural constitution for Smith's API. When you
bring in a new developer, this is the first thing they read.
