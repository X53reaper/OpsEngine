#!/usr/bin/env python3
import paramiko, time
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.18.50', 22, 'root', '123456789')

NEW_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkOTYwYzdiOS0zMDVlLTQxMTEtYjEwOC1iNDExYWFlZDQ1ZDMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNjM0NDc4ZDMtNzVmNS00MzE5LThkNjgtNDljYmQzMDE3ZTc4IiwiaWF0IjoxNzgxODEzMTY4fQ.t9VCE4Ile-NunNS7hFtRyI-dX3gYZlqnP9T1OyHpyFg"

# Update .env
client.exec_command(
    f'sed -i "s|N8N_API_KEY=.*|N8N_API_KEY={NEW_KEY}|" /opt/safarizetu-ops-engine/.env'
)
print("Updated .env with new N8N_API_KEY")

# Force-recreate ops-engine
stdin, stdout, stderr = client.exec_command(
    'cd /opt/safarizetu-ops-engine/infrastructure && docker compose up -d --force-recreate ops-engine 2>&1'
)
print(stdout.read().decode().strip()[:300])

time.sleep(8)

# Verify
stdin, stdout, stderr = client.exec_command('docker exec ops_engine env | grep N8N_API_KEY')
print("N8N_API_KEY:", stdout.read().decode().strip())

# Test n8n API
stdin, stdout, stderr = client.exec_command(
    f'docker exec ops_engine curl -s -H "X-N8N-API-KEY: {NEW_KEY}" http://n8n:5678/api/v1/workflows 2>&1'
)
print("n8n API:", stdout.read().decode().strip()[:300])

# Health
stdin, stdout, stderr = client.exec_command('curl -s http://localhost:3000/health')
print("Health:", stdout.read().decode().strip())

client.close()
