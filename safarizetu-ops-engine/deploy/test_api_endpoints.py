import paramiko
import json

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd):
    _, o, _ = c.exec_command(cmd)
    return o.read().decode("utf-8", errors="replace").strip()

# 1. Server time
print("=== SERVER TIME ===")
print(run("date"))

# 2. Test actual API endpoints
print("\n=== API ENDPOINTS TEST ===")
endpoints = [
    ("GET", "/health"),
    ("GET", "/metrics"),
    ("GET", "/api/skills"),
    ("GET", "/api/competitors"),
    ("GET", "/api/content/pending"),
    ("GET", "/api/memories/pending"),
    ("GET", "/api/research/domains"),
    ("GET", "/api/learning/status"),
    ("GET", "/api/competitors/landscape"),
]
for method, ep in endpoints:
    out = run(f'curl -s -w "\\nHTTP:%{{http_code}}" http://localhost:3000{ep}')
    lines = out.split("\n")
    code = [l for l in lines if l.startswith("HTTP:")]
    body = "\n".join([l for l in lines if not l.startswith("HTTP:")])[:150]
    print(f"  {method} {ep} -> {code[0].split(':')[1] if code else '?'} | {body}")

# 3. Check cron logs - look for any activity after startup
print("\n=== CRON ACTIVITY (all logs since startup) ===")
out = run("docker logs ops_engine 2>&1 | grep -v 'Safari Zetu' | grep -v 'Integrated' | grep -v 'Health:' | grep -v 'Webhook:' | grep -v 'HTTP server' | tail -20")
print(out if out else "  (no activity)")

# 4. Check if enquiry check is actually failing or just no data
print("\n=== ENQUIRY CHECK ERROR DETAILS ===")
out = run("docker logs ops_engine 2>&1 | grep -i 'Enquiry check failed' | tail -3")
print(out if out else "  (no errors)")

# 5. Check what fetchFromSafariZetu returns
print("\n=== SAFARIZETU API TEST ===")
out = run("docker exec ops_engine curl -s 'http://host.docker.internal:3000/enquiries?since=2026-06-18T00:00:00Z&limit=5' 2>&1 | head -c 500")
print(f"  Response: {out}")

# 6. Check n8n workflow execution details
n8n_key = run("cat /opt/safarizetu-ops-engine/.env | grep N8N_API_KEY | cut -d= -f2-")
print("\n=== N8N WORKFLOW EXECUTION DETAILS ===")
out = run(f'curl -s "http://localhost:5678/api/v1/executions?limit=3" -H "X-N8N-API-KEY: {n8n_key}"')
try:
    data = json.loads(out)
    if "data" in data:
        for ex in data["data"][:3]:
            print(f"\n  Execution {ex.get('id','?')}:")
            print(f"    Workflow: {ex.get('workflowData',{}).get('name','?')}")
            print(f"    Status: {ex.get('status','?')}")
            print(f"    Started: {ex.get('startedAt','?')}")
            print(f"    Stopped: {ex.get('stoppedAt','?')}")
            if ex.get('data',{}).get('resultData',{}).get('error'):
                print(f"    Error: {json.dumps(ex['data']['resultData']['error'])[:200]}")
except:
    print(f"  Raw: {out[:300]}")

c.close()
