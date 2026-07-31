#!/usr/bin/env bash
# ============================================================
# Safari Zetu Ops Engine — Linux Homelab Setup Script
# Compatible with: Ubuntu 22.04+, Debian 12+, Proxmox LXC
#
# Usage:
#   chmod +x setup.sh
#   ./setup.sh
#
# What this does:
#   1. Checks Docker & Docker Compose are installed
#   2. Validates all required .env values
#   3. Creates required local directories
#   4. Sets up Cloudflare tunnel credentials (interactive)
#   5. Builds and starts the full Docker stack
#   6. Verifies all services are healthy
#   7. Prints access URLs
# ============================================================

set -euo pipefail

# ── COLORS ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"

# ── HELPERS ───────────────────────────────────────────────────
info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[PASS]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }
step()    { echo -e "\n${CYAN}════════════════════════════════════════${NC}"; echo -e "${WHITE}  $*${NC}"; echo -e "${CYAN}════════════════════════════════════════${NC}"; }

# ── BANNER ────────────────────────────────────────────────────
echo -e "${CYAN}"
echo "  ╔═══════════════════════════════════════╗"
echo "  ║   Safari Zetu Ops Engine              ║"
echo "  ║   Homelab Setup — Linux Edition        ║"
echo "  ╚═══════════════════════════════════════╝"
echo -e "${NC}"

# ─────────────────────────────────────────────────────────────
# STEP 1: Check prerequisites
# ─────────────────────────────────────────────────────────────
step "Step 1/7 — Checking prerequisites"

if ! command -v docker &>/dev/null; then
  error "Docker not installed. Install it with:
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker \$USER
  newgrp docker"
fi
success "Docker: $(docker --version)"

if ! docker compose version &>/dev/null; then
  error "Docker Compose plugin not found. Update Docker Desktop or install:
  sudo apt-get install docker-compose-plugin"
fi
success "Docker Compose: $(docker compose version)"

# Check if Docker daemon is running
if ! docker info &>/dev/null; then
  error "Docker daemon is not running. Start it with:
  sudo systemctl start docker"
fi
success "Docker daemon is running"

# ─────────────────────────────────────────────────────────────
# STEP 2: Validate .env file
# ─────────────────────────────────────────────────────────────
step "Step 2/7 — Validating environment config"

if [ ! -f "$ENV_FILE" ]; then
  warn ".env file not found. Copying from .env.template..."
  cp "$PROJECT_DIR/.env.template" "$ENV_FILE"
  echo ""
  echo -e "${YELLOW}  ⚠️  ACTION REQUIRED:${NC}"
  echo -e "${WHITE}  Fill in your secrets in: ${ENV_FILE}${NC}"
  echo "  Then re-run this script."
  exit 1
fi
success ".env file found"

# Load env vars for validation
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

# Required variables — if any are placeholder values, fail
REQUIRED_VARS=(
  "POSTGRES_PASSWORD"
  "SAFARI_ZETU_WEBHOOK_SECRET"
  "SAFARI_ZETU_API_KEY"
  "OPS_ENGINE_SECRET"
  "OPS_ENGINE_API_KEY"
  "N8N_BASIC_AUTH_PASSWORD"
  "N8N_ENCRYPTION_KEY"
  "OPENCODE_ZEN_API_KEY"
  "RESEND_API_KEY"
)

PLACEHOLDER_PATTERNS=("generate_" "your_" "change_me" "TODO" "CHANGEME")

all_valid=true
for var in "${REQUIRED_VARS[@]}"; do
  val="${!var:-}"
  if [ -z "$val" ]; then
    echo -e "  ${RED}MISSING${NC}: $var is not set"
    all_valid=false
    continue
  fi
  for pattern in "${PLACEHOLDER_PATTERNS[@]}"; do
    if [[ "$val" == *"$pattern"* ]]; then
      echo -e "  ${RED}PLACEHOLDER${NC}: $var still has template value"
      all_valid=false
      break
    fi
  done
done

if [ "$all_valid" = false ]; then
  error "Fix the above .env issues and re-run setup.sh"
fi
success "All required environment variables are set"

# ─────────────────────────────────────────────────────────────
# STEP 3: Create required directories
# ─────────────────────────────────────────────────────────────
step "Step 3/7 — Creating directories"

DIRS=(
  "$PROJECT_DIR/logs"
  "$PROJECT_DIR/n8n/workflows"
  "$PROJECT_DIR/database/migrations"
  "$HOME/.cloudflared"
)

for dir in "${DIRS[@]}"; do
  if [ ! -d "$dir" ]; then
    mkdir -p "$dir"
    echo -e "  ${GRAY}Created: $dir${NC}"
  fi
done
success "Directories ready"

# ─────────────────────────────────────────────────────────────
# STEP 4: Cloudflare Tunnel setup
# ─────────────────────────────────────────────────────────────
step "Step 4/7 — Cloudflare Tunnel"

CREDS_FILE="$HOME/.cloudflared/credentials.json"

if [ -f "$CREDS_FILE" ]; then
  success "Cloudflare tunnel credentials found at $CREDS_FILE"
else
  warn "Cloudflare tunnel credentials not found."
  echo ""
  echo -e "${WHITE}  To create a new tunnel, run these commands:${NC}"
  echo ""
  echo -e "${GRAY}  # Install cloudflared (if not installed)${NC}"
  echo -e "${WHITE}  curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared${NC}"
  echo -e "${WHITE}  chmod +x /usr/local/bin/cloudflared${NC}"
  echo ""
  echo -e "${GRAY}  # Login and create tunnel${NC}"
  echo -e "${WHITE}  cloudflared tunnel login${NC}"
  echo -e "${WHITE}  cloudflared tunnel create safarizetu-ops${NC}"
  echo -e "${WHITE}  cloudflared tunnel route dns safarizetu-ops ops.safarizetu.com${NC}"
  echo -e "${WHITE}  cloudflared tunnel route dns safarizetu-ops n8n.safarizetu.com${NC}"
  echo -e "${WHITE}  cloudflared tunnel route dns safarizetu-ops dashboard.safarizetu.com${NC}"
  echo -e "${WHITE}  cloudflared tunnel route dns safarizetu-ops langfuse.safarizetu.com${NC}"
  echo ""
  warn "Skipping cloudflared service — start the stack without it for now."
  warn "Re-run this script after completing tunnel setup to add it."
  SKIP_CLOUDFLARE=true
fi

# ─────────────────────────────────────────────────────────────
# STEP 5: Build Docker images
# ─────────────────────────────────────────────────────────────
step "Step 5/7 — Building Docker images"

cd "$SCRIPT_DIR"

info "Building ops-engine image..."
if docker compose build ops-engine; then
  success "ops-engine image built"
else
  error "ops-engine build failed — check src/ TypeScript errors"
fi

info "Building dashboard image..."
if docker compose build ops-dashboard; then
  success "ops-dashboard image built"
else
  error "dashboard build failed — check dashboard/src/ errors"
fi

# ─────────────────────────────────────────────────────────────
# STEP 6: Start the stack
# ─────────────────────────────────────────────────────────────
step "Step 6/7 — Starting the stack"

info "Starting infrastructure (postgres, chroma, langfuse, n8n)..."
docker compose up -d postgres chroma langfuse n8n

info "Waiting for PostgreSQL to be healthy..."
for i in $(seq 1 30); do
  HEALTH=$(docker inspect --format='{{.State.Health.Status}}' ops_postgres 2>/dev/null || echo "starting")
  if [ "$HEALTH" = "healthy" ]; then
    success "PostgreSQL is healthy"
    break
  fi
  if [ "$i" = "30" ]; then
    error "PostgreSQL did not become healthy in time. Check: docker logs ops_postgres"
  fi
  printf "  Attempt %d/30 — status: %s\r" "$i" "$HEALTH"
  sleep 3
done

info "Starting Ops Engine..."
docker compose up -d ops-engine
sleep 5

info "Starting Dashboard..."
docker compose up -d ops-dashboard

# Start cloudflared only if credentials exist
if [ "${SKIP_CLOUDFLARE:-false}" = "false" ]; then
  info "Starting Cloudflare Tunnel..."
  # Copy credentials into the Docker volume
  VOLUME_PATH=$(docker volume inspect safarizetu-ops-engine_cloudflare_creds \
    --format '{{.Mountpoint}}' 2>/dev/null || echo "")
  if [ -n "$VOLUME_PATH" ]; then
    sudo cp "$CREDS_FILE" "$VOLUME_PATH/credentials.json"
  fi
  docker compose up -d cloudflared
  success "Cloudflare tunnel started"
fi

# ─────────────────────────────────────────────────────────────
# STEP 7: Verify all services
# ─────────────────────────────────────────────────────────────
step "Step 7/7 — Verifying services"

sleep 10

SERVICES=(
  "ops_postgres:PostgreSQL"
  "ops_langfuse:Langfuse"
  "ops_n8n:N8N"
  "ops_chroma:Chroma"
  "ops_engine:Ops Engine"
  "ops_dashboard:Dashboard"
)

all_running=true
for entry in "${SERVICES[@]}"; do
  container="${entry%%:*}"
  label="${entry##*:}"
  STATUS=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "not found")
  if [ "$STATUS" = "running" ]; then
    success "$label: running"
  else
    echo -e "  ${YELLOW}[WARN]${NC} $label: $STATUS"
    all_running=false
  fi
done

# Quick health check on Ops Engine HTTP
if curl -sf http://localhost:3000/health &>/dev/null; then
  success "Ops Engine health endpoint: OK"
else
  warn "Ops Engine health endpoint not responding yet — may still be starting"
fi

# ─────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}  Local services:${NC}"
echo -e "${WHITE}  PostgreSQL   →  localhost:5433${NC}"
echo -e "${WHITE}  N8N          →  http://localhost:5678${NC}"
echo -e "${WHITE}  Langfuse     →  http://localhost:3001${NC}"
echo -e "${WHITE}  Chroma       →  http://localhost:8001${NC}"
echo -e "${WHITE}  Ops Engine   →  http://localhost:3000/health${NC}"
echo -e "${WHITE}  Dashboard    →  http://localhost:3002${NC}"
echo ""

if [ "${SKIP_CLOUDFLARE:-false}" = "false" ]; then
  echo -e "${YELLOW}  Public URLs (via Cloudflare Tunnel):${NC}"
  echo -e "${WHITE}  https://ops.safarizetu.com      →  Ops Engine${NC}"
  echo -e "${WHITE}  https://n8n.safarizetu.com      →  N8N${NC}"
  echo -e "${WHITE}  https://dashboard.safarizetu.com →  Dashboard${NC}"
  echo -e "${WHITE}  https://langfuse.safarizetu.com  →  Langfuse${NC}"
  echo ""
fi

echo -e "${YELLOW}  Next steps:${NC}"
echo -e "${WHITE}  1. Open Langfuse at http://localhost:3001 and create your account${NC}"
echo -e "${WHITE}     → Copy the Public Key + Secret Key into .env${NC}"
echo -e "${WHITE}  2. Add env vars to Vercel for the Safari Zetu main app:${NC}"
echo -e "${WHITE}     OPS_ENGINE_API_KEY=${OPS_ENGINE_API_KEY}${NC}"
echo -e "${WHITE}     OPS_ENGINE_URL=https://ops.safarizetu.com${NC}"
echo -e "${WHITE}  3. Restart the stack to pick up Langfuse keys:${NC}"
echo -e "${WHITE}     docker compose restart ops-engine${NC}"
echo ""
echo -e "${GRAY}  Logs: docker compose logs -f ops-engine${NC}"
echo -e "${GRAY}  Stop: docker compose down${NC}"
echo ""
