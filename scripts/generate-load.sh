#!/usr/bin/env bash
set -euo pipefail

KONG_URL=${KONG_URL:-http://localhost:8000}
API_KEY=${KONG_API_KEY:-${KONG_TEST_API_KEY:-test-key}}
SERVICE=${SERVICE:-checkout}
REQUESTS=${REQUESTS:-100}
CONCURRENCY=${CONCURRENCY:-5}

echo "Generating ${REQUESTS} requests to ${SERVICE} via Kong (concurrency=${CONCURRENCY})"

payload() {
  local status=$(( (RANDOM % 100) < 90 ? 200 : 500 ))
  local latency=$(( (RANDOM % 250) + 50 ))
  cat <<JSON
{ "type":"http_request", "service":"${SERVICE}", "status":${status}, "latency":${latency}, "timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)", "metadata":{ "env":"dev", "source":"loadgen" }, "ip":"127.0.0.1" }
JSON
}

run_one() {
  curl -sS -X POST "${KONG_URL}/api/v1/ingest" \
    -H "Content-Type: application/json" \
    -H "apikey: ${API_KEY}" \
    --data "$(payload)" > /dev/null || true
}

# Use background processes for parallel execution with job control
running=0
for i in $(seq 1 ${REQUESTS}); do
  # Wait if we've reached concurrency limit
  while [ $running -ge $CONCURRENCY ]; do
    wait -n 2>/dev/null || true
    running=$((running - 1))
  done
  
  # Start request in background
  run_one &
  running=$((running + 1))
done

# Wait for all remaining background processes
wait

echo "Done. Sent ${REQUESTS} requests with concurrency=${CONCURRENCY}"

