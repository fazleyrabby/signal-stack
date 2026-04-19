#!/bin/bash
# Sync production DB from VPS to local
# Usage: ./scripts/sync-db.sh

set -e

LOCAL_DB_NAME="signalstack"
LOCAL_DB_USER="signal"
LOCAL_DB_PASS="signal"
LOCAL_DB_PORT="5433"
VPS_DB_NAME="signalstack"
VPS_DB_USER="signal"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}━━━ SignalStack DB Sync: VPS → Local ━━━${NC}"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Check if postgres is running locally
if ! docker ps | grep -q signalstack-db; then
    echo -e "${YELLOW}⚠ Local PostgreSQL not running. Starting...${NC}"
    cd "${PROJECT_ROOT}"
    docker compose up postgres -d
    sleep 5
fi

# Create backup dir
mkdir -p "${PROJECT_ROOT}/db-backups"

DUMP_FILE="${PROJECT_ROOT}/db-backups/vps_dump_$(date +%Y%m%d_%H%M%S).sql"

echo -e "${BLUE}▶${NC} Dumping production database from VPS..."
ssh signalstack "cd /home/fazley/signal-stack && docker exec signalstack-db pg_dump -U ${VPS_DB_USER} -d ${VPS_DB_NAME} --clean --if-exists --no-owner --no-acl --exclude-table-data='public.sessions'" > "${DUMP_FILE}"

if [ ! -s "${DUMP_FILE}" ]; then
    echo -e "${RED}✗ Failed to download dump file or file is empty${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Dump downloaded: ${DUMP_FILE}"
echo ""

echo -e "${BLUE}▶${NC} Recreating local database..."

# Terminate any active connections
docker exec signalstack-db psql -U signal -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'signalstack' AND pid <> pg_backend_pid();" 2>/dev/null || true

# Drop and recreate local database
export PGPASSWORD=${LOCAL_DB_PASS}
docker exec -i signalstack-db psql -U ${LOCAL_DB_USER} -d postgres -c "DROP DATABASE IF EXISTS ${LOCAL_DB_NAME};" 2>/dev/null || true
docker exec -i signalstack-db psql -U ${LOCAL_DB_USER} -d postgres -c "CREATE DATABASE ${LOCAL_DB_NAME};" 2>/dev/null || true

echo -e "${GREEN}✓${NC} Local database recreated"
echo ""

echo -e "${BLUE}▶${NC} Importing data to local database..."
cat "${DUMP_FILE}" | docker exec -i signalstack-db psql -U ${LOCAL_DB_USER} -d ${LOCAL_DB_NAME}

echo -e "${GREEN}✓${NC} Data imported successfully"
echo ""

# Clean up old backups (keep last 5)
cd "${PROJECT_ROOT}/db-backups" && ls -t *.sql 2>/dev/null | tail -n +6 | xargs -r rm -- 2>/dev/null || true

echo -e "${GREEN}━━━ Sync Complete! ━━━${NC}"
echo ""
echo -e "Local DB: ${BLUE}postgresql://${LOCAL_DB_USER}:${LOCAL_DB_PASS}@localhost:${LOCAL_DB_PORT}/${LOCAL_DB_NAME}${NC}"
echo ""
echo -e "Quick check: ${BLUE}docker exec signalstack-db psql -U signal -d signalstack -c 'SELECT COUNT(*) FROM signals;'${NC}"
