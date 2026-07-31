#!/usr/bin/env python3
"""Full pipeline test - LLM, Langfuse, n8n, skills, all services"""
import paramiko, json, time

HOST = "192.168.18.50"
USER = "root"
PASS = "123456789"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, 22, USER, PASS)

print("=" * 60)
print("FULL PIPELINE TEST")
print("=" * 60)

# 1. Health check
stdin, stdout, stderr = client.exec_command('curl -s http://localhost:3000/health')
health = stdout.read().decode().strip()
print(f"\n1. Health: {health}")

# 2. Skills count
stdin, stdout, stderr = client.exec_command('curl -s http://localhost:3000/api/skills')
skills = json.loads(stdout.read().decode().strip())
print(f"2. Skills: {skills['count']} loaded across {len(set(s['category'] for s in skills['skills']))} categories")

# 3. LLM call - Research endpoint
print("\n3. Testing LLM call (research endpoint)...")
stdin, stdout, stderr = client.exec_command(
    'curl -s -X POST http://localhost:3000/api/research '
    '-H "Content-Type: application/json" '
    '-d \'{"topic": "Best time to visit Hwange for elephant sightings"}\''
)
result = stdout.read().decode().strip()
try:
    data = json.loads(result)
    print(f"   Response keys: {list(data.keys())[:5]}")
    print(f"   Has insight: {bool(data.get('insight'))}")
except:
    print(f"   Raw: {result[:200]}")

# 4. Metrics after LLM call
stdin, stdout, stderr = client.exec_command('curl -s http://localhost:3000/metrics')
metrics = json.loads(stdout.read().decode().strip())
print(f"\n4. Metrics: {metrics['total_traces']} traces, {metrics['total_tokens']} tokens, ${metrics['total_cost_usd']:.4f} cost")

# 5. Langfuse traces
print("\n5. Checking Langfuse...")
auth = "cGstbGYtNDRjYzk4YTQtOTM5OS00MjRlLTljOTQtMjFhNjI0ZjNiNTI6c2stbGYtNmQyOWZlZWUtNWI1MS00NDFhLThmODMtNWU1MTY4MTRlNDJi"
stdin, stdout, stderr = client.exec_command(
    f'docker exec ops_engine curl -s "http://langfuse:3000/api/public/traces?page=1&limit=5" '
    f'-H "Authorization: Basic {auth}"'
)
try:
    lf = json.loads(stdout.read().decode().strip())
    trace_count = lf.get('meta', {}).get('totalItems', 0)
    print(f"   Traces in Langfuse: {trace_count}")
    if lf.get('data'):
        for t in lf['data'][:3]:
            print(f"   - {t.get('name', 'unnamed')} ({t.get('latency', 0):.1f}s)")
except Exception as e:
    print(f"   Error: {e}")

# 6. n8n workflows
print("\n6. Checking n8n workflows...")
N8N_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkOTYwYzdiOS0zMDVlLTQxMTEtYjEwOC1iNDExYWFlZDQ1ZDMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNjM0NDc4ZDMtNzVmNS00MzE5LThkNjgtNDljYmQzMDE3ZTc4IiwiaWF0IjoxNzgxODEzMTY4fQ.t9VCE4Ile-NunNS7hFtRyI-dX3gYZlqnP9T1OyHpyFg"
stdin, stdout, stderr = client.exec_command(
    f'curl -s -H "X-N8N-API-KEY: {N8N_KEY}" http://localhost:5678/api/v1/workflows'
)
try:
    wf = json.loads(stdout.read().decode().strip())
    print(f"   Workflows: {len(wf.get('data', []))}")
    for w in wf.get('data', []):
        print(f"   - {w.get('name', 'unnamed')} (active: {w.get('active', False)})")
except Exception as e:
    print(f"   Error: {e}")

# 7. All containers
print("\n7. Container status:")
stdin, stdout, stderr = client.exec_command('docker ps --format "table {{.Names}}\\t{{.Status}}"')
for line in stdout.read().decode().splitlines():
    if line.strip():
        print(f"   {line.strip()}")

# 8. Cloudflare tunnel
print("\n8. Cloudflare tunnel:")
stdin, stdout, stderr = client.exec_command('curl -s -o /dev/null -w "%{http_code}" https://ops.safarizetu.com/health')
print(f"   https://ops.safarizetu.com/health: {stdout.read().decode().strip()}")

print("\n" + "=" * 60)
print("PIPELINE TEST COMPLETE")
print("=" * 60)

client.close()
