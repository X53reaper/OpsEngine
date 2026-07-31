#!/usr/bin/env python3
import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.18.50', 22, 'root', '123456789')

# Read current .env
stdin, stdout, stderr = client.exec_command('cat /opt/safarizetu-ops-engine/.env')
env_content = stdout.read().decode()

# Check if N8N vars already exist
if 'N8N_API_KEY' not in env_content:
    client.exec_command('echo "N8N_API_KEY=_596dff8b-5d5f-47d1-b6f8-ea1f24986918" >> /opt/safarizetu-ops-engine/.env')
    print("Added N8N_API_KEY")
else:
    print("N8N_API_KEY already in .env")

if 'N8N_JWT_SECRET' not in env_content:
    client.exec_command('echo "N8N_JWT_SECRET=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkOTYwYzdiOS0zMDVlLTQxMTEtYjEwOC1iNDExYWFlZDQ1ZDMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWFiOGQwMmEtODI3ZC00NjdkLWFlYjAtNzlhZDAzM2U1MWUyIiwiaWF0IjoxNzgxODEyODMzfQ.jW7ImaJCwZG8_sWNERCQZVoHiwRCkDDykgfTRN3YRcQ" >> /opt/safarizetu-ops-engine/.env')
    print("Added N8N_JWT_SECRET")
else:
    print("N8N_JWT_SECRET already in .env")

# Verify
stdin, stdout, stderr = client.exec_command('grep -E "N8N_" /opt/safarizetu-ops-engine/.env')
print("\nCurrent N8N vars:")
for line in stdout:
    print(" ", line.strip())

client.close()
