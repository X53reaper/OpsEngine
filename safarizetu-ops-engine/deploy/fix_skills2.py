#!/usr/bin/env python3
import paramiko, time
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.18.50', 22, 'root', '123456789')

# Remove the ENTIRE skills directory (not just contents)
stdin, stdout, stderr = client.exec_command('rm -rf /opt/safarizetu-ops-engine/skills')
print("Removed skills directory entirely")

# Restart
stdin, stdout, stderr = client.exec_command('docker restart ops_engine')
stdout.read()
time.sleep(6)

# Check
stdin, stdout, stderr = client.exec_command('curl -s http://localhost:3000/api/skills')
print("Skills API:", stdout.read().decode().strip()[:500])

stdin, stdout, stderr = client.exec_command('find /opt/safarizetu-ops-engine/skills -name "*.md" 2>/dev/null')
files = [l.strip() for l in stdout if l.strip()]
print(f"Skills on disk: {len(files)}")
for f in files:
    print(f"  {f}")

stdin, stdout, stderr = client.exec_command('docker logs ops_engine --tail 5 2>&1 | grep -i skill')
for line in stdout.read().decode().splitlines():
    if line.strip():
        print(f"  {line.strip()[:120]}")

client.close()
