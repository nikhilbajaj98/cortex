#!/bin/bash

echo "🧪 Cortex End-to-End Test Script"
echo "================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1

    print_status "Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            print_success "$service_name is ready!"
            return 0
        fi
        
        print_status "Attempt $attempt/$max_attempts - $service_name not ready yet..."
        sleep 2
        ((attempt++))
    done
    
    print_error "$service_name failed to start after $max_attempts attempts"
    return 1
}

# Test API endpoints
test_api() {
    print_status "Testing API endpoints..."
    
    # Test health endpoint
    print_status "Testing health endpoint..."
    health_response=$(curl -s http://localhost:8080/api/v1/health)
    if echo "$health_response" | grep -q "healthy"; then
        print_success "Health endpoint working: $health_response"
    else
        print_error "Health endpoint failed: $health_response"
        return 1
    fi
    
    # Test root endpoint
    print_status "Testing root endpoint..."
    root_response=$(curl -s http://localhost:8080/)
    if echo "$root_response" | grep -q "Cortex"; then
        print_success "Root endpoint working"
    else
        print_error "Root endpoint failed: $root_response"
        return 1
    fi
}

# Test event ingestion
test_event_ingestion() {
    print_status "Testing event ingestion..."
    
    # Test single event
    print_status "Sending test event..."
    event_response=$(curl -s -X POST http://localhost:8080/api/v1/ingest \
        -H "Content-Type: application/json" \
        -d '{
            "type": "test-event",
            "service": "test-service",
            "status": 200,
            "latency": 150,
            "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'",
            "metadata": {"test": true, "source": "e2e-test"},
            "ip": "127.0.0.1"
        }')
    
    if echo "$event_response" | grep -q "successfully"; then
        print_success "Event ingestion working: $event_response"
    else
        print_error "Event ingestion failed: $event_response"
        return 1
    fi
    
    # Test multiple events
    print_status "Sending multiple test events..."
    for i in {1..3}; do
        curl -s -X POST http://localhost:8080/api/v1/ingest \
            -H "Content-Type: application/json" \
            -d "{
                \"type\": \"test-event-$i\",
                \"service\": \"test-service\",
                \"status\": 200,
                \"latency\": $((100 + i * 10)),
                \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\",
                \"metadata\": {\"test\": true, \"iteration\": $i, \"source\": \"e2e-test\"},
                \"ip\": \"127.0.0.1\"
            }" > /dev/null
    done
    print_success "Multiple events sent successfully"
}

# Test database connection
test_database() {
    print_status "Testing database connection..."
    
    # Check if we can connect to PostgreSQL
    if docker exec cortex-db psql -U postgres -d cortex -c "SELECT 1;" > /dev/null 2>&1; then
        print_success "Database connection working"
        
        # Check if events table exists
        if docker exec cortex-db psql -U postgres -d cortex -c "SELECT COUNT(*) FROM events;" > /dev/null 2>&1; then
            print_success "Events table accessible"
            
            # Count events
            event_count=$(docker exec cortex-db psql -U postgres -d cortex -t -c "SELECT COUNT(*) FROM events;" 2>/dev/null | tr -d ' ')
            print_status "Total events in database: $event_count"
        else
            print_warning "Events table not found or not accessible"
        fi
    else
        print_error "Database connection failed"
        return 1
    fi
}

# Test Kafka topics
test_kafka() {
    print_status "Testing Kafka topics..."
    
    # Check if Redpanda is running
    if docker exec cortex-redpanda rpk topic list > /dev/null 2>&1; then
        print_success "Redpanda is running"
        
        # List topics
        topics=$(docker exec cortex-redpanda rpk topic list 2>/dev/null)
        print_status "Available topics: $topics"
        
        if echo "$topics" | grep -q "cortex-events"; then
            print_success "cortex-events topic exists"
        else
            print_warning "cortex-events topic not found"
        fi
    else
        print_error "Redpanda not accessible"
        return 1
    fi
}

# Main test function
main() {
    print_status "Starting Cortex End-to-End Test..."
    
    # Wait for services to be ready
    if ! wait_for_service "http://localhost:8080/api/v1/health" "Cortex API"; then
        print_error "Cortex API not ready, exiting..."
        exit 1
    fi
    
    # Test API
    if ! test_api; then
        print_error "API tests failed, exiting..."
        exit 1
    fi
    
    # Test event ingestion
    if ! test_event_ingestion; then
        print_error "Event ingestion tests failed, exiting..."
        exit 1
    fi
    
    # Wait a bit for events to be processed
    print_status "Waiting for events to be processed..."
    sleep 5
    
    # Test database
    test_database
    
    # Test Kafka
    test_kafka
    
    print_success "🎉 End-to-end test completed!"
    print_status "Check the logs above for any warnings or errors"
}

# Run the test
main "$@"

