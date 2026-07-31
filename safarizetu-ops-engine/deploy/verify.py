#!/usr/bin/env python3
"""Verify deployment on remote server"""

import paramiko, time

def safe(text): return text.encode('ascii', errors='replace').decode('ascii')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.18.50', 22, 'root', '123456789')

_, stdout, _ = client.exec_command('docker inspect ops_engine --format="{{.State.Health.Status}}"')
print('Health:', stdout.read().decode().strip())

_, stdout, _ = client.exec_command('docker logs ops_engine --tail 30 2>&1')
lines = stdout.read().decode('utf-8', errors='replace')
for line in lines.split('\n'):
    if 'langfuse' in line.lower() or 'Langfuse' in line:
        print('LF:', line.strip())

time.sleep(2)
_, stdout, _ = client.exec_command('curl -s http://localhost:3000/health 2>&1')
print('Health endpoint:', stdout.read().decode().strip()[:300])

_, stdout, _ = client.exec_command('docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>&1')
print('Containers:')
print(stdout.read().decode().strip())

client.close()
