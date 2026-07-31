import paramiko
import json

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd):
    _, o, _ = c.exec_command(cmd, timeout=30)
    return o.read().decode("utf-8", errors="replace").strip()

# 1. Check DNS resolution from n8n container
print("=== N8N DNS RESOLUTION ===")
out = run("docker exec ops_n8n nslookup ops-engine 2>&1 || docker exec ops_n8n getent hosts ops-engine 2>&1")
print(out)

# 2. Check if n8n can reach ops-engine
print("\n=== N8N -> OPS-ENGINE CONNECTIVITY ===")
out = run("docker exec ops_n8n curl -s -o /dev/null -w '%{http_code}' http://ops-engine:3000/health 2>&1")
print(f"  http://ops-engine:3000/health -> {out}")

# 3. Check n8n container network
print("\n=== N8N NETWORK ===")
out = run("docker inspect ops_n8n --format='{{range .NetworkSettings.Networks}}Network: {{.NetworkID}} IP: {{.IPAddress}}{{end}}'")
print(out)

# 4. Check ops_engine container network
print("\n=== OPS_ENGINE NETWORK ===")
out = run("docker inspect ops_engine --format='{{range .NetworkSettings.Networks}}Network: {{.NetworkID}} IP: {{.IPAddress}}{{end}}'")
print(out)

# 5. Test the n8n workflow manually - call the endpoints directly
print("\n=== MANUAL WORKFLOW TEST ===")
out = run("curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3000/api/competitors/scan")
print(f"  POST /api/competitors/scan -> {out}")
out = run("curl -s http://localhost:3000/api/competitors/landscape | head -c 300")
print(f"  GET /api/competitors/landscape -> {out}")

# 6. Check the n8n execution error in more detail
n8n_key = run("cat /opt/safarizetu-ops-engine/.env | grep N8N_API_KEY | cut -d= -f2-")
print("\n=== N8N EXECUTION 1 - FULL ERROR ===")
out = run(f'curl -s "http://localhost:5678/api/v1/executions/1" -H "X-N8N-API-KEY: {n8n_key}"')
try:
    data = json.loads(out)
    rd = data.get('data', {}).get('resultData', {})
    run_data = rd.get('runData', {})
    for node_name, runs in run_data.items():
        for r in runs:
            print(f"\n  Node: {node_name}")
            print(f"    Execution status: {r.get('executionStatus', 'unknown')}")
            if r.get('error'):
                print(f"    Error: {json.dumps(r['error'], indent=4)[:500]}")
            if r.get('data', {}).get('main'):
                for branch in r['data']['main']:
                    if branch:
                        for item in branch[:1]:
                            print(f"    Output: {json.dumps(item.get('json', {}))[:300]}")
except Exception as ex:
    print(f"  Parse error: {ex}")

c.close()
