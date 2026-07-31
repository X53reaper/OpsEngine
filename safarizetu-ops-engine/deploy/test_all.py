import paramiko
import json

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd):
    _, o, _ = c.exec_command(cmd)
    return o.read().decode("utf-8", errors="replace").strip()

# 1. N8N Workflows
print("=== N8N WORKFLOWS ===")
out = run("curl -s http://localhost:5678/api/v1/workflows")
try:
    data = json.loads(out)
    if "data" in data:
        for w in data["data"]:
            print(f"  [{w.get('active','?')}] {w.get('name','?')} (id={w.get('id','?')})")
    else:
        print(f"  Response: {out[:500]}")
except:
    print(f"  Raw: {out[:500]}")

# 2. N8N health
print("\n=== N8N HEALTH ===")
print(run("curl -s http://localhost:5678/healthz"))

# 3. API Health
print("\n=== API HEALTH ===")
print(run("curl -s http://localhost:3000/health"))

# 4. Langfuse health
print("\n=== LANGFUSE HEALTH ===")
print(run("curl -s http://localhost:3001/api/public/health"))

# 5. Cron scheduler status
print("\n=== CRON SCHEDULER (ops_engine logs) ===")
print(run("docker logs ops_engine --tail 30 2>&1 | grep -i -E 'cron|schedule|tick|job' | tail -10"))

# 6. Dashboard
print("\n=== DASHBOARD ===")
print(run("curl -s -o /dev/null -w '%{http_code}' http://localhost:3002/"))

# 7. ChromaDB
print("\n=== CHROMADB ===")
print(run("curl -s http://localhost:8001/api/v1/heartbeat"))

# 8. Container health
print("\n=== CONTAINER HEALTH ===")
print(run("docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"))

# 9. Public tunnel URLs
print("\n=== PUBLIC URLS (via cloudflare) ===")
for url in ["ops.safarizetu.com/health", "dashboard.safarizetu.com", "n8n.safarizetu.com", "langfuse.safarizetu.com"]:
    code = run(f"curl -s -o /dev/null -w '%{{http_code}}' https://{url}")
    print(f"  https://{url} -> {code}")

c.close()
