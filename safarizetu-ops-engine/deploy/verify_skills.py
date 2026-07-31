#!/usr/bin/env python3
import paramiko, time
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.18.50', 22, 'root', '123456789')

# Check files on disk
stdin, stdout, stderr = client.exec_command('find /opt/safarizetu-ops-engine/skills -type f 2>/dev/null')
print("Files on disk:")
for line in stdout:
    print(f"  {line.strip()}")

# Check container sees them
stdin, stdout, stderr = client.exec_command('docker exec ops_engine find /app/skills -type f 2>/dev/null')
print("\nFiles in container:")
for line in stdout:
    print(f"  {line.strip()}")

# Force restart and check
stdin, stdout, stderr = client.exec_command('docker restart ops_engine')
stdout.read()
time.sleep(6)

stdin, stdout, stderr = client.exec_command('curl -s http://localhost:3000/api/skills')
result = stdout.read().decode().strip()
print(f"\nSkills API: {result[:500]}")

# Check logs for skill loading
stdin, stdout, stderr = client.exec_command('docker logs ops_engine --tail 15 2>&1 | grep -i skill')
for line in stdout.read().decode().splitlines():
    if line.strip():
        print(f"  {line.strip()[:120]}")

client.close()
