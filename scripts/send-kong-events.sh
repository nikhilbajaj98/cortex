#!/usr/bin/env bash
set -euo pipefail

KONG_URL=${KONG_URL:-http://localhost:8000}
API_KEY=${KONG_API_KEY:-${KONG_TEST_API_KEY:-test-key}}

echo "Sending sample events via Kong proxy at ${KONG_URL} with apikey=${API_KEY}"

payload() {
  local svc=$1
  local status=$2
  local latency=$3
  cat <<JSON
{
  "type": "http_request",
  "service": "${svc}",
  "status": ${status},
  "latency": ${latency},
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "metadata": { "env": "dev", "source": "manual" },
  "ip": "127.0.0.1"
}
JSON
}

curl -sS -i -X POST "${KONG_URL}/api/v1/ingest" \
  -H "Content-Type: application/json" \
  -H "apikey: ${API_KEY}" \
  --data "$(payload checkout 200 120)"

curl -sS -i -X POST "${KONG_URL}/api/v1/ingest" \
  -H "Content-Type: application/json" \
  -H "apikey: ${API_KEY}" \
  --data "$(payload checkout 500 420)"

curl -sS -i -X POST "${KONG_URL}/api/v1/ingest" \
  -H "Content-Type: application/json" \
  -H "apikey: ${API_KEY}" \
  --data "$(payload payments 200 80)"

echo "\nDone. Check analytics and storage consumers."





