import paramiko
import json

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd):
    _, o, _ = c.exec_command(cmd, timeout=60)
    return o.read().decode("utf-8", errors="replace").strip()

n8n_key = run("cat /opt/safarizetu-ops-engine/.env | grep N8N_API_KEY | cut -d= -f2-")

# 1. Get the Competitor Price Monitor workflow details
print("=== N8N WORKFLOW: Competitor Price Monitor ===")
out = run(f'curl -s "http://localhost:5678/api/v1/workflows/3ORPVNZtQByEZp4K" -H "X-N8N-API-KEY: {n8n_key}"')
try:
    data = json.loads(out)
    print(f"  Name: {data.get('name')}")
    print(f"  Active: {data.get('active')}")
    nodes = data.get('nodes', [])
    print(f"  Nodes: {len(nodes)}")
    for n in nodes:
        print(f"    - {n.get('name')} ({n.get('type')})")
except:
    print(f"  Raw: {out[:500]}")

# 2. Get execution details for the failed one
print("\n=== FAILED EXECUTION DETAILS ===")
out = run(f'curl -s "http://localhost:5678/api/v1/executions/1" -H "X-N8N-API-KEY: {n8n_key}"')
try:
    data = json.loads(out)
    print(f"  Status: {data.get('status')}")
    print(f"  Started: {data.get('startedAt')}")
    print(f"  Stopped: {data.get('stoppedAt')}")
    rd = data.get('data', {}).get('resultData', {})
    if 'error' in rd:
        print(f"  Error: {json.dumps(rd['error'])[:500]}")
    run_data = rd.get('runData', {})
    for node_name, runs in run_data.items():
        for r in runs:
            if r.get('error'):
                print(f"  Node '{node_name}' error: {json.dumps(r['error'])[:300]}")
            if r.get('data', {}).get('main'):
                for branch in r['data']['main']:
                    if branch:
                        for item in branch[:2]:
                            print(f"  Node '{node_name}' output: {json.dumps(item.get('json', {}))[:200]}")
except Exception as ex:
    print(f"  Parse error: {ex}")
    print(f"  Raw: {out[:500]}")

# 3. Check enquiry check error - what URL is it trying to hit?
print("\n=== ENQUIRY CHECK - WHAT URL? ===")
out = run("docker exec ops_engine grep -r 'fetchFromSafariZetu' /app/src/ | head -10")
print(out)

# 4. Check the fetchFromSafariZetu function
print("\n=== FETCH FUNCTION ===")
out = run("docker exec ops_engine cat /app/src/services/ai-agent.service.ts 2>/dev/null | grep -A 20 'fetchFromSafariZetu'")
print(out[:800] if out else "  (not found)")

# 5. Check SafariZetu API URL in .env
print("\n=== SAFARIZETU API URL ===")
out = run("cat /opt/safarizetu-ops-engine/.env | grep -i 'SAFARIZETU\\|API_URL\\|BASE_URL'")
print(out)

# 6. Test internal connectivity from ops_engine
print("\n=== INTERNAL CONNECTIVITY TEST ===")
out = run("docker exec ops_engine curl -s -o /dev/null -w '%{http_code}' http://host.docker.internal:3000/health 2>&1")
print(f"  host.docker.internal:3000 -> {out}")
out = run("docker exec ops_engine curl -s -o /dev/null -w '%{http_code}' http://172.18.0.1:3000/health 2>&1")
print(f"  172.18.0.1:3000 -> {out}")
out = run("docker exec ops_engine curl -s -o /dev/null -w '%{http_code}' http://192.168.18.50:3000/health 2>&1")
print(f"  192.168.18.50:3000 -> {out}")

c.close()
