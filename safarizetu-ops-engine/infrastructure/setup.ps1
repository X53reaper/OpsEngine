# Safari Zetu Ops Engine — Full Setup Script (Windows)
# Run this ONCE on a fresh machine after installing Docker Desktop
# For Linux homelab use: infrastructure/setup.sh instead

$ErrorActionPreference = "Stop"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_DIR = Split-Path -Parent $SCRIPT_DIR

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Safari Zetu Ops Engine — Full Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Check prerequisites ──────────────────────────────
Write-Host "[1/7] Checking prerequisites..." -ForegroundColor Yellow

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

# Verify Docker daemon is running
try {
    docker info 2>&1 | Out-Null
    Write-Host "  Docker daemon: running" -ForegroundColor Green
} catch {
    Write-Host "  Docker daemon is not running — start Docker Desktop first" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ── Step 2: Validate .env ─────────────────────────────────────
Write-Host "[2/7] Checking environment config..." -ForegroundColor Yellow
$envFile = Join-Path $PROJECT_DIR ".env"

if (!(Test-Path $envFile)) {
    Write-Host "  .env file missing!" -ForegroundColor Red
    Write-Host "  Copying .env.template to .env..." -ForegroundColor Yellow
    $templateFile = Join-Path $PROJECT_DIR ".env.template"
    if (Test-Path $templateFile) {
        Copy-Item $templateFile $envFile
        Write-Host "  Done. Fill in all secrets in .env then re-run this script." -ForegroundColor Yellow
    } else {
        Write-Host "  .env.template also missing — check your project files" -ForegroundColor Red
    }
    exit 1
}

# Quick placeholder scan
$placeholders = @("generate_", "your_", "change_me")
$envContent = Get-Content $envFile
$issues = @()
foreach ($line in $envContent) {
    if ($line -match "^#" -or $line -match "^\s*$") { continue }
    foreach ($ph in $placeholders) {
        if ($line -match $ph) {
            $issues += $line
            break
        }
    }
}
if ($issues.Count -gt 0) {
    Write-Host "  WARNING: .env still has placeholder values:" -ForegroundColor Yellow
    foreach ($issue in $issues) {
        Write-Host "    $issue" -ForegroundColor Gray
    }
    Write-Host "  (continuing anyway — fix before production use)" -ForegroundColor Yellow
} else {
    Write-Host "  .env looks good — no placeholder values found" -ForegroundColor Green
}

Write-Host ""

# ── Step 3: Create required directories ──────────────────────
Write-Host "[3/7] Creating directories..." -ForegroundColor Yellow
$dirs = @(
    (Join-Path $PROJECT_DIR "logs"),
    (Join-Path $PROJECT_DIR "n8n\workflows"),
    (Join-Path $PROJECT_DIR "database\migrations")
)
foreach ($dir in $dirs) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  Created: $dir" -ForegroundColor Gray
    }
}
Write-Host "  Directories ready" -ForegroundColor Green
Write-Host ""

# ── Step 4: Build Docker images ───────────────────────────────
Write-Host "[4/7] Building Docker images..." -ForegroundColor Yellow
Push-Location $SCRIPT_DIR
try {
    Write-Host "  Building ops-engine..." -ForegroundColor Gray
    docker compose build --no-cache ops-engine
    if ($LASTEXITCODE -ne 0) { throw "ops-engine build failed" }
    Write-Host "  ops-engine: built" -ForegroundColor Green

    Write-Host "  Building ops-dashboard..." -ForegroundColor Gray
    docker compose build --no-cache ops-dashboard
    if ($LASTEXITCODE -ne 0) { throw "ops-dashboard build failed" }
    Write-Host "  ops-dashboard: built" -ForegroundColor Green
} finally {
    Pop-Location
}
Write-Host ""

# ── Step 5: Start infrastructure services ─────────────────────
Write-Host "[5/7] Starting infrastructure..." -ForegroundColor Yellow
Push-Location $SCRIPT_DIR
try {
    docker compose up -d postgres chroma langfuse n8n
    Write-Host "  Services starting..." -ForegroundColor Gray

    Write-Host "  Waiting for PostgreSQL to be healthy..." -ForegroundColor Gray
    $retries = 30
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
        Write-Host "  PostgreSQL didn't become healthy — check: docker logs ops_postgres" -ForegroundColor Red
        exit 1
    }

    # Start app services
    docker compose up -d ops-engine ops-dashboard
    Write-Host "  Ops engine + dashboard: starting" -ForegroundColor Green

    # Start Cloudflare tunnel if credentials exist
    $credsFile = "$env:USERPROFILE\.cloudflared\credentials.json"
    if (Test-Path $credsFile) {
        docker compose up -d cloudflared
        Write-Host "  Cloudflare tunnel: starting" -ForegroundColor Green
    } else {
        Write-Host "  Cloudflare tunnel: skipped (no credentials)" -ForegroundColor Yellow
        Write-Host "  Run: cloudflared tunnel login" -ForegroundColor Gray
    }
} finally {
    Pop-Location
}
Write-Host ""

# ── Step 6: Verify services ───────────────────────────────────
Write-Host "[6/7] Verifying services..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

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

try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/health" -TimeoutSec 8
    Write-Host "  Ops Engine health: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "  Ops Engine health check: still starting (check in 30s)" -ForegroundColor Yellow
}
Write-Host ""

# ── Step 7: Cloudflare tunnel one-time setup ──────────────────
Write-Host "[7/7] Cloudflare Tunnel setup..." -ForegroundColor Yellow
$credsFile = "$env:USERPROFILE\.cloudflared\credentials.json"
if (!(Test-Path $credsFile)) {
    Write-Host ""
    Write-Host "  To set up Cloudflare tunnel (one-time):" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  1. Install cloudflared:" -ForegroundColor White
    Write-Host "     winget install cloudflare.cloudflared" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  2. Login (opens browser):" -ForegroundColor White
    Write-Host "     cloudflared tunnel login" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  3. Create tunnel:" -ForegroundColor White
    Write-Host "     cloudflared tunnel create safarizetu-ops" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  4. Add DNS routes:" -ForegroundColor White
    Write-Host "     cloudflared tunnel route dns safarizetu-ops ops.safarizetu.com" -ForegroundColor Gray
    Write-Host "     cloudflared tunnel route dns safarizetu-ops n8n.safarizetu.com" -ForegroundColor Gray
    Write-Host "     cloudflared tunnel route dns safarizetu-ops dashboard.safarizetu.com" -ForegroundColor Gray
    Write-Host "     cloudflared tunnel route dns safarizetu-ops langfuse.safarizetu.com" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  5. Re-run this script to activate the tunnel." -ForegroundColor White
} else {
    Write-Host "  Cloudflare tunnel credentials found — tunnel is running" -ForegroundColor Green
}

# ── Summary ───────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Green
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
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Open Langfuse at http://localhost:3001" -ForegroundColor White
Write-Host "     -> Create account -> copy Public + Secret keys into .env" -ForegroundColor Gray
Write-Host "  2. Restart engine to pick up Langfuse keys:" -ForegroundColor White
Write-Host "     docker compose restart ops-engine" -ForegroundColor Gray
Write-Host "  3. Add to Vercel env vars:" -ForegroundColor White
Write-Host "     OPS_ENGINE_URL=https://ops.safarizetu.com" -ForegroundColor Gray
Write-Host "     OPS_ENGINE_API_KEY=<from .env>" -ForegroundColor Gray
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Yellow
Write-Host "  docker compose logs -f ops-engine   (watch engine logs)" -ForegroundColor Gray
Write-Host "  docker compose down                  (stop everything)" -ForegroundColor Gray
Write-Host "  docker compose restart ops-engine    (restart engine)" -ForegroundColor Gray
Write-Host ""
Write-Host "Done!" -ForegroundColor Green
