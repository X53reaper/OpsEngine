#!/usr/bin/env python3
import paramiko, time
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.18.50', 22, 'root', '123456789')

# Remove empty skills directory so defaults get created on restart
stdin, stdout, stderr = client.exec_command('rm -rf /opt/safarizetu-ops-engine/skills/*')
print("Cleared skills directory")

# Restart ops-engine to trigger default skill creation
print("Restarting ops_engine...")
stdin, stdout, stderr = client.exec_command('docker restart ops_engine')
stdout.read()
time.sleep(5)

# Check if skills loaded
stdin, stdout, stderr = client.exec_command('curl -s http://localhost:3000/api/skills')
result = stdout.read().decode().strip()
print(f"Skills API: {result[:500]}")

# Check skills on disk
stdin, stdout, stderr = client.exec_command('find /opt/safarizetu-ops-engine/skills -name "*.md" 2>/dev/null')
files = [l.strip() for l in stdout if l.strip()]
print(f"\nSkills on disk: {len(files)}")
for f in files:
    print(f"  {f}")

# Check logs
stdin, stdout, stderr = client.exec_command('docker logs ops_engine --tail 10 2>&1 | grep -i skill')
for line in stdout.read().decode().splitlines():
    if line.strip():
        print(f"  {line.strip()[:120]}")

client.close()
