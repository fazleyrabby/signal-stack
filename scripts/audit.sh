#!/usr/bin/env bash
# SignalStack VPS Environment Audit
# Run this on your Proxmox VM: curl -sL <raw-url> | bash
# Or: scp to VPS, then: chmod +x audit.sh && ./audit.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

PASS=0
FAIL=0
WARN=0

pass() { echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  ${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; WARN=$((WARN + 1)); }
info() { echo -e "  ${BLUE}ℹ${NC} $1"; }
section() { echo -e "\n${BOLD}━━━ $1 ━━━${NC}"; }

section "System Information"
echo -e "  OS:        $(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d '"' || echo 'unknown')"
echo -e "  Kernel:    $(uname -r)"
echo -e "  Arch:      $(uname -m)"
echo -e "  Hostname:  $(hostname)"
echo -e "  Uptime:    $(uptime -p 2>/dev/null || uptime)"
echo -e "  RAM:       $(free -h 2>/dev/null | awk '/^Mem:/{print $2 " total, " $3 " used, " $4 " free"}' || echo 'unknown')"
echo -e "  Disk:      $(df -h / 2>/dev/null | awk 'NR==2{print $3 " used / " $2 " total (" $5 " used)"}' || echo 'unknown')"

section "Docker"
if command -v docker &>/dev/null; then
  pass "Docker installed: $(docker --version)"
else
  fail "Docker NOT installed"
fi

if command -v docker compose &>/dev/null || docker compose version &>/dev/null 2>&1; then
  pass "Docker Compose: $(docker compose version 2>/dev/null || echo 'installed')"
else
  fail "Docker Compose NOT installed"
fi

section "Running Containers"
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q signalstack; then
  pass "SignalStack containers found:"
  docker ps --filter "name=signalstack" --format "    {{.Names}} — {{.Status}} — ports: {{.Ports}}" 2>/dev/null
else
  warn "No SignalStack containers running"
fi

section "Container Health"
for container in signalstack-db signalstack-redis signalstack-app signalstack-frontend; do
  if docker inspect -f '{{.State.Status}}' "$container" &>/dev/null; then
    status=$(docker inspect -f '{{.State.Status}}' "$container")
    if [ "$status" = "running" ]; then
      pass "$container: running"
    else
      fail "$container: $status"
    fi
  else
    warn "$container: not found"
  fi
done

section "Port Bindings"
for port in 3000 3001 5433 6380; do
  if ss -tlnp 2>/dev/null | grep -q ":$port " || netstat -tlnp 2>/dev/null | grep -q ":$port "; then
    pass "Port $port: listening"
  else
    warn "Port $port: NOT listening"
  fi
done

section "Project Directory"
PROJECT_DIR=""
for dir in /root/signal-stack /home/*/signal-stack /opt/signal-stack /srv/signal-stack; do
  if [ -d "$dir" ]; then
    PROJECT_DIR="$dir"
    pass "Found at: $dir"
    break
  fi
done

if [ -z "$PROJECT_DIR" ]; then
  fail "signal-stack directory not found in common locations"
else
  section "Git Status ($PROJECT_DIR)"
  cd "$PROJECT_DIR"
  if git rev-parse --is-inside-work-tree &>/dev/null; then
    pass "Git repository initialized"
    branch=$(git branch --show-current 2>/dev/null || git rev-parse --short HEAD)
    info "Current branch/commit: $branch"
    
    remote=$(git remote get-url origin 2>/dev/null || echo "no remote")
    info "Remote: $remote"
    
    if git diff --quiet HEAD 2>/dev/null; then
      pass "Working tree clean"
    else
      warn "Uncommitted changes detected:"
      git diff --stat 2>/dev/null | head -10
    fi
    
    if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
      warn "Untracked files present"
    fi
  else
    fail "Not a git repository"
  fi

  section "Environment Files"
  if [ -f ".env" ]; then
    pass ".env exists"
    # Check for empty/placeholder values
    if grep -qE '(gsk_|sk-or-v1-|dev-admin-key|your-)' .env 2>/dev/null; then
      warn ".env contains placeholder/default values"
    else
      pass ".env has real-looking values"
    fi
  else
    fail ".env NOT found — Docker Compose will have blank env vars"
  fi

  if [ -f "backend/.env" ]; then
    pass "backend/.env exists"
  else
    warn "backend/.env not found (only needed for local dev, not Docker)"
  fi

  section "Docker Compose"
  if [ -f "docker-compose.yml" ]; then
    pass "docker-compose.yml exists"
    # Check for volume mounts (dev-only pattern)
    if grep -qE '^\s+- \./(backend|frontend):' docker-compose.yml 2>/dev/null; then
      warn "Volume mounts detected — this is a dev pattern, not production"
    else
      pass "No dev volume mounts (production-safe)"
    fi
  else
    fail "docker-compose.yml NOT found"
  fi

  if [ -f "docker-compose.prod.yml" ]; then
    warn "docker-compose.prod.yml exists — verify you're using the right compose file"
  fi

  section "Service Connectivity"
  # Test backend API
  if curl -sf http://localhost:3000/api/health &>/dev/null; then
    pass "Backend API (3000): responding"
    curl -sf http://localhost:3000/api/health 2>/dev/null | head -1 | python3 -m json.tool 2>/dev/null || true
  else
    fail "Backend API (3000): NOT responding"
  fi

  # Test frontend
  status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/ 2>/dev/null || echo "000")
  if [ "$status" = "200" ]; then
    pass "Frontend (3001): HTTP 200"
  else
    fail "Frontend (3001): HTTP $status"
  fi

  section "Recent Container Logs (last 5 errors)"
  for container in signalstack-app signalstack-frontend; do
    errors=$(docker logs --tail 100 "$container" 2>&1 | grep -iE '(error|fail|crash|fatal)' | tail -5)
    if [ -n "$errors" ]; then
      warn "$container errors:"
      echo "$errors" | sed 's/^/    /'
    else
      pass "$container: no recent errors"
    fi
  done

  section "Database"
  if docker exec signalstack-db pg_isready -U signal -d signalstack &>/dev/null; then
    pass "PostgreSQL: healthy"
    table_count=$(docker exec signalstack-db psql -U signal -d signalstack -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
    if [ -n "$table_count" ]; then
      info "Tables in database: $table_count"
    fi
  else
    fail "PostgreSQL: NOT healthy"
  fi

  section "Redis"
  if docker exec signalstack-redis redis-cli ping 2>/dev/null | grep -q PONG; then
    pass "Redis: responding"
  else
    warn "Redis: NOT responding (optional for current setup)"
  fi
fi

section "Summary"
echo -e "  ${GREEN}Passed: $PASS${NC}"
echo -e "  ${YELLOW}Warnings: $WARN${NC}"
echo -e "  ${RED}Failed: $FAIL${NC}"

if [ $FAIL -gt 0 ]; then
  echo -e "\n  ${RED}⚠ $FAIL issue(s) need attention before deployment.${NC}"
  exit 1
else
  echo -e "\n  ${GREEN}✓ Environment looks healthy!${NC}"
  exit 0
fi
