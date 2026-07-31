import paramiko
import json

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd):
    _, o, _ = c.exec_command(cmd, timeout=30)
    return o.read().decode("utf-8", errors="replace").strip()

n8n_key = run("cat /opt/safarizetu-ops-engine/.env | grep N8N_API_KEY | cut -d= -f2-")

# Get full execution data
print("=== FULL EXECUTION 1 DATA ===")
out = run(f'curl -s "http://localhost:5678/api/v1/executions/1?includeData=true" -H "X-N8N-API-KEY: {n8n_key}"')
try:
    data = json.loads(out)
    rd = data.get('data', {}).get('resultData', {})
    run_data = rd.get('runData', {})
    for node_name, runs in run_data.items():
        print(f"\n--- Node: {node_name} ---")
        for i, r in enumerate(runs):
            print(f"  Run {i}:")
            print(f"    Status: {r.get('executionStatus', 'unknown')}")
            print(f"    Started: {r.get('startTime', '?')}")
            print(f"    Execution time: {r.get('executionTime', '?')}ms")
            if r.get('error'):
                print(f"    ERROR: {json.dumps(r['error'], indent=2)[:600]}")
            if r.get('data'):
                main_data = r.get('data', {}).get('main', [[]])
                for bi, branch in enumerate(main_data):
                    if branch:
                        for item in branch[:1]:
                            j = item.get('json', {})
                            print(f"    Output (branch {bi}): {json.dumps(j)[:300]}")
except Exception as ex:
    print(f"Error: {ex}")
    print(f"Raw: {out[:1000]}")

# Also check the latest execution
print("\n\n=== LATEST EXECUTIONS ===")
out = run(f'curl -s "http://localhost:5678/api/v1/executions?limit=5" -H "X-N8N-API-KEY: {n8n_key}"')
try:
    data = json.loads(out)
    for ex in data.get('data', []):
        print(f"  #{ex.get('id')}: {ex.get('workflowData',{}).get('name','?')} - {ex.get('status')} - {ex.get('startedAt','')[:19]}")
except:
    print(f"  Raw: {out[:300]}")

c.close()
