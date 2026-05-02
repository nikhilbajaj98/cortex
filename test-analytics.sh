#!/bin/bash

# Define colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Cortex Analytics Test Script${NC}"
echo -e "=================================="

# --- Configuration ---
API_URL="http://localhost:8080/api/v1"
INGEST_ENDPOINT="${API_URL}/ingest"
METRICS_ENDPOINT="${API_URL}/metrics"
OVERVIEW_ENDPOINT="${METRICS_ENDPOINT}/overview"
HEALTH_ENDPOINT="${METRICS_ENDPOINT}/health"
WAIT_TIME=3 # seconds to wait for processing

# --- Helper Functions ---
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# --- Main Test Logic ---
log_info "Starting Cortex Analytics Test..."

# 1. Send test events to generate analytics data
log_info "Sending test events to generate analytics data..."

# Send events for different services with varying patterns
services=("user-service" "payment-service" "order-service" "inventory-service")

for service in "${services[@]}"; do
  log_info "Sending events for service: $service"
  
  # Send 10 events per service with different patterns
  for i in {1..10}; do
    # Vary latency and status codes to test analytics
    latency=$((50 + RANDOM % 200))
    status=200
    if [ $((RANDOM % 10)) -eq 0 ]; then
      status=500
    elif [ $((RANDOM % 20)) -eq 0 ]; then
      status=400
    fi
    
    curl -s -X POST ${INGEST_ENDPOINT} \
      -H "Content-Type: application/json" \
      -d "{
        \"type\": \"api-request\",
        \"service\": \"$service\",
        \"status\": $status,
        \"latency\": $latency,
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\",
        \"metadata\": {\"test\": true, \"iteration\": $i, \"service\": \"$service\"},
        \"ip\": \"127.0.0.1\"
      }" > /dev/null
  done
  
  log_success "Sent 10 events for $service"
done

log_info "Waiting for analytics processing..."
sleep ${WAIT_TIME}

# 2. Test metrics endpoints
log_info "Testing analytics endpoints..."

# Test system overview
log_info "Testing system overview endpoint..."
OVERVIEW_RESPONSE=$(curl -s ${OVERVIEW_ENDPOINT})
if [ $? -eq 0 ]; then
  log_success "System overview endpoint working"
  echo "Overview data: $(echo $OVERVIEW_RESPONSE | jq -r '.system')"
else
  log_error "System overview endpoint failed"
fi

# Test health scores
log_info "Testing health scores endpoint..."
HEALTH_RESPONSE=$(curl -s ${HEALTH_ENDPOINT})
if [ $? -eq 0 ]; then
  log_success "Health scores endpoint working"
  echo "Health summary: $(echo $HEALTH_RESPONSE | jq -r '.summary')"
else
  log_error "Health scores endpoint failed"
fi

# Test individual service metrics
for service in "${services[@]}"; do
  log_info "Testing metrics for service: $service"
  SERVICE_METRICS=$(curl -s "${METRICS_ENDPOINT}/service/${service}")
  if [ $? -eq 0 ]; then
    log_success "Metrics endpoint working for $service"
    echo "Service metrics: $(echo $SERVICE_METRICS | jq -r '.metrics')"
  else
    log_error "Metrics endpoint failed for $service"
  fi
done

# Test all services metrics
log_info "Testing all services metrics endpoint..."
ALL_SERVICES_RESPONSE=$(curl -s "${METRICS_ENDPOINT}/services")
if [ $? -eq 0 ]; then
  log_success "All services metrics endpoint working"
  echo "Total services: $(echo $ALL_SERVICES_RESPONSE | jq -r '.totalServices')"
else
  log_error "All services metrics endpoint failed"
fi

# Test time window aggregations
log_info "Testing time window aggregations..."
AGGREGATIONS_RESPONSE=$(curl -s "${METRICS_ENDPOINT}/aggregations/time-windows?window=5m")
if [ $? -eq 0 ]; then
  log_success "Time window aggregations endpoint working"
  echo "Aggregation data: $(echo $AGGREGATIONS_RESPONSE | jq -r '.aggregation')"
else
  log_error "Time window aggregations endpoint failed"
fi

# 3. Test cache clearing (admin function)
log_info "Testing cache clearing..."
CACHE_CLEAR_RESPONSE=$(curl -s -X DELETE "${METRICS_ENDPOINT}/cache")
if [ $? -eq 0 ]; then
  log_success "Cache clearing endpoint working"
else
  log_error "Cache clearing endpoint failed"
fi

log_success "🎉 Analytics test completed!"
log_info "Check the responses above for analytics data"
log_info "You can now access real-time metrics at: ${METRICS_ENDPOINT}"








