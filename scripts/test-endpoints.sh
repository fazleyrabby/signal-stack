#!/usr/bin/env bash
# SignalStack API Endpoint Health Checker
# Usage: ./scripts/test-endpoints.sh [BASE_URL]
# Example: ./scripts/test-endpoints.sh https://api.fazleyrabbi.xyz

BASE_URL=${1:-"https://api.fazleyrabbi.xyz"}
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

echo -e "${BOLD}━━━ SignalStack API Test: ${BLUE}$BASE_URL${NC} ━━━\n"

test_endpoint() {
  local method="$1"
  local path="$2"
  local label="$3"
  
  echo -ne "Testing ${BOLD}$label${NC} ($path)... "
  
  local response
  if [ "$method" == "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL$path")
  else
    response=$(curl -s -X "$method" -w "\n%{http_code}" "$BASE_URL$path")
  fi
  
  local http_code=$(echo "$response" | tail -n1)
  local body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" == "200" ] || [ "$http_code" == "201" ]; then
    echo -e "${GREEN}PASS${NC}"
    # Extract some info if it's JSON
    if echo "$body" | grep -q "{"; then
        local summary=$(echo "$body" | jq -c '.' 2>/dev/null | cut -c1-80)
        [ -n "$summary" ] && echo -e "  ${BLUE}↳${NC} $summary..."
    fi
  else
    echo -e "${RED}FAIL${NC} (HTTP $http_code)"
    [ -n "$body" ] && echo -e "  ${RED}Error:${NC} $(echo "$body" | head -n 1 | cut -c1-100)"
  fi
}

# Public Endpoints
test_endpoint "GET" "/api/health" "Health Check"
test_endpoint "GET" "/api/signals?limit=1" "Signals List"
test_endpoint "GET" "/api/signals/stats" "Signals Stats"
test_endpoint "GET" "/api/signals/sources" "Unique Sources"
test_endpoint "GET" "/api/signals/trends" "Trends Data"
test_endpoint "GET" "/api/signals/geo" "Geographic Data"
test_endpoint "GET" "/api/signals/ai-providers" "AI Provider Stats"
test_endpoint "GET" "/api/feed.xml" "RSS Feed"
test_endpoint "GET" "/api/visitors/stats" "Visitor Stats"
test_endpoint "POST" "/api/visitors" "Track Visitor"

echo -e "\n${BOLD}Test Suite Complete${NC}"
