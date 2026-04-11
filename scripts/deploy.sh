#!/usr/bin/env bash
# SignalStack Production Deploy Script — Zero-Downtime
# Strategy: pre-build while old containers serve → fast-swap → auto-rollback on failure
# Run on VPS: ./scripts/deploy.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

COMPOSE_FILE="docker-compose.prod.yml"
ROLLBACK_DONE=false

info()  { echo -e "\n${BLUE}▶${NC} $1"; }
pass()  { echo -e "${GREEN}✓${NC} $1"; }
fail()  { echo -e "${RED}✗${NC} $1"; exit 1; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }

# ── Rollback ────────────────────────────────────────────────────────────────
rollback() {
  [ "$ROLLBACK_DONE" = true ] && return
  ROLLBACK_DONE=true
  echo -e "\n${RED}${BOLD}━━━ DEPLOY FAILED — Rolling back ━━━${NC}"

  docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true

  if docker image inspect signalstack-app:rollback &>/dev/null && \
     docker image inspect signalstack-frontend:rollback &>/dev/null; then
    warn "Restoring previous images..."
    # Retag rollback snapshots back to what compose will pick up
    APP_IMAGE=$(docker compose -f "$COMPOSE_FILE" config | \
      grep -A2 '  app:' | grep 'image:' | awk '{print $2}' || echo "")
    FRONTEND_IMAGE=$(docker compose -f "$COMPOSE_FILE" config | \
      grep -A2 '  frontend:' | grep 'image:' | awk '{print $2}' || echo "")
    [ -n "$APP_IMAGE" ]      && docker tag signalstack-app:rollback      "$APP_IMAGE"
    [ -n "$FRONTEND_IMAGE" ] && docker tag signalstack-frontend:rollback "$FRONTEND_IMAGE"
    docker compose -f "$COMPOSE_FILE" up -d --no-build app frontend 2>/dev/null || true
    warn "Rolled back — verify with: docker compose -f $COMPOSE_FILE ps"
  else
    warn "No rollback snapshots found — manual recovery required"
    warn "Check available images with: docker images | grep signalstack"
  fi
  exit 1
}

trap rollback ERR

echo -e "${BOLD}━━━ SignalStack Production Deploy ━━━${NC}\n"

# 1. Validate environment
[ -f "$COMPOSE_FILE" ] || fail "$COMPOSE_FILE not found — run from project root"
[ -d ".git" ]          || fail "Not a git repository"
[ -f ".env" ]          || fail ".env not found — create it with your API keys"

# 2. Sync code (reset to origin/main — production safe)
info "Syncing code with origin/main..."
git merge --abort 2>/dev/null || true
git fetch origin

LOCAL_HASH=$(git rev-parse HEAD 2>/dev/null || echo "none")
REMOTE_HASH=$(git rev-parse origin/main)

if [ "$LOCAL_HASH" != "$REMOTE_HASH" ]; then
  warn "Local HEAD differs from origin/main — discarding local state"
fi
if ! git diff --quiet || ! git diff --cached --quiet; then
  warn "Uncommitted changes detected — they will be lost"
fi

git reset --hard origin/main
git clean -fd
DEPLOY_SHA=$(git rev-parse --short HEAD)
pass "Code synced ($DEPLOY_SHA)"

# 3. Snapshot current images for rollback (before anything changes)
info "Snapshotting current images for rollback..."
docker tag signalstack-app:latest      signalstack-app:rollback      2>/dev/null && \
  pass "Snapped app:rollback" || warn "No existing app image to snapshot (first deploy?)"
docker tag signalstack-frontend:latest signalstack-frontend:rollback 2>/dev/null && \
  pass "Snapped frontend:rollback" || warn "No existing frontend image to snapshot (first deploy?)"

# 4. Free memory before build (low-RAM VPS safety)
info "Freeing unused memory..."
docker system prune -f --filter "until=24h" 2>/dev/null || true
pass "Cleaned stale Docker artifacts"

# 5. BUILD new images while old containers keep serving traffic
#    This is the key step — no downtime yet
info "Building new images (old containers still live)..."
docker compose -f "$COMPOSE_FILE" build app frontend
pass "New images built"

# 6. Fast-swap: stop old → start new (downtime window = ~3–5s)
info "Swapping containers (brief downtime)..."
docker compose -f "$COMPOSE_FILE" up -d --no-build --remove-orphans
pass "Containers swapped"

# 7. Wait for PostgreSQL to be ready
info "Waiting for PostgreSQL..."
for i in $(seq 1 30); do
  if docker exec signalstack-db pg_isready -U signal -d signalstack &>/dev/null; then
    pass "PostgreSQL ready (${i}s)"
    break
  fi
  [ "$i" -eq 30 ] && fail "PostgreSQL did not become healthy in 30s"
  sleep 1
done

# 8. Run database seed (idempotent — safe every deploy)
info "Seeding database..."
if docker exec signalstack-app npm run seed 2>&1; then
  pass "Seed complete"
else
  warn "Seed returned non-zero — review output above (deploy continues)"
fi

# 9. Health checks with retry loop (no fragile sleep)
info "Running health checks..."

wait_http() {
  local label="$1" url="$2" retries=20
  for i in $(seq 1 "$retries"); do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    [ "$STATUS" = "200" ] && { pass "$label: HTTP 200 (${i}s)"; return 0; }
    [ "$i" -eq "$retries" ] && { echo -e "${RED}✗${NC} $label: HTTP $STATUS after ${retries}s"; return 1; }
    sleep 1
  done
}

wait_http "Backend API" "http://localhost:3000/api/health"
wait_http "Frontend"    "http://localhost:3001/"

# 10. Container status
info "Container status:"
docker compose -f "$COMPOSE_FILE" ps

# All good — disarm the rollback trap
trap - ERR

echo -e "\n${BOLD}${GREEN}━━━ Deploy Complete ━━━${NC}"
echo -e "  Commit:   $DEPLOY_SHA"
echo -e "  Frontend: http://localhost:3001"
echo -e "  Backend:  http://localhost:3000"
echo -e "  Admin:    http://localhost:3001/admin"
echo -e "  Rollback: docker compose -f $COMPOSE_FILE down && docker tag signalstack-app:rollback signalstack-app:latest && docker tag signalstack-frontend:rollback signalstack-frontend:latest && docker compose -f $COMPOSE_FILE up -d --no-build\n"
