#!/usr/bin/env python3
import paramiko
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.18.50', 22, 'root', '123456789')

# Check cloudflared
stdin, stdout, stderr = client.exec_command('docker ps --filter name=ops_cloudflared --format "{{.Names}} {{.Status}}"')
print('Tunnel:', stdout.read().decode().strip())

# Check tunnel logs
stdin, stdout, stderr = client.exec_command('docker logs ops_cloudflared --tail 5 2>&1')
for line in stdout.read().decode().splitlines():
    if line.strip(): print('  ', line.strip()[:120])

# Test internal services
checks = [
    ('ops-engine', 'localhost:3000/health'),
    ('dashboard', 'localhost:3002'),
    ('n8n', 'localhost:5678'),
    ('langfuse', 'localhost:3001/api/public/health'),
]
print()
for name, url in checks:
    stdin, stdout, stderr = client.exec_command(f'curl -s -o /dev/null -w "%{{http_code}}" http://{url} 2>&1')
    print(f'{name}: {stdout.read().decode().strip()}')

client.close()
