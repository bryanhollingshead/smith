#!/usr/bin/env bash
# Smith — Full demo journey
# Runs the server and exercises a brand-new user through:
#   sign up → verify email → onboard → suggestions → send connect → post → see in feed
# This is the literal flow the user said matters: profile, connection, post.
set -euo pipefail

SERVER_DIR="$(dirname "$0")/.."
cd "$SERVER_DIR"

node src/index.js > /tmp/api.log 2>&1 &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null || true" EXIT

# Wait for ready
for i in $(seq 1 20); do
  if curl -fs http://localhost:4000/api/health > /dev/null 2>&1; then break; fi
  sleep 0.2
done

API="http://localhost:4000/api"
ok() { printf "✓ %s\n" "$1"; }

# 1. Brand new user signs up
EMAIL="harriet$(date +%s)@smith.test"
TOKEN=$(curl -fs -X POST "$API/auth/signup" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"hardhat-2024-mt\",\"first_name\":\"Harriet\",\"last_name\":\"Stone\"}" \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["token"])')
AUTH="Authorization: Bearer $TOKEN"
ok "signed up as $EMAIL"

# 2. Verify email
CODE=$(curl -fs "$API/auth/dev/last-email?email=$EMAIL&kind=verification" \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["meta"]["code"])')
curl -fs -X POST "$API/auth/verify-email" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"code\":\"$CODE\"}" > /dev/null
ok "verified email (code=$CODE)"

# 3. Onboarding — pick trade, fill in profile bits
curl -fs -X POST "$API/profiles/me/trades" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"trades":[{"name":"Stonemasonry","years":3}]}' > /dev/null
curl -fs -X PATCH "$API/profiles/me" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"onboarding_done":true,"headline":"Stonemason · Apprentice","location":"Bozeman, MT","avatar_tone":"slate"}' \
  > /dev/null
ok "onboarded — trade + headline + location set"

# Quick profile readback
curl -fs "$API/profiles/me" -H "$AUTH" | python3 -c '
import json, sys
p = json.load(sys.stdin)["profile"]
assert p["name"] == "Harriet Stone", p["name"]
assert p["headline"].startswith("Stonemason"), p["headline"]
assert p["onboarding"]["done"] is True, p["onboarding"]
assert any(t["name"] == "Stonemasonry" for t in p["trades"]), p["trades"]
'
ok "profile reads back correctly"

# 4. Suggestions should populate (Bozeman strangers, since Harriet has no
#    connections yet but lives in Bozeman). Falls back to same-location.
SUG_COUNT=$(curl -fs "$API/connections/suggestions?limit=10" -H "$AUTH" \
  | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["suggestions"]))')
[ "$SUG_COUNT" -gt 0 ] || { echo "no suggestions"; exit 1; }
ok "got $SUG_COUNT suggestions"

# 5. Send a connection request
SUG_ID=$(curl -fs "$API/connections/suggestions?limit=1" -H "$AUTH" \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["suggestions"][0]["id"])')
curl -fs -X POST "$API/connections/request" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"target_id\":$SUG_ID}" > /dev/null
ok "sent connection request to user $SUG_ID"

# 6. Post to feed
POST_ID=$(curl -fs -X POST "$API/posts" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"type":"project","body":"First day on a new dry-stone wall up at Sweetgrass. The stone tells you where it wants to go.","photos":["brick","steel"],"project_name":"Sweetgrass dry-stone"}' \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["post"]["id"])')
ok "posted (id=$POST_ID)"

# 7. Recipient verifies pending request shows up
RECV_EMAIL=$(PGPASSWORD=smith psql -h localhost -U smith -d smith -tAc "SELECT email FROM users WHERE id=$SUG_ID")
RT=$(curl -fs -X POST "$API/auth/signin" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$RECV_EMAIL\",\"password\":\"framer-2024-mt\"}" \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["token"])')
PENDING=$(curl -fs "$API/connections/pending" -H "Authorization: Bearer $RT" \
  | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["pending"]))')
[ "$PENDING" -gt 0 ] || { echo "no pending"; exit 1; }
ok "recipient $RECV_EMAIL sees $PENDING pending request"

# 8. Recipient accepts
PENDING_CONN_ID=$(curl -fs "$API/connections/pending" -H "Authorization: Bearer $RT" \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["pending"][0]["connection_id"])')
curl -fs -X POST "$API/connections/$PENDING_CONN_ID/accept" -H "Authorization: Bearer $RT" > /dev/null
ok "recipient accepted"

# 9. Now Harriet should have 1 connection + the post should appear in network feed
CONN_COUNT=$(curl -fs "$API/connections" -H "$AUTH" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["connections"]))')
[ "$CONN_COUNT" -ge 1 ] || { echo "no accepted connections"; exit 1; }
ok "Harriet has $CONN_COUNT connection"

export POST_ID
curl -fs "$API/posts/feed?scope=network" -H "$AUTH" | python3 -c '
import json, sys, os
pid = int(os.environ["POST_ID"])
posts = json.load(sys.stdin)["posts"]
mine = [p for p in posts if p["id"] == pid]
if not mine: sys.exit("post not in network feed")
p = mine[0]
assert p["author"]["name"] == "Harriet Stone", p["author"]
'
ok "post visible in network feed"

# 10. Now signs out + back in cleanly
curl -fs -X POST "$API/auth/signin" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"hardhat-2024-mt\"}" \
  | python3 -c 'import json,sys; assert json.load(sys.stdin)["user"]["onboarding_done"] is True'
ok "sign-out + sign-in roundtrip — onboarding still done"

echo ""
echo "🎉  Full demo journey: profile → connect → post — works end-to-end."
