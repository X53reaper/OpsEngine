#!/usr/bin/env python3
import paramiko
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.18.50', 22, 'root', '123456789')

# Check symlink
stdin, stdout, stderr = client.exec_command('ls -la /opt/safarizetu-ops-engine/infrastructure/.env')
print("Symlink:", stdout.read().decode().strip())

# Check .env content for N8N vars
stdin, stdout, stderr = client.exec_command('grep -E "N8N_API|N8N_JWT" /opt/safarizetu-ops-engine/.env')
print("ENV file N8N vars:")
for line in stdout:
    print(" ", line.strip())

# Check what compose sees
stdin, stdout, stderr = client.exec_command('docker inspect ops_engine --format="{{range .Config.Env}}{{println .}}{{end}}" | grep N8N')
print("\nContainer N8N env:")
for line in stdout:
    print(" ", line.strip())

# If symlink is broken, recreate it
stdin, stdout, stderr = client.exec_command('cd /opt/safarizetu-ops-engine/infrastructure && ln -sf ../.env .env 2>&1')
print("Symlink fix:", stdout.read().decode().strip())

client.close()
