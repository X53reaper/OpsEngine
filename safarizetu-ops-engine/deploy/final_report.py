import paramiko
import json

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd):
    _, o, _ = c.exec_command(cmd, timeout=30)
    return o.read().decode("utf-8", errors="replace").strip()

print("=" * 60)
print("  SAFARIZETU OPS ENGINE - FINAL STATUS REPORT")
print("=" * 60)

# 1. Container status
print("\n--- CONTAINERS ---")
out = run("docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'")
print(out)

# 2. API Health
print("\n--- API HEALTH ---")
out = run("curl -s http://localhost:3000/health")
try:
    h = json.loads(out)
    print(f"  Status: {h['status']}")
    print(f"  Langfuse: {h['langfuse']}")
    print(f"  Uptime: {h['uptime']:.0f}s")
except:
    print(f"  {out}")

# 3. Metrics
print("\n--- METRICS ---")
out = run("curl -s http://localhost:3000/metrics")
try:
    m = json.loads(out)
    print(f"  Traces: {m['total_traces']}")
    print(f"  Tokens: {m['total_tokens']}")
    print(f"  Cost: ${m['total_cost_usd']:.4f}")
    print(f"  Avg latency: {m['avg_latency_ms']:.0f}ms")
    print(f"  Models: {list(m['cost_by_model'].keys())}")
except:
    print(f"  {out}")

# 4. Skills
print("\n--- SKILLS ---")
out = run("curl -s http://localhost:3000/api/skills")
try:
    s = json.loads(out)
    print(f"  Count: {s['count']}")
    for sk in s['skills']:
        print(f"    - {sk['category']}/{sk['name']} ({sk['size']} bytes)")
except:
    print(f"  {out}")

# 5. Competitors
print("\n--- COMPETITORS ---")
out = run("curl -s http://localhost:3000/api/competitors")
try:
    comp = json.loads(out)
    print(f"  Count: {comp['count']}")
    for c_item in comp['competitors'][:5]:
        print(f"    - {c_item['name']} ({c_item['platform']})")
except:
    print(f"  {out}")

# 6. Langfuse traces
print("\n--- LANGFUSE TRACES ---")
import base64
creds = base64.b64encode(b"pk-lf-44cc98a4-9399-424e-9c94-21a624f3b652:sk-lf-6d29feee-5b51-441a-8f83-5e516814e42b").decode()
out = run(f'curl -s "http://localhost:3001/api/public/traces?limit=5" -H "Authorization: Basic {creds}"')
try:
    t = json.loads(out)
    for tr in t.get('data', []):
        print(f"  {tr['name']} - {tr['timestamp'][:19]}")
except:
    print(f"  {out[:200]}")

# 7. N8N workflows
print("\n--- N8N WORKFLOWS ---")
n8n_key = run("cat /opt/safarizetu-ops-engine/.env | grep N8N_API_KEY | cut -d= -f2-")
out = run(f'curl -s "http://localhost:5678/api/v1/workflows" -H "X-N8N-API-KEY: {n8n_key}"')
try:
    wf = json.loads(out)
    for w in wf.get('data', []):
        print(f"  [{'ACTIVE' if w.get('active') else 'INACTIVE'}] {w.get('name')}")
except:
    print(f"  {out[:200]}")

# 8. Cron scheduler
print("\n--- CRON SCHEDULER ---")
out = run("docker logs ops_engine --since 1h 2>&1 | grep -i -E 'running|completed|error' | tail -10")
print(out if out else "  (no recent activity)")

# 9. Public URLs
print("\n--- PUBLIC URLS ---")
for name, url in [
    ("API", "ops.safarizetu.com/health"),
    ("Dashboard", "dashboard.safarizetu.com"),
    ("N8N", "n8n.safarizetu.com"),
    ("Langfuse", "langfuse.safarizetu.com"),
]:
    code = run(f"curl -s -o /dev/null -w '%{{http_code}}' https://{url}")
    status = "OK" if code == "200" else f"FAIL ({code})"
    print(f"  {name}: https://{url} -> {status}")

# 10. Database
print("\n--- DATABASE ---")
out = run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c \"SELECT (SELECT COUNT(*) FROM enquiry_log) as enquiries, (SELECT COUNT(*) FROM approval_queue) as approvals, (SELECT COUNT(*) FROM competitor_content) as competitor_content, (SELECT COUNT(*) FROM lead_pipeline) as leads, (SELECT COUNT(*) FROM content_queue) as content_queue;\"")
print(out)

print("\n" + "=" * 60)
print("  STATUS COMPLETE")
print("=" * 60)

c.close()
