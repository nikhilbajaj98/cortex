#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

KONG_PROXY="http://localhost:8000"
ADMIN_API="http://localhost:8001"
CORTEX_API="http://localhost:8080"
API_KEY="${KONG_TEST_API_KEY:-test-key}"

SERVICE_NAME="checkout"

function log() { echo -e "[E2E] $*"; }

wait_for_port() {
  local host_port="$1"
  local name="$2"
  local timeout="${3:-60}"
  local start_ts=$(date +%s)
  while true; do
    if nc -z $(echo "$host_port" | cut -d: -f1) $(echo "$host_port" | cut -d: -f2) 2>/dev/null; then
      log "✅ $name available on $host_port"
      break
    fi
    sleep 1
    if (( $(date +%s) - start_ts > timeout )); then
      log "❌ Timeout waiting for $name on $host_port"
      exit 1
    fi
  done
}

log "Checking required services (Kong, Cortex, ClickHouse)"
wait_for_port localhost:8000 "Kong Proxy"
wait_for_port localhost:8001 "Kong Admin"
wait_for_port localhost:8080 "Cortex API"
wait_for_port localhost:8123 "ClickHouse HTTP"

log "Verifying Kong Admin API response"
curl -fsS "$ADMIN_API/" >/dev/null || { log "❌ Kong Admin not responding"; exit 1; }

log "Verifying ClickHouse health via Cortex API"
curl -fsS "$CORTEX_API/api/v1/metrics/health/clickhouse" | jq . >/dev/null || true

log "Verifying ML service health (Phase 3)"
curl -fsS "http://localhost:7001/health" | jq . >/dev/null || { log "❌ ML service not responding"; exit 1; }

log "Sending a test event through Kong proxy -> Cortex ingest"
EVENT_PAYLOAD=$(cat <<JSON
{
  "type": "http_request",
  "service": "${SERVICE_NAME}",
  "status": 200,
  "latency": 42,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "metadata": {
    "path": "/checkout",
    "method": "POST",
    "requestId": "e2e-$(uuidgen || echo $RANDOM)",
    "region": "us-east-1",
    "env": "dev",
    "source": "direct"
  }
}
JSON
)

curl -fsS -X POST \
  -H "Content-Type: application/json" \
  -H "apikey: ${API_KEY}" \
  -d "$EVENT_PAYLOAD" \
  "$KONG_PROXY/api/v1/ingest" >/dev/null || { log "❌ Ingest via Kong failed"; exit 1; }

log "Sent one event. Waiting for consumers to process..."
sleep 2

log "Querying per-service metrics from Cortex API"
# ClickHouse rollups + consumers are async; retry briefly.
for i in {1..12}; do
  METRICS_JSON=$(curl -sS "$CORTEX_API/api/v1/metrics/service/${SERVICE_NAME}" || true)
  if echo "$METRICS_JSON" | jq -e '.metrics.totalRequests' >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "$METRICS_JSON" | jq . >/dev/null || { log "❌ Metrics JSON invalid"; exit 1; }

TOTAL_REQ=$(echo "$METRICS_JSON" | jq -r '.metrics.totalRequests // 0')
if [[ "$TOTAL_REQ" -lt 1 ]]; then
  log "❌ Expected totalRequests >= 1, got $TOTAL_REQ"
  exit 1
fi

log "✅ Metrics show totalRequests=$TOTAL_REQ for service=${SERVICE_NAME}"

log "Querying time-series (last 1 hour)"
START_TS=$(date -u -v-60M +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)
END_TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
curl -fsS "$CORTEX_API/api/v1/metrics/service/${SERVICE_NAME}/timeseries?startTime=$START_TS&endTime=$END_TS&granularity=5m" | jq . >/dev/null || true

log "Querying control plane decisions (dry-run)"
DECISIONS_JSON=$(curl -fsS "$CORTEX_API/api/v1/demo/control-plane/decisions?timeWindow=5m") || { log "❌ Control plane decisions API failed"; exit 1; }
echo "$DECISIONS_JSON" | jq . >/dev/null || { log "❌ Decisions JSON invalid"; exit 1; }
TOTAL_DECISIONS=$(echo "$DECISIONS_JSON" | jq -r '.data | length')
if [[ "$TOTAL_DECISIONS" -lt 1 ]]; then
  log "❌ Expected at least 1 decision, got $TOTAL_DECISIONS"
  exit 1
fi
log "✅ Control plane decisions returned count=$TOTAL_DECISIONS"

log "Querying control plane decisions via non-demo API"
# Decision loop is async; retry briefly until store is populated.
for i in {1..10}; do
  CP_JSON=$(curl -fsS -H "apikey: ${API_KEY}" "$KONG_PROXY/api/v1/control-plane/decisions?timeWindow=5m" || true)
  CP_TOTAL=$(echo "$CP_JSON" | jq -r '.total // 0' 2>/dev/null || echo "0")
  if [[ "$CP_TOTAL" -ge 1 ]]; then
    log "✅ Non-demo control plane API returned total=$CP_TOTAL"
    break
  fi
  sleep 1
done

if [[ "${CP_TOTAL:-0}" -lt 1 ]]; then
  log "❌ Non-demo control plane API did not return decisions"
  echo "$CP_JSON" | head -c 1000
  exit 1
fi

log "🎉 E2E test completed successfully"


