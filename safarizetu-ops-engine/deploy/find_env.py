#!/usr/bin/env python3
"""Find the actual project location"""
import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.18.50', 22, 'root', '123456789')

stdin, stdout, stderr = client.exec_command('ls -la /opt/safarizetu/ 2>&1')
print("/opt/safarizetu/:")
for line in stdout:
    print(" ", line.strip())

stdin, stdout, stderr = client.exec_command('ls -la /opt/safarizetu/infrastructure/ 2>&1')
print("\n/opt/safarizetu/infrastructure/:")
for line in stdout:
    print(" ", line.strip())

stdin, stdout, stderr = client.exec_command('cat /opt/safarizetu/.env 2>&1 | head -5')
print("\n/opt/safarizetu/.env (first 5 lines):")
for line in stdout:
    print(" ", line.strip())

stdin, stdout, stderr = client.exec_command('cat /opt/safarizetu/infrastructure/cloudflare-tunnel.yml 2>&1')
print("\n/opt/safarizetu/infrastructure/cloudflare-tunnel.yml:")
for line in stdout:
    print(" ", line.strip())

client.close()
