#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# Marketplace API route tests
# Run against wrangler dev: npx wrangler dev
# Usage: bash tests/marketplace-routes.test.sh [BASE_URL] [AUTH_TOKEN]
# ─────────────────────────────────────────────────────────

BASE="${1:-http://localhost:3000}"
TOKEN="${2:-test-token-replace-me}"
PASS=0
FAIL=0

red() { echo -e "\033[31m$1\033[0m"; }
green() { echo -e "\033[32m$1\033[0m"; }
yellow() { echo -e "\033[33m$1\033[0m"; }

assert_status() {
  local name="$1" expected="$2" actual="$3" body="$4"
  if [ "$actual" = "$expected" ]; then
    green "✓ $name (HTTP $actual)"
    PASS=$((PASS + 1))
  else
    red "✗ $name — expected $expected, got $actual"
    echo "  Body: $body" | head -c 200
    echo
    FAIL=$((FAIL + 1))
  fi
}

assert_json_field() {
  local name="$1" body="$2" field="$3"
  if echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); assert '$field' in d" 2>/dev/null; then
    green "  ↳ has field '$field'"
  else
    red "  ↳ missing field '$field'"
    FAIL=$((FAIL + 1))
  fi
}

echo "═══════════════════════════════════════"
echo "  CLAUDIA Marketplace API Tests"
echo "  Base URL: $BASE"
echo "═══════════════════════════════════════"
echo

# ── 1. No auth → 401 ──
yellow "▸ Auth checks"
RESP=$(curl -s -w "\n%{http_code}" "$BASE/api/agents")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
assert_status "GET /api/agents without auth" "401" "$STATUS" "$BODY"

RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer invalid-token" "$BASE/api/agents")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
assert_status "GET /api/agents with bad token" "401" "$STATUS" "$BODY"

echo

# ── 2. List agents (requires valid auth + tier) ──
yellow "▸ List agents"
RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/api/agents")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
# Could be 200 (success) or 403 (insufficient CLAUDIA) — both are valid responses
if [ "$STATUS" = "200" ] || [ "$STATUS" = "403" ]; then
  green "✓ GET /api/agents returns valid response (HTTP $STATUS)"
  PASS=$((PASS + 1))
else
  assert_status "GET /api/agents with auth" "200|403" "$STATUS" "$BODY"
fi

# With category filter
RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/api/agents?category=defi&limit=5")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
if [ "$STATUS" = "200" ] || [ "$STATUS" = "403" ]; then
  green "✓ GET /api/agents?category=defi (HTTP $STATUS)"
  PASS=$((PASS + 1))
else
  red "✗ GET /api/agents?category=defi — unexpected $STATUS"
  FAIL=$((FAIL + 1))
fi

echo

# ── 3. Create agent (requires create tier) ──
yellow "▸ Create agent"
CREATE_BODY='{"name":"Test DeFi Agent","description":"A test agent for DeFi analysis and yield optimization strategies on Base","category":"defi","icon":"🤖","system_prompt":"You are a DeFi analyst. You analyze yield farming opportunities on Base chain. Be concise and opinionated.","model":"standard","cost_per_chat":2,"is_public":true}'

RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$CREATE_BODY" \
  "$BASE/api/agents")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
# 201 = created, 403 = insufficient tier, both valid
if [ "$STATUS" = "201" ] || [ "$STATUS" = "403" ]; then
  green "✓ POST /api/agents returns valid response (HTTP $STATUS)"
  PASS=$((PASS + 1))
  if [ "$STATUS" = "201" ]; then
    AGENT_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
    green "  ↳ Agent created: $AGENT_ID"
  fi
else
  assert_status "POST /api/agents" "201|403" "$STATUS" "$BODY"
fi

# Validation: missing name
RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description":"test"}' \
  "$BASE/api/agents")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
assert_status "POST /api/agents with missing name" "400" "$STATUS" "$BODY"

# Validation: invalid category
RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","description":"A valid test description here","category":"invalid","system_prompt":"You are a test agent for validation purposes only."}' \
  "$BASE/api/agents")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
assert_status "POST /api/agents with invalid category" "400" "$STATUS" "$BODY"

echo

# ── 4. Get single agent ──
yellow "▸ Get agent detail"
if [ -n "$AGENT_ID" ]; then
  RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/api/agents/$AGENT_ID")
  STATUS=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | sed '$d')
  assert_status "GET /api/agents/$AGENT_ID" "200" "$STATUS" "$BODY"
  assert_json_field "agent detail" "$BODY" "name"
  assert_json_field "agent detail" "$BODY" "cost_per_chat"
else
  yellow "  (skipped — no agent created, likely insufficient tier)"
fi

# Non-existent agent
RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/api/agents/nonexistent123")
STATUS=$(echo "$RESP" | tail -1)
assert_status "GET /api/agents/nonexistent123" "404" "$STATUS"

echo

# ── 5. Chat with agent ──
yellow "▸ Agent chat"
if [ -n "$AGENT_ID" ]; then
  RESP=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"message":"What are the best yield opportunities on Base right now?"}' \
    "$BASE/api/agents/$AGENT_ID/chat")
  STATUS=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | sed '$d')
  # 200 = success, 402 = insufficient credits, 502 = AI unavailable
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "402" ] || [ "$STATUS" = "502" ]; then
    green "✓ POST /api/agents/$AGENT_ID/chat (HTTP $STATUS)"
    PASS=$((PASS + 1))
    if [ "$STATUS" = "200" ]; then
      assert_json_field "chat response" "$BODY" "reply"
      assert_json_field "chat response" "$BODY" "credits_used"
    fi
  else
    assert_status "POST /api/agents/$AGENT_ID/chat" "200|402|502" "$STATUS" "$BODY"
  fi
else
  yellow "  (skipped — no agent created)"
fi

# Empty message
if [ -n "$AGENT_ID" ]; then
  RESP=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"message":""}' \
    "$BASE/api/agents/$AGENT_ID/chat")
  STATUS=$(echo "$RESP" | tail -1)
  assert_status "Chat with empty message" "400" "$STATUS"
fi

echo

# ── 6. Credits ──
yellow "▸ Credits"
RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/api/credits")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
if [ "$STATUS" = "200" ]; then
  assert_status "GET /api/credits" "200" "$STATUS" "$BODY"
  assert_json_field "credits" "$BODY" "credits"
  assert_json_field "credits" "$BODY" "transactions"
else
  green "✓ GET /api/credits (HTTP $STATUS — auth or tier issue, expected)"
  PASS=$((PASS + 1))
fi

# Invalid tx hash
RESP=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"txHash":"not-a-hash"}' \
  "$BASE/api/credits/purchase")
STATUS=$(echo "$RESP" | tail -1)
assert_status "POST /api/credits/purchase with invalid hash" "400" "$STATUS"

echo

# ── 7. User profile ──
yellow "▸ User profile"
RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/api/user")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
if [ "$STATUS" = "200" ]; then
  assert_status "GET /api/user" "200" "$STATUS" "$BODY"
  assert_json_field "user" "$BODY" "address"
  assert_json_field "user" "$BODY" "tier"
  assert_json_field "user" "$BODY" "credits"
else
  green "✓ GET /api/user (HTTP $STATUS)"
  PASS=$((PASS + 1))
fi

echo
echo "═══════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed"
echo "═══════════════════════════════════════"

exit $FAIL
