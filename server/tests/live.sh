#!/usr/bin/env bash
# Smith — Live integration smoke
# Spins up the API + Vite dev server, hits the API both directly and through
# the Vite proxy (the same path the browser uses in dev), confirms the static
# index.html is served by Vite, then tears it all down.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# API
( cd server && node src/index.js > /tmp/api.log 2>&1 ) &
API_PID=$!
# Vite dev
( cd client && node_modules/.bin/vite --port 5173 --host 127.0.0.1 > /tmp/vite.log 2>&1 ) &
VITE_PID=$!
trap "kill $API_PID $VITE_PID 2>/dev/null || true" EXIT

# Wait for both
for i in $(seq 1 40); do
  if curl -fs http://localhost:4000/api/health > /dev/null 2>&1 \
     && curl -fs http://localhost:5173/ > /dev/null 2>&1; then break; fi
  sleep 0.25
done

ok() { printf "✓ %s\n" "$1"; }

# 1. Vite serves the SPA
HTML=$(curl -fs http://localhost:5173/)
echo "$HTML" | grep -q '<div id="root">' && ok "Vite serves index.html with root"
echo "$HTML" | grep -q '/src/main.jsx'    && ok "main.jsx referenced"
echo "$HTML" | grep -q 'fonts.googleapis' && ok "Google Fonts preloaded"

# 2. /api proxy reaches the API
curl -fs http://localhost:5173/api/health | python3 -c 'import json,sys; assert json.load(sys.stdin)["ok"] is True'
ok "Vite /api proxy → backend health"

# 3. Auth flow through the proxy
TOKEN=$(curl -fs -X POST http://localhost:5173/api/auth/signin \
  -H 'Content-Type: application/json' \
  -d '{"email":"marcus.whitfield@smith.test","password":"framer-2024-mt"}' \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["token"])')
[ -n "$TOKEN" ] && ok "signin via proxy"

# 4. Profile through proxy
curl -fs http://localhost:5173/api/profiles/me -H "Authorization: Bearer $TOKEN" \
  | python3 -c 'import json,sys; p=json.load(sys.stdin)["profile"]; assert p["name"]=="Marcus Whitfield"'
ok "profile via proxy"

# 5. Build artifacts exist
[ -f client/dist/index.html ] && ok "production build artifact present"

echo ""
echo "🎉  Live integration: backend + Vite dev + proxy all healthy."
