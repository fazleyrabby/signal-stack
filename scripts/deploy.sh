#!/usr/bin/env bash
# SignalStack Production Deploy Script
# Run on VPS: ./scripts/deploy.sh
# Uses docker-compose.prod.yml for fully isolated deployment.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

COMPOSE_FILE="docker-compose.prod.yml"

info()  { echo -e "\n${BLUE}▶${NC} $1"; }
pass()  { echo -e "${GREEN}✓${NC} $1"; }
fail()  { echo -e "${RED}✗${NC} $1"; exit 1; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }

echo -e "${BOLD}━━━ SignalStack Production Deploy ━━━${NC}\n"

# 1. Validate environment
[ -f "$COMPOSE_FILE" ] || fail "$COMPOSE_FILE not found — run from project root"
[ -d ".git" ] || fail "Not a git repository"

# 2. Pull latest
info "Pulling latest from git..."
git stash push -m "auto-stash before deploy" --quiet 2>/dev/null || true
git pull --rebase || { git stash pop --quiet 2>/dev/null || true; fail "Git pull failed — resolve conflicts and retry"; }
git stash pop --quiet 2>/dev/null || true
pass "Code updated ($(git rev-parse --short HEAD))"

# 3. Validate .env
info "Checking environment..."
if [ ! -f ".env" ]; then
  fail ".env not found — create it with your API keys"
fi
pass ".env present"

# 4. Free memory before build (low-RAM VPS safety)
info "Freeing unused memory..."
docker system prune -f --filter "until=24h" 2>/dev/null || true
pass "Cleaned stale Docker artifacts"

# 5. Stop old containers
info "Stopping services..."
docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
pass "Services stopped"

# 6. Build and start
info "Building and starting services..."
docker compose -f "$COMPOSE_FILE" up -d --build
pass "Services started"

# 7. Wait for PostgreSQL
info "Waiting for PostgreSQL..."
for i in $(seq 1 30); do
  if docker exec signalstack-db pg_isready -U signal -d signalstack &>/dev/null; then
    pass "PostgreSQL ready (${i}s)"
    break
  fi
  if [ $i -eq 30 ]; then
    fail "PostgreSQL did not become healthy in 30s"
  fi
  sleep 1
done

# 8. Seed database (idempotent — safe every deploy)
info "Seeding database..."
if docker exec signalstack-app npm run seed 2>/dev/null; then
  pass "Seed complete"
else
  warn "Seed skipped (tables may already exist)"
fi

# 9. Health checks
info "Running health checks..."
sleep 5

BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null || echo "000")
if [ "$BACKEND_STATUS" = "200" ]; then
  pass "Backend API: HTTP 200"
else
  fail "Backend API: HTTP $BACKEND_STATUS"
fi

FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/ 2>/dev/null || echo "000")
if [ "$FRONTEND_STATUS" = "200" ]; then
  pass "Frontend: HTTP 200"
else
  fail "Frontend: HTTP $FRONTEND_STATUS"
fi

# 10. Container status
info "Container status:"
docker compose -f "$COMPOSE_FILE" ps

echo -e "\n${BOLD}${GREEN}━━━ Deploy Complete ━━━${NC}"
echo -e "  Frontend: http://localhost:3001"
echo -e "  Backend:  http://localhost:3000"
echo -e "  Admin:    http://localhost:3001/admin\n"
