#!/usr/bin/env python3
import paramiko, time

HOST = "192.168.18.50"
USER = "root"
PASS = "123456789"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, 22, USER, PASS)

# Upload updated compose with skills volume
sftp = client.open_sftp()
sftp.put(
    r"D:\Projects\SafariZetu Automation\safarizetu-ops-engine\infrastructure\docker-compose.yml",
    "/opt/safarizetu-ops-engine/infrastructure/docker-compose.yml"
)
sftp.close()
print("docker-compose.yml updated with skills volume")

# Force recreate ops-engine
stdin, stdout, stderr = client.exec_command(
    'cd /opt/safarizetu-ops-engine/infrastructure && docker compose up -d --force-recreate ops-engine 2>&1'
)
print(stdout.read().decode().strip()[:300])

time.sleep(8)

# Verify skills persist
stdin, stdout, stderr = client.exec_command('curl -s http://localhost:3000/api/skills')
import json
skills = json.loads(stdout.read().decode().strip())
print(f"\nSkills: {skills['count']} loaded")

# Verify all services
stdin, stdout, stderr = client.exec_command('docker ps --format "table {{.Names}}\\t{{.Status}}"')
print("\nContainers:")
for line in stdout.read().decode().splitlines():
    if line.strip():
        print(f"  {line.strip()}")

# Final health
stdin, stdout, stderr = client.exec_command('curl -s http://localhost:3000/health')
print(f"\nHealth: {stdout.read().decode().strip()}")

# n8n active workflows
N8N_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkOTYwYzdiOS0zMDVlLTQxMTEtYjEwOC1iNDExYWFlZDQ1ZDMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNjM0NDc4ZDMtNzVmNS00MzE5LThkNjgtNDljYmQzMDE3ZTc4IiwiaWF0IjoxNzgxODEzMTY4fQ.t9VCE4Ile-NunNS7hFtRyI-dX3gYZlqnP9T1OyHpyFg"
stdin, stdout, stderr = client.exec_command(
    f'curl -s -H "X-N8N-API-KEY: {N8N_KEY}" http://localhost:5678/api/v1/workflows'
)
wf = json.loads(stdout.read().decode().strip())
active = [w['name'] for w in wf.get('data', []) if w.get('active')]
print(f"\nn8n active workflows: {len(active)}")
for name in active:
    print(f"  - {name}")

client.close()
