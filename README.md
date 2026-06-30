# Smith

Networking platform for construction workers and tradespeople — LinkedIn for the trades.

## Local dev — one command

```bash
npm run dev
```

Boots **both** services from the repo root:

| service | URL                       | port |
|---------|---------------------------|------|
| API     | http://localhost:4000     | 4000 |
| Web     | http://localhost:5173     | 5173 |

The dev script first verifies local Postgres at `localhost:5433`, then clears
anything still listening on 4000 / 5173 so the server and Vite always land on
their canonical ports (no Vite drift to 5174). Output from each service is
colored and labeled (`[server]` cyan / `[client]` magenta). Ctrl+C kills both.

**Local DB:** `postgres://smith:smith@localhost:5433/smith` — set in
`server/.env` (see `server/.env.example` for the shape).

**Demo accounts** seeded with password `framer-2024-mt`. Bryan's local dev
account: Marcus Whitfield (`marcus.whitfield@smith.test`).

### If Postgres is down

The script tells you. Pick one to start it:

```bash
brew services start postgresql@16
# or
pg_ctl -D /opt/homebrew/var/postgresql@16 start
# or
docker start smith-pg
```

### Stop dev cleanly

Ctrl+C in the dev terminal kills both. If anything ever sticks:

```bash
npm run dev:stop
```

### First-time install

```bash
npm run install:all   # installs root + server + client deps
npm run migrate       # applies server migrations (idempotent)
npm run seed          # populates 30 local users + trades catalog
npm run dev
```

## Stack

- **Server** — Node 20 + Express + PostgreSQL 16+
- **Client** — React 18 + Vite

## Other scripts

```bash
npm run migrate    # apply DB migrations
npm run seed       # seed dev data
npm run reset      # drop + migrate + seed (nukes local DB)
npm run build      # client production build
```
