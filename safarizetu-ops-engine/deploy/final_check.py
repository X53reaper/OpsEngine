import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd):
    _, o, _ = c.exec_command(cmd)
    return o.read().decode("utf-8", errors="replace").strip()

# 1. Dashboard content check
print("=== DASHBOARD CONTENT ===")
out = run("curl -s http://localhost:3002/ | head -c 500")
print(out)

# 2. Dashboard assets
print("\n=== DASHBOARD ASSETS ===")
out = run("curl -s http://localhost:3002/ | grep -o 'src=\"[^\"]*\"' | head -5")
print(out if out else "  (no src attributes found)")

# 3. Public dashboard
print("\n=== PUBLIC DASHBOARD ===")
out = run("curl -s -o /dev/null -w '%{http_code}' https://dashboard.safarizetu.com")
print(f"  Status: {out}")

# 4. Dashboard container logs
print("\n=== DASHBOARD CONTAINER LOGS ===")
out = run("docker logs ops_dashboard --tail 10 2>&1")
print(out)

# 5. Langfuse traces
print("\n=== LANGFUSE TRACES ===")
import base64
creds = base64.b64encode(b"pk-lf-44cc98a4-9399-424e-9c94-21a624f3b652:sk-lf-6d29feee-5b51-441a-8f83-5e516814e42b").decode()
out = run(f'curl -s "http://localhost:3001/api/public/traces?limit=5" -H "Authorization: Basic {creds}"')
print(f"  Response: {out[:500]}")

# 6. Langfuse generations
print("\n=== LANGFUSE GENERATIONS ===")
out = run(f'curl -s "http://localhost:3001/api/public/generations?limit=3" -H "Authorization: Basic {creds}"')
print(f"  Response: {out[:500]}")

# 7. Final summary
print("\n=== FINAL STATUS SUMMARY ===")
containers = run("docker ps --format '{{.Names}}: {{.Status}}'")
print(containers)

c.close()
