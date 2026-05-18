#!/usr/bin/env bash
# Smoke test: starts the server, runs a fistful of curls against it, kills it.
set -euo pipefail

SERVER_DIR="$(dirname "$0")/.."
cd "$SERVER_DIR"

# Start
node src/index.js > /tmp/smith-server.log 2>&1 &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null || true" EXIT

# Wait for ready
for i in $(seq 1 20); do
  if curl -fs http://localhost:4000/api/health > /dev/null 2>&1; then break; fi
  sleep 0.2
done
curl -fs http://localhost:4000/api/health > /dev/null

API="http://localhost:4000/api"
ok() { printf "✓ %s\n" "$1"; }
fail() { printf "✗ %s\n   %s\n" "$1" "${2:-}" >&2; exit 1; }

# 1. Signin
RESP=$(curl -s -X POST "$API/auth/signin" -H 'Content-Type: application/json' \
  -d '{"email":"marcus.whitfield@smith.test","password":"framer-2024-mt"}')
TOKEN=$(echo "$RESP" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("token",""))')
[ -n "$TOKEN" ] || fail "signin" "$RESP"
ok "signin"

AUTH="Authorization: Bearer $TOKEN"

# 2. Whoami
curl -fs "$API/auth/me" -H "$AUTH" | python3 -c 'import json,sys; assert json.load(sys.stdin)["user"]["email"]=="marcus.whitfield@smith.test"' && ok "auth/me"

# 3. Full profile
curl -fs "$API/profiles/me" -H "$AUTH" | python3 -c '
import json,sys
p = json.load(sys.stdin)["profile"]
assert p["name"] == "Marcus Whitfield", p["name"]
assert len(p["trades"]) == 4, p["trades"]
assert len(p["licenses"]) == 3, p["licenses"]
assert len(p["work_history"]) == 3, len(p["work_history"])
assert sum(len(w["jobsites"]) for w in p["work_history"]) == 6, "total jobsites"
assert p["network_size"] >= 8, p["network_size"]
assert p["union"]["name"] == "Local 82 — Carpenters", p["union"]
' && ok "profiles/me"

# 4. Feed
curl -fs "$API/posts/feed" -H "$AUTH" | python3 -c '
import json,sys
d = json.load(sys.stdin)
assert len(d["posts"]) >= 4, len(d["posts"])
types = {p["type"] for p in d["posts"]}
assert "project" in types and "hiring" in types and "milestone" in types, types
' && ok "posts/feed"

# 5. Connections
curl -fs "$API/connections" -H "$AUTH" | python3 -c '
import json,sys
c = json.load(sys.stdin)["connections"]
assert len(c) >= 8, len(c)
assert "mutual" in c[0]
' && ok "connections"

# 6. Pending
curl -fs "$API/connections/pending" -H "$AUTH" | python3 -c '
import json,sys
p = json.load(sys.stdin)["pending"]
assert len(p) == 2, len(p)
' && ok "connections/pending"

# 7. Suggestions
curl -fs "$API/connections/suggestions" -H "$AUTH" | python3 -c '
import json,sys
s = json.load(sys.stdin)["suggestions"]
assert len(s) >= 1, len(s)
' && ok "connections/suggestions"

# 8. Search
curl -fs "$API/search?q=Tasha" -H "$AUTH" | python3 -c '
import json,sys
d = json.load(sys.stdin)
assert any("Tasha" in (u["first_name"] + " " + u["last_name"]) for u in d["users"]), d
' && ok "search"

# 9. Trades catalog
curl -fs "$API/trades" | python3 -c '
import json,sys
t = json.load(sys.stdin)["trades"]
assert any(x["name"] == "Carpentry" for x in t), t[:3]
' && ok "trades catalog"

# 10. Create a post, then like it, then comment
POST=$(curl -fs -X POST "$API/posts" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"type":"project","body":"Cabinets installed in the master bath. Walnut grain matched across all 4 doors.","photos":["kitchen","wood"],"project_name":"Sweetgrass Residence"}')
POST_ID=$(echo "$POST" | python3 -c 'import json,sys; print(json.load(sys.stdin)["post"]["id"])')
[ -n "$POST_ID" ] || fail "create post" "$POST"
ok "create post (id=$POST_ID)"

# Sign in as Diane and like it
DIANE_TOKEN=$(curl -fs -X POST "$API/auth/signin" -H 'Content-Type: application/json' \
  -d '{"email":"diane.okafor@smith.test","password":"framer-2024-mt"}' | python3 -c 'import json,sys;print(json.load(sys.stdin)["token"])')
LIKE=$(curl -fs -X POST "$API/posts/$POST_ID/like" -H "Authorization: Bearer $DIANE_TOKEN")
echo "$LIKE" | python3 -c 'import json,sys; assert json.load(sys.stdin)["liked"]==True'
ok "like post"

curl -fs -X POST "$API/posts/$POST_ID/comments" -H "Authorization: Bearer $DIANE_TOKEN" \
  -H 'Content-Type: application/json' -d '{"body":"Beautiful work."}' > /dev/null
ok "comment post"

# Verify counts now reflect like + comment
export POST_ID
curl -fs "$API/posts/feed" -H "$AUTH" \
  | python3 "$(dirname "$0")/_assert_feed.py"
ok "feed reflects like+comment"

# 11. Signup → verify email flow (mock email outbox)
NEW_EMAIL="testuser$(date +%s)@smith.test"
SIGN=$(curl -fs -X POST "$API/auth/signup" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$NEW_EMAIL\",\"password\":\"strong-password-1\",\"first_name\":\"Test\",\"last_name\":\"User\"}")
NEW_TOKEN=$(echo "$SIGN" | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')
ok "signup"

CODE=$(curl -fs "$API/auth/dev/last-email?email=$NEW_EMAIL&kind=verification" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["meta"]["code"])')
[ -n "$CODE" ] || fail "verification email"
ok "verification email written (code=$CODE)"

curl -fs -X POST "$API/auth/verify-email" -H "Authorization: Bearer $NEW_TOKEN" \
  -H 'Content-Type: application/json' -d "{\"code\":\"$CODE\"}" > /dev/null
ok "verify-email"

# 12. Forgot → reset
curl -fs -X POST "$API/auth/forgot" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$NEW_EMAIL\"}" > /dev/null
RESET_TOKEN=$(curl -fs "$API/auth/dev/last-email?email=$NEW_EMAIL&kind=reset" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["meta"]["token"])')
[ -n "$RESET_TOKEN" ] || fail "reset email"
ok "forgot-password email"

curl -fs -X POST "$API/auth/reset" -H 'Content-Type: application/json' \
  -d "{\"token\":\"$RESET_TOKEN\",\"password\":\"new-strong-password-2\"}" > /dev/null
ok "reset-password"

curl -fs -X POST "$API/auth/signin" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$NEW_EMAIL\",\"password\":\"new-strong-password-2\"}" \
  | python3 -c 'import json,sys; assert "token" in json.load(sys.stdin)' \
  && ok "signin with new password"

echo ""
echo "🎉  All smoke tests passed."
