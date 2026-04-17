#!/usr/bin/env bash
# SignalStack Premium API Diagnostics
# Usage: ./scripts/test-endpoints.sh [BASE_URL]

BASE_URL=${1:-"https://api.fazleyrabbi.xyz"}

# --- Professional Color Palette ---
CLR_PRIMARY='\033[38;5;75m'    # Soft Blue
CLR_SUCCESS='\033[38;5;82m'    # Vibrant Green
CLR_WARN='\033[38;5;214m'      # Warm Orange
CLR_DANGER='\033[38;5;196m'    # Sharp Red
CLR_TEXT='\033[38;5;253m'      # Near White
CLR_MUTED='\033[38;5;242m'     # Gray
NC='\033[0m'
BOLD='\033[1m'

# Formatting helpers
line() { echo -e "${CLR_MUTED}────────────────────────────────────────────────────────────────${NC}"; }
header() {
    clear
    echo -e "\n  ${CLR_PRIMARY}${BOLD}S I G N A L S T A C K${NC}  ${CLR_MUTED}│${NC}  Diagnostic Protocol"
    echo -e "  ${CLR_MUTED}Host: $BASE_URL${NC}"
    echo ""
}

# --- Interaction Logic ---
spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    while kill -0 "$pid" 2>/dev/null; do
        for i in {1..10}; do
            local temp=${spinstr#?}
            printf "\r  ${CLR_PRIMARY}%c${NC}  Initializing scan... " "$spinstr"
            local spinstr=$temp${spinstr%"$temp"}
            sleep $delay
        done
    done
    printf "\r                                      \r"
}

execute_test() {
    local method="$1"
    local path="$2"
    local label="$3"
    local result_file=$(mktemp)

    echo -ne "  ${CLR_TEXT}${BOLD}$label${NC}\n"
    
    # Run curl tasks in background
    (
        # Use a minimum sleep for the "smooth" experience
        sleep 0.6
        
        if [ "$method" == "GET" ]; then
            curl -s -w "\n%{http_code}" "$BASE_URL$path" > "$result_file"
        else
            curl -s -X "$method" -w "\n%{http_code}" "$BASE_URL$path" > "$result_file"
        fi
    ) &
    local pid=$!
    spinner $pid
    wait $pid

    # Read results
    local http_code=$(tail -n 1 "$result_file")
    local body=$(sed '$d' "$result_file")
    rm "$result_file"

    # Display Status
    if [[ "$http_code" =~ ^20[0-9]$ ]]; then
        printf "  ${CLR_SUCCESS}●${NC}  ${CLR_MUTED}Operational${NC}   ${CLR_MUTED}Method:${NC} $method   ${CLR_MUTED}Code:${NC} $http_code\n"
        
        # Intelligent payload preview for JSON
        if echo "$body" | grep -q "{" || echo "$body" | grep -q "\["; then
            local preview=$(echo "$body" | jq -c '.' 2>/dev/null | cut -c1-75)
            if [ -z "$preview" ]; then
                preview=$(echo "$body" | head -n 1 | cut -c1-75)
            fi
            echo -e "     ${CLR_MUTED}❯${NC} ${CLR_MUTED}$preview...${NC}\n"
        else
            # For XML/RSS or other formats
            local preview=$(echo "$body" | head -n 1 | cut -c1-75)
            echo -e "     ${CLR_MUTED}❯${NC} ${CLR_MUTED}$preview...${NC}\n"
        fi
    else
        printf "  ${CLR_DANGER}○${NC}  ${CLR_DANGER}Criticial Error${NC}    ${CLR_MUTED}Method:${NC} $method   ${CLR_MUTED}Code:${NC} $http_code\n"
        local error_msg=$(echo "$body" | head -n 1 | cut -c1-100)
        echo -e "     ${CLR_DANGER}Log:${NC} ${CLR_MUTED}${error_msg:-"No response body"}${NC}\n"
    fi
}

# --- Execution ---
header

line
execute_test "GET" "/api/health" "System Health Monitoring"
execute_test "GET" "/api/signals?limit=1" "Intelligence Stream Processing"
execute_test "GET" "/api/signals/stats" "Global Signal Metadata"
execute_test "GET" "/api/signals/trends" "Analytic Trend Aggregation"
execute_test "GET" "/api/signals/geo" "Geospatial Intelligence Map"
execute_test "GET" "/api/feed.xml" "Public Distribution Gateway (RSS)"
execute_test "GET" "/api/visitors/stats" "Audience Engagement Metrics"
execute_test "POST" "/api/visitors" "Active Session Ingestion"
line

echo -e "\n  ${CLR_PRIMARY}${BOLD}A D M I N   E N D P O I N T S${NC}  ${CLR_MUTED}│${NC}  401 expected without auth — confirms guard is active\n"
line
execute_test "GET" "/api/admin/companies/saved?limit=1" "Company Radar — Saved Companies (auth guard)"
execute_test "GET" "/api/admin/companies/crawl/sources" "Directory Crawler — Source Metadata (auth guard)"
execute_test "GET" "/api/admin/signals" "Signals Admin (auth guard)"
execute_test "GET" "/api/admin/metrics" "System Metrics (auth guard)"
line

echo -e "\n  ${CLR_SUCCESS}${BOLD}DIAGNOSTICS COMPLETE${NC}"
echo -e "  Public endpoints: should be 2xx. Admin endpoints: 401 = guard active (correct).\n"
