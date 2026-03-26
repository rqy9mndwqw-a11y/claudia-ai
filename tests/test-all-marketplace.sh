#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# Complete Marketplace API Test Suite
# Run against wrangler dev (staging D1):
#   cd claudia-app && npx wrangler dev
#   bash tests/test-all-marketplace.sh http://localhost:3000 <AUTH_TOKEN>
# ─────────────────────────────────────────────────────────

BASE="${1:-http://localhost:3000}"
TOKEN="${2:-test-token-replace-me}"
PASS=0
FAIL=0

red() { echo -e "\033[31m$1\033[0m"; }
green() { echo -e "\033[32m$1\033[0m"; }
yellow() { echo -e "\033[33m$1\033[0m"; }
bold() { echo -e "\033[1m$1\033[0m"; }

assert_status() {
  local name="$1" expected="$2" actual="$3" body="$4"
  if echo "$expected" | grep -q "$actual"; then
    green "  ✓ $name (HTTP $actual)"
    PASS=$((PASS + 1))
  else
    red "  ✗ $name — expected $expected, got $actual"
    echo "    Body: $(echo $body | head -c 300)"
    FAIL=$((FAIL + 1))
  fi
}

# Helper: make request and capture status + body
req() {
  local method="$1" path="$2" data="$3"
  if [ "$method" = "GET" ]; then
    curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE$path"
  else
    curl -s -w "\n%{http_code}" -X "$method" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data" "$BASE$path"
  fi
}

split_response() {
  STATUS=$(echo "$1" | tail -1)
  BODY=$(echo "$1" | sed '$d')
}

echo "════════════════════════════════════════════"
bold "  CLAUDIA Marketplace — Full API Test Suite"
echo "  Base: $BASE"
echo "════════════════════════════════════════════"

# ══════════════════════════════════════════
bold "\n▸ 1. GET /api/credits (balance)"
# ══════════════════════════════════════════

# No auth
split_response "$(curl -s -w "\n%{http_code}" "$BASE/api/credits")"
assert_status "No auth → 401" "401" "$STATUS" "$BODY"

# With auth
split_response "$(req GET /api/credits)"
assert_status "Authenticated balance check" "200|403" "$STATUS" "$BODY"
if [ "$STATUS" = "200" ]; then
  echo "    Credits: $(echo $BODY | python3 -c "import sys,json; print(json.load(sys.stdin).get('credits','?'))" 2>/dev/null)"
  echo "    Tier: $(echo $BODY | python3 -c "import sys,json; print(json.load(sys.stdin).get('tier','?'))" 2>/dev/null)"
fi

# ══════════════════════════════════════════
bold "\n▸ 2. GET /api/agents (list)"
# ══════════════════════════════════════════

# No auth
split_response "$(curl -s -w "\n%{http_code}" "$BASE/api/agents")"
assert_status "No auth → 401" "401" "$STATUS" "$BODY"

# With auth
split_response "$(req GET /api/agents)"
assert_status "List agents" "200|403" "$STATUS" "$BODY"
if [ "$STATUS" = "200" ]; then
  COUNT=$(echo $BODY | python3 -c "import sys,json; print(json.load(sys.stdin).get('count','?'))" 2>/dev/null)
  echo "    Agents found: $COUNT"
fi

# With category filter
split_response "$(req GET "/api/agents?category=defi&limit=5")"
assert_status "Filter by category" "200|403" "$STATUS" "$BODY"

# With search
split_response "$(req GET "/api/agents?search=test")"
assert_status "Search agents" "200|403" "$STATUS" "$BODY"

# Verify system_prompt is NOT in response
if [ "$STATUS" = "200" ]; then
  if echo "$BODY" | grep -q "system_prompt"; then
    red "  ✗ SECURITY: system_prompt leaked in public listing!"
    FAIL=$((FAIL + 1))
  else
    green "  ✓ system_prompt not exposed in listing"
    PASS=$((PASS + 1))
  fi
fi

# ══════════════════════════════════════════
bold "\n▸ 3. POST /api/agents (create)"
# ══════════════════════════════════════════

# Missing fields
split_response "$(req POST /api/agents '{}')"
assert_status "Missing fields → 400" "400" "$STATUS" "$BODY"

# Invalid category
split_response "$(req POST /api/agents '{"name":"Test","description":"A valid description here for testing","category":"INVALID","system_prompt":"You are a test agent with enough chars here."}')"
assert_status "Invalid category → 400" "400" "$STATUS" "$BODY"

# Short system prompt
split_response "$(req POST /api/agents '{"name":"Test","description":"A valid description here for testing","category":"defi","system_prompt":"too short"}')"
assert_status "Short system_prompt → 400" "400" "$STATUS" "$BODY"

# Valid creation (may fail with 403 if insufficient tier)
AGENT_BODY='{"name":"Test DeFi Scanner","description":"Scans DeFi protocols on Base for yield opportunities and risk analysis","category":"defi","icon":"🔍","system_prompt":"You are a DeFi protocol analyst. You scan yield farming opportunities on Base chain. Be direct, opinionated, and data-driven. Never give financial advice as guaranteed returns.","model":"standard","cost_per_chat":2,"is_public":true}'
split_response "$(req POST /api/agents "$AGENT_BODY")"
assert_status "Create agent" "201|403" "$STATUS" "$BODY"

AGENT_ID=""
if [ "$STATUS" = "201" ]; then
  AGENT_ID=$(echo $BODY | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
  green "    Agent created: $AGENT_ID"
fi

# ══════════════════════════════════════════
bold "\n▸ 4. GET /api/agents/:id (detail)"
# ══════════════════════════════════════════

if [ -n "$AGENT_ID" ]; then
  split_response "$(req GET /api/agents/$AGENT_ID)"
  assert_status "Get agent detail" "200" "$STATUS" "$BODY"

  # Creator should see system_prompt
  if echo "$BODY" | grep -q "system_prompt"; then
    green "  ✓ Creator can see own system_prompt"
    PASS=$((PASS + 1))
  else
    red "  ✗ Creator should see own system_prompt"
    FAIL=$((FAIL + 1))
  fi
else
  yellow "  (skipped — no agent created)"
fi

# Nonexistent agent
split_response "$(req GET /api/agents/nonexistent_id_123)"
assert_status "Nonexistent agent → 404" "404" "$STATUS" "$BODY"

# ══════════════════════════════════════════
bold "\n▸ 5. POST /api/agents/:id/chat"
# ══════════════════════════════════════════

if [ -n "$AGENT_ID" ]; then
  # Empty message
  split_response "$(req POST /api/agents/$AGENT_ID/chat '{"message":""}')"
  assert_status "Empty message → 400" "400" "$STATUS" "$BODY"

  # Message too long (generate 2500 char string)
  LONG_MSG=$(python3 -c "print('a' * 2500)" 2>/dev/null || echo "aaaaaaaaaaaa")
  split_response "$(req POST /api/agents/$AGENT_ID/chat "{\"message\":\"$LONG_MSG\"}")"
  assert_status "Message too long → 400" "400" "$STATUS" "$BODY"

  # Valid chat (may 402 if no credits, 502 if AI unavailable)
  split_response "$(req POST /api/agents/$AGENT_ID/chat '{"message":"What are the best yield opportunities on Base right now?"}')"
  assert_status "Chat with agent" "200|402|502" "$STATUS" "$BODY"

  if [ "$STATUS" = "200" ]; then
    echo "    Reply: $(echo $BODY | python3 -c "import sys,json; r=json.load(sys.stdin); print(r.get('reply','')[:100]+'...')" 2>/dev/null)"
    echo "    Credits used: $(echo $BODY | python3 -c "import sys,json; print(json.load(sys.stdin).get('credits_used','?'))" 2>/dev/null)"
    echo "    Model: $(echo $BODY | python3 -c "import sys,json; print(json.load(sys.stdin).get('model','?'))" 2>/dev/null)"
  fi

  # Chat with nonexistent agent
  split_response "$(req POST /api/agents/fake_agent_123/chat '{"message":"hello"}')"
  assert_status "Chat nonexistent agent → 404" "404" "$STATUS" "$BODY"
else
  yellow "  (skipped — no agent created)"
fi

# ══════════════════════════════════════════
bold "\n▸ 6. POST /api/credits/purchase"
# ══════════════════════════════════════════

# Invalid hash format
split_response "$(req POST /api/credits/purchase '{"txHash":"not-a-hash"}')"
assert_status "Invalid tx format → 400" "400" "$STATUS" "$BODY"

# Missing txHash
split_response "$(req POST /api/credits/purchase '{}')"
assert_status "Missing txHash → 400" "400" "$STATUS" "$BODY"

# Nonexistent tx
split_response "$(req POST /api/credits/purchase '{"txHash":"0x0000000000000000000000000000000000000000000000000000000000000001"}')"
assert_status "Nonexistent tx → 404" "404" "$STATUS" "$BODY"

# Real tx (from first mainnet purchase) — will 403 if wallet mismatch, 409 if already processed
REAL_TX="0x7565bb899780dc4d93727612a4ffff236e088d0addf62f77865adb4712440ccc"
split_response "$(req POST /api/credits/purchase "{\"txHash\":\"$REAL_TX\"}")"
assert_status "Real tx hash" "200|403|409|425" "$STATUS" "$BODY"

# Idempotency: same tx again (should 409 or 403)
split_response "$(req POST /api/credits/purchase "{\"txHash\":\"$REAL_TX\"}")"
assert_status "Duplicate tx → 409 or 403" "409|403" "$STATUS" "$BODY"

# ══════════════════════════════════════════
bold "\n▸ 7. GET /api/user (profile)"
# ══════════════════════════════════════════

split_response "$(req GET /api/user)"
assert_status "User profile" "200" "$STATUS" "$BODY"
if [ "$STATUS" = "200" ]; then
  echo "    $(echo $BODY | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"Address: {d.get('address','?')}  Tier: {d.get('tier','?')}  Credits: {d.get('credits','?')}  Agents: {d.get('agents_created','?')}\")" 2>/dev/null)"
fi

# ══════════════════════════════════════════
echo ""
echo "════════════════════════════════════════════"
if [ $FAIL -eq 0 ]; then
  green "  ALL PASSED: $PASS tests"
else
  red "  $PASS passed, $FAIL FAILED"
fi
echo "════════════════════════════════════════════"

exit $FAIL
