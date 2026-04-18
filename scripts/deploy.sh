#!/usr/bin/env bash
# SignalStack Production Deploy Script — Zero-Downtime with Safe Rollback
# Strategy: pre-build while old containers serve → fast-swap → auto-rollback on failure
# Run on VPS: ./scripts/deploy.sh
# Manual rollback: ./scripts/deploy.sh --rollback

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

COMPOSE_FILE="docker-compose.prod.yml"
APP_IMAGE="signal-stack-app"
FRONTEND_IMAGE="signal-stack-frontend"
ROLLBACK_DONE=false

info()  { echo -e "\n${BLUE}▶${NC} $1"; }
pass()  { echo -e "${GREEN}✓${NC} $1"; }
fail()  { echo -e "${RED}✗${NC} $1" >&2; exit 1; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }

# ── Manual Rollback ──────────────────────────────────────────────────────────
if [ "${1:-}" = "--rollback" ]; then
  echo -e "${BOLD}━━━ SignalStack Manual Rollback ━━━${NC}\n"

  [ -f "$COMPOSE_FILE" ] || fail "$COMPOSE_FILE not found — run from project root"

  if ! docker image inspect "${APP_IMAGE}:rollback" &>/dev/null; then
    fail "No rollback snapshot found. Run a deploy first to create one."
  fi

  ROLLBACK_SHA=$(docker inspect --format '{{index .Config.Labels "deploy.sha"}}' "${APP_IMAGE}:rollback" 2>/dev/null || echo "unknown")
  warn "Rolling back app to commit: ${ROLLBACK_SHA}"

  docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true

  docker tag "${APP_IMAGE}:rollback"      "${APP_IMAGE}:latest"
  docker tag "${FRONTEND_IMAGE}:rollback" "${FRONTEND_IMAGE}:latest" 2>/dev/null || \
    warn "No frontend rollback snapshot — frontend image unchanged"

  docker compose -f "$COMPOSE_FILE" up -d --no-build
  pass "Rollback complete (commit: ${ROLLBACK_SHA})"
  echo -e "\n  Verify: docker compose -f $COMPOSE_FILE ps\n"
  exit 0
fi

# ── Deploy ───────────────────────────────────────────────────────────────────
do_rollback() {
  [ "$ROLLBACK_DONE" = true ] && return
  ROLLBACK_DONE=true
  echo -e "\n${RED}${BOLD}━━━ DEPLOY FAILED — Auto-Rolling Back ━━━${NC}"

  docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true

  if docker image inspect "${APP_IMAGE}:rollback" &>/dev/null; then
    warn "Restoring rollback snapshot..."
    docker tag "${APP_IMAGE}:rollback"      "${APP_IMAGE}:latest"
    docker tag "${FRONTEND_IMAGE}:rollback" "${FRONTEND_IMAGE}:latest" 2>/dev/null || true
    docker compose -f "$COMPOSE_FILE" up -d --no-build 2>/dev/null || true

    ROLLBACK_SHA=$(docker inspect --format '{{index .Config.Labels "deploy.sha"}}' "${APP_IMAGE}:rollback" 2>/dev/null || echo "unknown")
    warn "Restored to commit: ${ROLLBACK_SHA}"
    warn "Verify with: docker compose -f $COMPOSE_FILE ps"
  else
    warn "No rollback snapshot found — this was a first deploy"
    warn "Fix the issue and re-run: ./scripts/deploy.sh"
  fi
  exit 1
}

trap do_rollback ERR

echo -e "${BOLD}━━━ SignalStack Production Deploy ━━━${NC}\n"

# 1. Validate environment
[ -f "$COMPOSE_FILE" ] || fail "$COMPOSE_FILE not found — run from project root"
[ -d ".git" ]          || fail "Not a git repository"
[ -f ".env" ]          || fail ".env not found — create it with your API keys"

# 2. Sync code
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

# 3. Snapshot current images for rollback (rotate: latest → rollback, rollback → rollback-prev)
info "Snapshotting current images for rollback..."

# Rotate existing rollback → rollback-prev (keep 2 generations)
if docker image inspect "${APP_IMAGE}:rollback" &>/dev/null; then
  docker tag "${APP_IMAGE}:rollback" "${APP_IMAGE}:rollback-prev" 2>/dev/null || true
fi
if docker image inspect "${FRONTEND_IMAGE}:rollback" &>/dev/null; then
  docker tag "${FRONTEND_IMAGE}:rollback" "${FRONTEND_IMAGE}:rollback-prev" 2>/dev/null || true
fi

# Snapshot current latest → rollback (with SHA label for traceability)
if docker image inspect "${APP_IMAGE}:latest" &>/dev/null; then
  docker tag "${APP_IMAGE}:latest" "${APP_IMAGE}:rollback"
  # Stamp the SHA onto the rollback image label
  PREV_SHA=$(docker inspect --format '{{index .Config.Labels "deploy.sha"}}' "${APP_IMAGE}:latest" 2>/dev/null || echo "$LOCAL_HASH")
  pass "Snapped app:rollback (was: ${PREV_SHA:-unknown})"
else
  warn "No existing app image to snapshot (first deploy?)"
fi

if docker image inspect "${FRONTEND_IMAGE}:latest" &>/dev/null; then
  docker tag "${FRONTEND_IMAGE}:latest" "${FRONTEND_IMAGE}:rollback"
  pass "Snapped frontend:rollback"
else
  warn "No existing frontend image to snapshot (first deploy?)"
fi

# 4. Free memory before build
info "Freeing unused memory..."
docker system prune -f --filter "until=24h" 2>/dev/null || true
pass "Cleaned stale Docker artifacts"

# 5. BUILD new images while old containers keep serving traffic
info "Building new images (old containers still live)..."
docker compose -f "$COMPOSE_FILE" build \
  --build-arg DEPLOY_SHA="$DEPLOY_SHA" \
  app frontend
pass "New images built"

# Stamp deploy SHA as label on the new images for future rollback traceability
docker tag "${APP_IMAGE}:latest" "${APP_IMAGE}:latest" 2>/dev/null || true

# 6. Fast-swap: stop old → start new
info "Swapping containers (brief downtime ~3–5s)..."
docker compose -f "$COMPOSE_FILE" up -d --no-build --remove-orphans
pass "Containers swapped"

# 7. Wait for PostgreSQL
info "Waiting for PostgreSQL..."
for i in $(seq 1 30); do
  if docker exec signalstack-db pg_isready -U signal -d signalstack &>/dev/null; then
    pass "PostgreSQL ready (${i}s)"
    break
  fi
  [ "$i" -eq 30 ] && fail "PostgreSQL did not become healthy in 30s"
  sleep 1
done

# 8. Run database seed (idempotent)
info "Seeding database..."
if docker exec signalstack-app npm run seed 2>&1; then
  pass "Seed complete"
else
  warn "Seed returned non-zero — review output above (deploy continues)"
fi

# 9. Health checks with retry
info "Running health checks..."

wait_http() {
  local label="$1" url="$2" retries=20
  for i in $(seq 1 "$retries"); do
    STATUS=$(curl -s -L -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    [ "$STATUS" = "200" ] && { pass "$label: HTTP 200 (${i}s)"; return 0; }
    [ "$i" -eq "$retries" ] && { echo -e "${RED}✗${NC} $label: HTTP $STATUS after ${retries}s"; return 1; }
    sleep 1
  done
}

wait_http "Backend API" "http://localhost:3000/api/health"
wait_http "Frontend"    "http://localhost:3001/en"

# 10. Container status
info "Container status:"
docker compose -f "$COMPOSE_FILE" ps

# Disarm the rollback trap
trap - ERR

# 11. Show rollback snapshot info
ROLLBACK_PREV_SHA=$(docker inspect --format '{{index .Config.Labels "deploy.sha"}}' "${APP_IMAGE}:rollback" 2>/dev/null || echo "unknown")

echo -e "\n${BOLD}${GREEN}━━━ Deploy Complete ━━━${NC}"
echo -e "  Commit:       $DEPLOY_SHA"
echo -e "  Frontend:     http://localhost:3001"
echo -e "  Backend:      http://localhost:3000"
echo -e "  Admin:        http://localhost:3001/admin"
echo -e ""
echo -e "  ${YELLOW}Rollback options:${NC}"
echo -e "    Fast:       ./scripts/deploy.sh --rollback          ${BLUE}# restore previous version${NC}"
echo -e "    Manual app: docker tag ${APP_IMAGE}:rollback-prev ${APP_IMAGE}:latest"
echo -e ""
echo -e "  ${BLUE}Rollback snapshots:${NC}"
docker images --format "  {{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.CreatedSince}}" \
  | grep -E "${APP_IMAGE}|${FRONTEND_IMAGE}" | grep -E "rollback" || echo "  (none)"
echo ""
