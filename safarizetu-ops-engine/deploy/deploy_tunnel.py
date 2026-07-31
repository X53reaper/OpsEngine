#!/usr/bin/env python3
"""Deploy Cloudflare tunnel with token"""
import paramiko, os

HOST = "192.168.18.50"
USER = "root"
PASS = "123456789"
TOKEN = "eyJhIjoiZDQ3OThmMDUxNDY0YmJiMjZhNDE1MDYwNDZjYmIwNTEiLCJ0IjoiNmU3NTI5YzAtNjEzZS00NzAzLThmNjUtNjVjZDU3MDM3YWZjIiwicyI6Ik56Z3dNelUzTVdRdFl6Y3lOeTAwWW1Vd0xUZ3dNRFF0TW1VNVpEbGpORE5sTWpSaiJ9"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, 22, USER, PASS)

PROJECT = "/opt/safarizetu-ops-engine"

# 1. Add token to .env
print("--- Adding token to .env ---")
stdin, stdout, stderr = client.exec_command(
    f'grep -q CLOUDFLARE_TUNNEL_TOKEN {PROJECT}/.env && '
    f'sed -i "s|CLOUDFLARE_TUNNEL_TOKEN=.*|CLOUDFLARE_TUNNEL_TOKEN={TOKEN}|" {PROJECT}/.env || '
    f'echo "CLOUDFLARE_TUNNEL_TOKEN={TOKEN}" >> {PROJECT}/.env'
)
print(stdout.read().decode().strip())

# 2. Upload updated docker-compose.yml
local_compose = r"D:\Projects\SafariZetu Automation\safarizetu-ops-engine\infrastructure\docker-compose.yml"
remote_compose = f"{PROJECT}/infrastructure/docker-compose.yml"
sftp = client.open_sftp()
sftp.put(local_compose, remote_compose)
print("docker-compose.yml updated")

# 3. Stop old cloudflared if running, remove, then start fresh
print("--- Starting cloudflared tunnel ---")
stdin, stdout, stderr = client.exec_command(
    f'cd {PROJECT}/infrastructure && '
    f'docker compose stop cloudflared 2>/dev/null; '
    f'docker compose rm -f cloudflared 2>/dev/null; '
    f'CLOUDFLARE_TUNNEL_TOKEN={TOKEN} docker compose up -d cloudflared 2>&1'
)
print(stdout.read().decode().strip()[:500])

# 4. Check status
import time
time.sleep(3)
stdin, stdout, stderr = client.exec_command(
    f'docker ps --filter name=ops_cloudflared --format "{{{{.Names}}}} {{{{.Status}}}}" 2>&1'
)
print("Status:", stdout.read().decode().strip())

# 5. Check logs
stdin, stdout, stderr = client.exec_command(
    f'docker logs ops_cloudflared --tail 20 2>&1'
)
logs = stdout.read().decode('utf-8', errors='replace')
print("Logs:")
for line in logs.split('\n'):
    if line.strip():
        print(f"  {line.strip()[:150]}")

sftp.close()
client.close()
