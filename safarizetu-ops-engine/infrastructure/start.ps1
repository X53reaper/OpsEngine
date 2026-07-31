# Safari Zetu Ops Engine — Windows Start Script
# Starts the full Docker stack including ops-engine, dashboard, langfuse, cloudflared
# NOTE: For homelab/Linux environments use: infrastructure/setup.sh

$ErrorActionPreference = "Stop"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_DIR = Split-Path -Parent $SCRIPT_DIR

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Safari Zetu Ops Engine" -ForegroundColor Cyan
Write-Host "  Full Stack (Docker)" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Check Docker ──────────────────────────────────────
Write-Host "[1/5] Checking prerequisites..." -ForegroundColor Yellow

try {
    $dockerVersion = docker --version
    Write-Host "  Docker: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "  Docker not found! Install Docker Desktop:" -ForegroundColor Red
    Write-Host "  https://docs.docker.com/desktop/install/windows-install/" -ForegroundColor Yellow
    Write-Host "  After install, restart terminal and re-run this script." -ForegroundColor Yellow
    exit 1
}

try {
    $composeVersion = docker compose version
    Write-Host "  Docker Compose: $composeVersion" -ForegroundColor Green
} catch {
    Write-Host "  Docker Compose not found! Update Docker Desktop." -ForegroundColor Red
    exit 1
}

# ── Step 2: Validate .env ─────────────────────────────────────
Write-Host "[2/5] Checking environment config..." -ForegroundColor Yellow
$envFile = Join-Path $PROJECT_DIR ".env"
if (!(Test-Path $envFile)) {
    Write-Host "  .env file missing! Copy from .env.template and fill in values." -ForegroundColor Red
    exit 1
}

# Quick placeholder check
$envContent = Get-Content $envFile -Raw
$placeholders = @("generate_", "your_", "change_me")
foreach ($ph in $placeholders) {
    $lines = ($envContent -split "`n") | Where-Object { $_ -notmatch "^#" -and $_ -match $ph }
    if ($lines.Count -gt 0) {
        Write-Host "  WARNING: .env still contains placeholder values:" -ForegroundColor Yellow
        $lines | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    }
}
Write-Host "  .env file exists" -ForegroundColor Green

# ── Step 3: Build images ──────────────────────────────────────
Write-Host "[3/5] Building Docker images..." -ForegroundColor Yellow
Push-Location $SCRIPT_DIR
try {
    Write-Host "  Building ops-engine..." -ForegroundColor Gray
    docker compose build ops-engine
    Write-Host "  Building ops-dashboard..." -ForegroundColor Gray
    docker compose build ops-dashboard
    Write-Host "  Images built" -ForegroundColor Green
} finally {
    Pop-Location
}

# ── Step 4: Start the stack ───────────────────────────────────
Write-Host "[4/5] Starting the full stack..." -ForegroundColor Yellow
Push-Location $SCRIPT_DIR
try {
    # Start infrastructure first
    docker compose up -d postgres chroma langfuse n8n
    Write-Host "  Infrastructure starting..." -ForegroundColor Gray

    # Wait for postgres
    $retries = 30
    Write-Host "  Waiting for PostgreSQL..." -ForegroundColor Gray
    while ($retries -gt 0) {
        $health = docker inspect --format='{{.State.Health.Status}}' ops_postgres 2>$null
        if ($health -eq "healthy") {
            Write-Host "  PostgreSQL: healthy" -ForegroundColor Green
            break
        }
        $retries--
        Start-Sleep -Seconds 3
    }
    if ($retries -eq 0) {
        Write-Host "  PostgreSQL did not start in time. Check: docker logs ops_postgres" -ForegroundColor Red
        exit 1
    }

    # Start app services
    docker compose up -d ops-engine ops-dashboard

    # Start Cloudflare tunnel if credentials exist
    $credsFile = "$env:USERPROFILE\.cloudflared\credentials.json"
    if (Test-Path $credsFile) {
        docker compose up -d cloudflared
        Write-Host "  Cloudflare tunnel: starting" -ForegroundColor Green
    } else {
        Write-Host "  Cloudflare tunnel: skipped (no credentials found)" -ForegroundColor Yellow
        Write-Host "  Run: cloudflared tunnel login" -ForegroundColor Gray
    }

} finally {
    Pop-Location
}

# ── Step 5: Verify ────────────────────────────────────────────
Write-Host "[5/5] Verifying services..." -ForegroundColor Yellow
Start-Sleep -Seconds 12

$services = @(
    @{Name="PostgreSQL";  Container="ops_postgres";  Port="5433"},
    @{Name="Langfuse";    Container="ops_langfuse";  Port="3001"},
    @{Name="N8N";         Container="ops_n8n";       Port="5678"},
    @{Name="Chroma";      Container="ops_chroma";    Port="8001"},
    @{Name="Ops Engine";  Container="ops_engine";    Port="3000"},
    @{Name="Dashboard";   Container="ops_dashboard"; Port="3002"}
)

foreach ($svc in $services) {
    $status = docker inspect --format='{{.State.Status}}' $svc.Container 2>$null
    if ($status -eq "running") {
        Write-Host "  $($svc.Name): running (port $($svc.Port))" -ForegroundColor Green
    } else {
        Write-Host "  $($svc.Name): $status" -ForegroundColor Yellow
    }
}

# Quick health check on Ops Engine
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/health" -TimeoutSec 5
    Write-Host "  Ops Engine health: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "  Ops Engine not responding yet (may still be starting)" -ForegroundColor Yellow
}

# ── Summary ───────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Stack Running!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Local services:" -ForegroundColor Yellow
Write-Host "  PostgreSQL   ->  localhost:5433" -ForegroundColor White
Write-Host "  N8N          ->  http://localhost:5678" -ForegroundColor White
Write-Host "  Langfuse     ->  http://localhost:3001" -ForegroundColor White
Write-Host "  Chroma       ->  http://localhost:8001" -ForegroundColor White
Write-Host "  Ops Engine   ->  http://localhost:3000/health" -ForegroundColor White
Write-Host "  Dashboard    ->  http://localhost:3002" -ForegroundColor White
Write-Host ""
Write-Host "Public (Cloudflare Tunnel):" -ForegroundColor Yellow
Write-Host "  https://ops.safarizetu.com" -ForegroundColor White
Write-Host "  https://n8n.safarizetu.com" -ForegroundColor White
Write-Host "  https://dashboard.safarizetu.com" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Open Langfuse at http://localhost:3001, create account" -ForegroundColor White
Write-Host "     -> Copy Public + Secret keys into .env" -ForegroundColor Gray
Write-Host "  2. Restart engine to pick up Langfuse keys:" -ForegroundColor White
Write-Host "     docker compose restart ops-engine" -ForegroundColor Gray
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Yellow
Write-Host "  docker compose logs -f ops-engine   (watch engine logs)" -ForegroundColor Gray
Write-Host "  docker compose down                  (stop everything)" -ForegroundColor Gray
Write-Host "  docker compose restart ops-engine    (restart engine only)" -ForegroundColor Gray
Write-Host ""
