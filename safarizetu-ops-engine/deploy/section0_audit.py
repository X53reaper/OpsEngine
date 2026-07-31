import paramiko
import time

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

# Section 0: Environment and State Audit
print("=" * 60)
print("  SECTION 0 — ENVIRONMENT AND STATE AUDIT")
print("=" * 60)

# Confirm where we are
print("\n--- HOST INFO ---")
print(run("hostname"))
print(run("cat /etc/os-release | head -3"))

# Docker containers
print("\n--- DOCKER CONTAINERS ---")
print(run("docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"))

# Node.js
print("\n--- NODE.JS ---")
print(run("node --version"))
print(run("npm --version"))

# Ops engine process
print("\n--- OPS ENGINE PROCESS ---")
print(run("ps aux | grep node | grep -v grep | head -5"))

# .env keys
print("\n--- ENV KEYS ---")
print(run("cat /opt/safarizetu-ops-engine/.env | grep -oE '^[A-Z_]+=' | sed 's/=$//' | sort"))

# PostgreSQL connectivity
print("\n--- POSTGRESQL ---")
print(run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c 'SELECT NOW();'"))

# Table count
print("\n--- TABLE COUNT ---")
print(run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c \"SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';\""))

# n8n
print("\n--- N8N ---")
print(run("curl -s -o /dev/null -w 'n8n status: %{http_code}' http://localhost:5678/healthz"))

# Cloudflare Tunnel
print("\n--- CLOUDFLARE TUNNEL ---")
print(run("docker ps | grep cloudflare"))
print(run("docker logs ops_cloudflared --since 1h 2>&1 | tail -3"))

# Public URL
print("\n--- PUBLIC URL ---")
print(run("curl -s -o /dev/null -w 'Public URL status: %{http_code}' https://ops.safarizetu.com/health"))

# OPS_ENGINE_URL
print("\n--- OPS ENGINE URL ---")
print(run("grep OPS_ENGINE_URL /opt/safarizetu-ops-engine/.env | head -1"))

# Health endpoint
print("\n--- HEALTH ENDPOINT ---")
print(run("curl -s http://localhost:3000/health"))

# Langfuse
print("\n--- LANGFUSE ---")
print(run("curl -s http://localhost:3001/api/public/health"))

c.close()
