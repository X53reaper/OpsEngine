#!/usr/bin/env python3
"""Check Cloudflare tunnel state on remote server"""
import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.18.50', 22, 'root', '123456789')

# Check if cloudflared container exists
stdin, stdout, stderr = client.exec_command('docker ps -a --filter name=ops_cloudflared --format "{{.Names}} {{.Status}}" 2>&1')
print("Cloudflared container:", stdout.read().decode().strip() or "not found")

# Check .env for cloudflare vars
stdin, stdout, stderr = client.exec_command('grep -i cloudflare /opt/safarizetu-ops/.env 2>&1')
print("ENV:", stdout.read().decode().strip()[:300] or "no cloudflare vars")

# Check .env for tunnel token
stdin, stdout, stderr = client.exec_command('grep -i tunnel /opt/safarizetu-ops/.env 2>&1')
print("Tunnel:", stdout.read().decode().strip()[:300] or "no tunnel token")

# Check cloudflared creds volume
stdin, stdout, stderr = client.exec_command('docker volume ls --filter name=cloudflare 2>&1')
print("Volumes:", stdout.read().decode().strip())

# Check if cloudflared creds file exists in the volume
stdin, stdout, stderr = client.exec_command('docker run --rm -v safarizetu_ops_cloudflare_creds:/data busybox ls /data/ 2>&1')
print("Creds volume contents:", stdout.read().decode().strip()[:300])

# Check DNS records for safarizetu.com
stdin, stdout, stderr = client.exec_command('nslookup ops.safarizetu.com 2>&1')
print("DNS:", stdout.read().decode().strip()[:300])

client.close()
