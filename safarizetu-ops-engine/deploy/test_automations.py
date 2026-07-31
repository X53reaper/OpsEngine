import paramiko
import json

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd):
    _, o, _ = c.exec_command(cmd)
    return o.read().decode("utf-8", errors="replace").strip()

# Read N8N API key from .env
env_out = run("cat /opt/safarizetu-ops-engine/.env | grep N8N_API_KEY")
print(f"API key line: {env_out}")

# Try with API key
n8n_key = run("cat /opt/safarizetu-ops-engine/.env | grep N8N_API_KEY | cut -d= -f2-")
print(f"N8N API key: {n8n_key[:20]}...")

print("\n=== N8N WORKFLOWS (with API key) ===")
out = run(f'curl -s http://localhost:5678/api/v1/workflows -H "X-N8N-API-KEY: {n8n_key}"')
try:
    data = json.loads(out)
    if "data" in data:
        for w in data["data"]:
            active = w.get("active", False)
            name = w.get("name", "?")
            wf_id = w.get("id", "?")
            print(f"  [{'ACTIVE' if active else 'INACTIVE'}] {name} (id={wf_id})")
    else:
        print(f"  Response: {out[:500]}")
except:
    print(f"  Raw: {out[:500]}")

# Test webhook endpoint
print("\n=== WEBHOOK TEST ===")
out = run('curl -s -X POST http://localhost:5678/webhook/test-webhook -H "Content-Type: application/json" -d \'{"test": true}\'')
print(f"  Webhook response: {out[:300]}")

# Check recent n8n execution logs
print("\n=== N8N RECENT EXECUTIONS ===")
out = run(f'curl -s "http://localhost:5678/api/v1/executions?limit=5" -H "X-N8N-API-KEY: {n8n_key}"')
try:
    data = json.loads(out)
    if "data" in data:
        for ex in data["data"][:5]:
            print(f"  [{ex.get('status','?')}] Workflow {ex.get('workflowId','?')} - {ex.get('startedAt','?')}")
    else:
        print(f"  Response: {out[:500]}")
except:
    print(f"  Raw: {out[:500]}")

# Check ops_engine recent logs for cron ticks
print("\n=== CRON TICKS (last 10 min) ===")
out = run("docker logs ops_engine --since 10m 2>&1 | grep -i -E 'tick|cron|schedule|agent.*run' | tail -15")
print(out if out else "  (no recent cron activity)")

# Check Langfuse recent traces
print("\n=== LANGFUSE RECENT TRACES ===")
out = run('curl -s "http://localhost:3001/api/public/traces?limit=5" -H "Authorization: Basic $(echo -n pk-lf-44cc98a4-9399-424e-9c94-21a624f3b652:sk-lf-6d29feee-5b51-441a-8f83-5e516814e42b | base64)"')
try:
    data = json.loads(out)
    if "data" in data:
        for t in data["data"][:5]:
            print(f"  {t.get('name','unnamed')} - {t.get('timestamp','?')[:19]}")
    else:
        print(f"  Response: {out[:500]}")
except:
    print(f"  Raw: {out[:500]}")

# Test API enquiry endpoint
print("\n=== API ENQUIRY ENDPOINT ===")
out = run('curl -s http://localhost:3000/api/enquiries -H "x-api-key: safarizetu-ops-api-key-2024"')
try:
    data = json.loads(out)
    print(f"  Enquiries count: {len(data) if isinstance(data, list) else 'N/A'}")
    print(f"  Response keys: {list(data.keys()) if isinstance(data, dict) else 'list'}")
except:
    print(f"  Response: {out[:300]}")

c.close()
