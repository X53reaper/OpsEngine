#!/usr/bin/env python3
import paramiko
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.18.50', 22, 'root', '123456789')

# Check ops-engine has n8n vars
stdin, stdout, stderr = client.exec_command('docker exec ops_engine env | grep N8N_')
print("Ops-engine N8N env:")
for line in stdout:
    print(" ", line.strip())

# Test n8n API connection from ops-engine
stdin, stdout, stderr = client.exec_command(
    'docker exec ops_engine curl -s -w "%{http_code}" '
    '-H "X-N8N-API-KEY: _596dff8b-5d5f-47d1-b6f8-ea1f24986918" '
    'http://n8n:5678/api/v1/workflows 2>&1'
)
print("\nn8n API test:", stdout.read().decode().strip()[:300])

# Check all containers healthy
stdin, stdout, stderr = client.exec_command('docker ps --format "table {{.Names}}\t{{.Status}}" 2>&1')
print("\nAll containers:")
print(stdout.read().decode())

client.close()
