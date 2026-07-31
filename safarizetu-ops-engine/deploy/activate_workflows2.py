#!/usr/bin/env python3
import paramiko, json

HOST = "192.168.18.50"
USER = "root"
PASS = "123456789"
N8N_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkOTYwYzdiOS0zMDVlLTQxMTEtYjEwOC1iNDExYWFlZDQ1ZDMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNjM0NDc4ZDMtNzVmNS00MzE5LThkNjgtNDljYmQzMDE3ZTc4IiwiaWF0IjoxNzgxODEzMTY4fQ.t9VCE4Ile-NunNS7hFtRyI-dX3gYZlqnP9T1OyHpyFg"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, 22, USER, PASS)

# Get all workflows
stdin, stdout, stderr = client.exec_command(
    f'curl -s -H "X-N8N-API-KEY: {N8N_KEY}" http://localhost:5678/api/v1/workflows'
)
wf = json.loads(stdout.read().decode().strip())

for w in wf.get('data', []):
    wid = w['id']
    name = w['name']
    # Try POST to activate endpoint
    stdin, stdout, stderr = client.exec_command(
        f'curl -s -X POST http://localhost:5678/api/v1/workflows/{wid}/activate '
        f'-H "X-N8N-API-KEY: {N8N_KEY}"'
    )
    result = stdout.read().decode().strip()
    try:
        data = json.loads(result)
        print(f"  {name}: active={data.get('active', '?')}")
    except:
        print(f"  {name}: {result[:100]}")

# Final check
stdin, stdout, stderr = client.exec_command(
    f'curl -s -H "X-N8N-API-KEY: {N8N_KEY}" http://localhost:5678/api/v1/workflows'
)
wf = json.loads(stdout.read().decode().strip())
active = sum(1 for w in wf.get('data', []) if w.get('active'))
print(f"\nActive: {active}/{len(wf.get('data', []))}")

client.close()
