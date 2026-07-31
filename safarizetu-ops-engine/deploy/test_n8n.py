#!/usr/bin/env python3
import paramiko
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.18.50', 22, 'root', '123456789')

# Test n8n with basic auth
stdin, stdout, stderr = client.exec_command(
    'curl -s -u "admin:1iGND1VilDbn6EE9icQu-wEUpC36v-2a" '
    'http://localhost:5678/api/v1/workflows 2>&1'
)
print("n8n basic auth:", stdout.read().decode().strip()[:500])

# Test n8n with API key header
stdin, stdout, stderr = client.exec_command(
    'curl -s -H "X-N8N-API-KEY: _596dff8b-5d5f-47d1-b6f8-ea1f24986918" '
    'http://localhost:5678/api/v1/workflows 2>&1'
)
print("n8n API key:", stdout.read().decode().strip()[:500])

# Check n8n logs for API key setup
stdin, stdout, stderr = client.exec_command('docker logs ops_n8n --tail 10 2>&1')
print("\nn8n logs:")
for line in stdout.read().decode().splitlines():
    if line.strip():
        print(" ", line.strip()[:120])

client.close()
