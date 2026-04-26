#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

# Load .env to get KONG_TEST_API_KEY et al if present
if [ -f "$ROOT_DIR/.env" ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' "$ROOT_DIR/.env" | sed -E 's/\r$//' | xargs -0 -I{} echo {} 2>/dev/null || true)
fi

KONG_URL=${KONG_URL:-http://localhost:8000}
API_KEY=${KONG_API_KEY:-${KONG_TEST_API_KEY:-test-key}}
CORTEX_API=${CORTEX_API:-http://localhost:8080}
SERVICE=${SERVICE:-checkout}

echo "[1/5] Clearing Cortex metrics cache"
curl -sS -X DELETE "$CORTEX_API/api/v1/metrics/cache" > /dev/null || true

echo "[2/5] Sending warm-up events via Kong"
"$ROOT_DIR/scripts/send-kong-events.sh" || true

echo "[3/5] Generating load via Kong"
REQUESTS=${REQUESTS:-50} CONCURRENCY=${CONCURRENCY:-1} SERVICE="$SERVICE" "$ROOT_DIR/scripts/generate-load.sh"

echo "[4/5] Waiting for consumers and ClickHouse sinks (2s)"
sleep 2

echo "[5/5] Verifying metrics and ClickHouse health"
"$ROOT_DIR/tests/e2e/show-checks.sh"

echo "\nE2E run complete."




