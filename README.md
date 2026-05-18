# Smith

Networking platform for construction workers and tradespeople — LinkedIn for the trades.

## Stack

- **Server** — Node 20 + Express + PostgreSQL 16+
- **Client** — React 18 + Vite

## Local setup

```bash
# Postgres (one-time)
createuser -s smith
createdb -O smith smith

# Server
cd server
cp .env.example .env   # then edit DATABASE_URL if needed
npm install
npm run reset          # migrate + seed
npm run dev            # http://localhost:4000

# Client (new terminal)
cd client
npm install
npm run dev            # http://localhost:5173
```

Demo accounts seeded with password `framer-2024-mt`.