#!/usr/bin/env bash
set -euo pipefail

CORTEX_API=${CORTEX_API:-http://localhost:8080}
SERVICE=${SERVICE:-checkout}

echo "-- Cortex service metrics ($SERVICE) --"
curl -sS "$CORTEX_API/api/v1/metrics/service/$SERVICE" | jq . || true

echo "\n-- Cortex active services --"
curl -sS "$CORTEX_API/api/v1/metrics/services" | jq . || true

echo "\n-- Kong proxy check --"
curl -sS -I http://localhost:8000 | head -n 1 || true


