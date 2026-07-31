#!/usr/bin/env python3
import paramiko
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.18.50', 22, 'root', '123456789')

# Check skills directory on server
stdin, stdout, stderr = client.exec_command('find /opt/safarizetu-ops-engine/skills -name "*.md" 2>/dev/null | head -20')
files = [l.strip() for l in stdout if l.strip()]
print(f"Skills files on server: {len(files)}")
for f in files:
    print(f"  {f}")

# Check via API
stdin, stdout, stderr = client.exec_command('curl -s http://localhost:3000/api/skills')
print("\nSkills API:")
print(stdout.read().decode().strip()[:500])

# Check logs for skill loading
stdin, stdout, stderr = client.exec_command('docker logs ops_engine --tail 50 2>&1 | grep -i skill')
print("\nSkill logs:")
for line in stdout.read().decode().splitlines():
    if line.strip():
        print(f"  {line.strip()[:120]}")

client.close()
