import paramiko
import json

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd):
    _, o, _ = c.exec_command(cmd, timeout=60)
    return o.read().decode("utf-8", errors="replace").strip()

n8n_key = run("cat /opt/safarizetu-ops-engine/.env | grep N8N_API_KEY | cut -d= -f2-")

# 1. Get the full workflow definition to see HTTP request URLs
print("=== N8N WORKFLOW: Full Node Details ===")
out = run(f'curl -s "http://localhost:5678/api/v1/workflows/3ORPVNZtQByEZp4K" -H "X-N8N-API-KEY: {n8n_key}"')
try:
    data = json.loads(out)
    nodes = data.get('nodes', [])
    for n in nodes:
        print(f"\n  Node: {n.get('name')} ({n.get('type')})")
        params = n.get('parameters', {})
        print(f"    Parameters: {json.dumps(params, indent=4)[:500]}")
except:
    print(f"  Raw: {out[:800]}")

# 2. Test the SafariZetu bridge URL
print("\n=== SAFARIZETU BRIDGE TEST ===")
out = run("curl -s -o /dev/null -w '%{http_code}' 'https://safarizetu.com/api/ops-bridge?resource=enquiries&since=2026-06-18T00:00:00Z&limit=5' -H 'x-ops-api-key: test' 2>&1")
print(f"  https://safarizetu.com/api/ops-bridge -> {out}")

# 3. Check what SAFARI_ZETU_API_KEY is set to
print("\n=== API KEY ===")
out = run("cat /opt/safarizetu-ops-engine/.env | grep SAFARI_ZETU_API_KEY")
print(out)

# 4. Test the bridge with the actual API key
print("\n=== BRIDGE WITH ACTUAL KEY ===")
api_key = run("cat /opt/safarizetu-ops-engine/.env | grep SAFARI_ZETU_API_KEY | cut -d= -f2-")
out = run(f"curl -s 'https://safarizetu.com/api/ops-bridge?resource=enquiries&since=2026-06-18T00:00:00Z&limit=5' -H 'x-ops-api-key: {api_key}' 2>&1 | head -c 500")
print(f"  Response: {out}")

# 5. Alternative: Check if we can query local DB for enquiries
print("\n=== LOCAL DB ENQUIRY TABLES ===")
out = run("docker exec ops_engine psql $DATABASE_URL -c '\\dt *enquiry*' 2>&1 || docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c '\\dt *enquiry*' 2>&1")
print(out)

# 6. Check enquiry_log table
print("\n=== ENQUIRY_LOG TABLE ===")
out = run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c 'SELECT COUNT(*) as total, MAX(created_at) as latest FROM enquiry_log;' 2>&1")
print(out)

c.close()
