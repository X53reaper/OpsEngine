#!/usr/bin/env python3
import paramiko, time
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.18.50', 22, 'root', '123456789')

print("Restarting ops_engine...")
stdin, stdout, stderr = client.exec_command('docker restart ops_engine')
stdout.read()
time.sleep(5)

# Verify n8n env
stdin, stdout, stderr = client.exec_command('docker exec ops_engine env | grep N8N_API_KEY')
print("N8N_API_KEY:", stdout.read().decode().strip())

# Test n8n API from ops-engine
stdin, stdout, stderr = client.exec_command(
    'docker exec ops_engine curl -s '
    '-H "X-N8N-API-KEY: _596dff8b-5d5f-47d1-b6f8-ea1f24986918" '
    'http://n8n:5678/api/v1/workflows 2>&1'
)
result = stdout.read().decode().strip()
print("n8n API:", result[:300])

# Health check
stdin, stdout, stderr = client.exec_command('curl -s http://localhost:3000/health')
print("\nHealth:", stdout.read().decode().strip())

client.close()
