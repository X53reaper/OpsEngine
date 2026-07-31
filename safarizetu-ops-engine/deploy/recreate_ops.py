#!/usr/bin/env python3
import paramiko, time
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.18.50', 22, 'root', '123456789')

print("Recreating ops_engine (force-recreate to pick up new env)...")
stdin, stdout, stderr = client.exec_command(
    'cd /opt/safarizetu-ops-engine/infrastructure && docker compose up -d --force-recreate ops-engine 2>&1'
)
print(stdout.read().decode().strip()[:500])

time.sleep(8)

# Verify N8N vars
stdin, stdout, stderr = client.exec_command('docker exec ops_engine env | grep N8N_')
print("\nContainer N8N env:")
for line in stdout:
    print(" ", line.strip())

# Health check
stdin, stdout, stderr = client.exec_command('curl -s http://localhost:3000/health')
print("\nHealth:", stdout.read().decode().strip())

# Test n8n API
stdin, stdout, stderr = client.exec_command(
    'docker exec ops_engine curl -s '
    '-H "X-N8N-API-KEY: _596dff8b-5d5f-47d1-b6f8-ea1f24986918" '
    'http://n8n:5678/api/v1/workflows 2>&1'
)
print("n8n API:", stdout.read().decode().strip()[:300])

client.close()
