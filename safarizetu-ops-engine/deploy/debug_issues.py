import paramiko
import json

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd):
    _, o, _ = c.exec_command(cmd)
    return o.read().decode("utf-8", errors="replace").strip()

n8n_key = run("cat /opt/safarizetu-ops-engine/.env | grep N8N_API_KEY | cut -d= -f2-")

# 1. Get the failed execution details
print("=== FAILED EXECUTION DETAILS ===")
out = run(f'curl -s "http://localhost:5678/api/v1/executions/1" -H "X-N8N-API-KEY: {n8n_key}"')
try:
    data = json.loads(out)
    print(f"  Workflow: {data.get('workflowData',{}).get('name','?')}")
    print(f"  Status: {data.get('status','?')}")
    print(f"  Started: {data.get('startedAt','?')}")
    print(f"  Stopped: {data.get('stoppedAt','?')}")
    if 'data' in data and 'resultData' in data['data']:
        rd = data['data']['resultData']
        if 'error' in rd:
            print(f"  Error: {json.dumps(rd['error'], indent=2)[:500]}")
        if 'runData' in rd:
            for node_name, runs in rd['runData'].items():
                for run_data in runs:
                    if run_data.get('error'):
                        print(f"  Node '{node_name}' error: {json.dumps(run_data['error'], indent=2)[:300]}")
except:
    print(f"  Raw: {out[:500]}")

# 2. Check cron scheduler in ops_engine
print("\n=== CRON SCHEDULER STATUS ===")
out = run("docker exec ops_engine ps aux | grep -i cron")
print(f"  Processes: {out}")

print("\n=== CRON FULL LOGS ===")
out = run("docker logs ops_engine --tail 50 2>&1 | grep -i -E 'cron|schedule|tick|job|interval|timer'")
print(out if out else "  (no cron logs)")

# 3. Check API enquiries endpoint
print("\n=== API TEST - different endpoints ===")
for endpoint in ["/health", "/api/health", "/api/enquiries", "/api/v1/enquiries", "/api/cron/status", "/api/scheduler"]:
    out = run(f'curl -s -w "\\nHTTP_CODE:%{{http_code}}" http://localhost:3000{endpoint} -H "x-api-key: safarizetu-ops-api-key-2024"')
    lines = out.split("\n")
    code = [l for l in lines if l.startswith("HTTP_CODE:")]
    body = "\n".join([l for l in lines if not l.startswith("HTTP_CODE:")])
    print(f"  {endpoint} -> {code[0].split(':')[1] if code else '?'} | {body[:150]}")

# 4. Check ops_engine full logs for any errors
print("\n=== OPS ENGINE RECENT ERRORS ===")
out = run("docker logs ops_engine --since 1h 2>&1 | grep -i -E 'error|fail|exception|crash' | tail -10")
print(out if out else "  (no errors)")

# 5. Check Langfuse with proper auth
print("\n=== LANGFUSE TRACES (proper auth) ===")
out = run('curl -s "http://localhost:3001/api/public/traces?limit=3" -H "Authorization: Basic cGstbGYtNDRjYzk4YTQtOTM5OS00MjRlLTljOTQtMjFhNjI0ZjNiNjUyOnNrLWxmLTZkMjlmZWVlLTViNTEtNDQxYS04ZjgzLTVlNTE2ODE0ZTRyYg=="')
print(f"  Response: {out[:500]}")

c.close()
