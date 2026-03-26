#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# Credit Purchase Route Tests
# Run against wrangler dev (staging D1):
#   cd claudia-app && npx wrangler dev
#   bash tests/test-credit-purchase.sh http://localhost:3000 <AUTH_TOKEN>
#
# AUTH_TOKEN: get by authenticating via the app's SIWE flow
# ─────────────────────────────────────────────────────────

BASE="${1:-http://localhost:3000}"
TOKEN="${2:-test-token-replace-me}"

# Real tx hash from the first mainnet purchase (2026-03-25)
REAL_TX="0x7565bb899780dc4d93727612a4ffff236e088d0addf62f77865adb4712440ccc"

red() { echo -e "\033[31m$1\033[0m"; }
green() { echo -e "\033[32m$1\033[0m"; }
yellow() { echo -e "\033[33m$1\033[0m"; }

PASS=0
FAIL=0

assert_status() {
  local name="$1" expected="$2" actual="$3" body="$4"
  if [ "$actual" = "$expected" ]; then
    green "✓ $name (HTTP $actual)"
    PASS=$((PASS + 1))
  else
    red "✗ $name — expected $expected, got $actual"
    echo "  Body: $(echo $body | head -c 200)"
    FAIL=$((FAIL + 1))
  fi
}

echo "═══════════════════════════════════════"
echo "  Credit Purchase Route Tests"
echo "  Base URL: $BASE"
echo "═══════════════════════════════════════"
echo

# ── 1. No auth → 401 ──
yellow "▸ Auth checks"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/credits/purchase" \
  -H "Content-Type: application/json" \
  -d '{"txHash":"0x1234"}')
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
assert_status "POST without auth" "401" "$STATUS" "$BODY"
echo

# ── 2. Invalid tx hash format ──
yellow "▸ Validation"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/credits/purchase" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"txHash":"not-a-hash"}')
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
assert_status "Invalid tx hash format" "400" "$STATUS" "$BODY"

# Valid format but nonexistent tx
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/credits/purchase" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"txHash":"0x0000000000000000000000000000000000000000000000000000000000000001"}')
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
assert_status "Nonexistent tx hash" "404" "$STATUS" "$BODY"

# Empty body
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/credits/purchase" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
assert_status "Missing txHash field" "400" "$STATUS" "$BODY"
echo

# ── 3. Real tx hash (first purchase) ──
yellow "▸ Real transaction verification"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/credits/purchase" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"txHash\":\"$REAL_TX\"}")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
echo "  Response: $BODY"

# Could be 200 (credits issued), 403 (wallet mismatch), or 409 (already processed)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "403" ] || [ "$STATUS" = "409" ]; then
  green "✓ Real tx hash returns valid response (HTTP $STATUS)"
  PASS=$((PASS + 1))

  if [ "$STATUS" = "200" ]; then
    echo "  Credits issued! Checking balance..."
    BAL=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/credits")
    echo "  Balance: $BAL"
  fi
else
  assert_status "Real tx hash" "200|403|409" "$STATUS" "$BODY"
fi
echo

# ── 4. Idempotency: same tx hash again ──
yellow "▸ Idempotency check"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/credits/purchase" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"txHash\":\"$REAL_TX\"}")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')

# Should be 409 (already processed) or 403 (wallet mismatch)
if [ "$STATUS" = "409" ] || [ "$STATUS" = "403" ]; then
  green "✓ Duplicate tx rejected (HTTP $STATUS)"
  PASS=$((PASS + 1))
else
  assert_status "Duplicate tx rejection" "409" "$STATUS" "$BODY"
fi
echo

# ── 5. Credit balance ──
yellow "▸ Balance check"
RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/api/credits")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
if [ "$STATUS" = "200" ]; then
  green "✓ GET /api/credits (HTTP $STATUS)"
  echo "  $BODY"
  PASS=$((PASS + 1))
else
  assert_status "GET /api/credits" "200" "$STATUS" "$BODY"
fi

echo
echo "═══════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed"
echo "═══════════════════════════════════════"

exit $FAIL
