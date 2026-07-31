#!/usr/bin/env python3
import paramiko, time
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.18.50', 22, 'root', '123456789')

# Create categories in container
for cat in ['wildlife', 'psychology', 'copywriting', 'competitors', 'traveler-profiles']:
    client.exec_command(f'docker exec ops_engine mkdir -p /app/skills/{cat}')

# Copy each file into container
files = [
    ('wildlife/zimbabwe-parks.md', 'wildlife'),
    ('wildlife/animal-behavior.md', 'wildlife'),
    ('psychology/travel-desire.md', 'psychology'),
    ('psychology/booking-psychology.md', 'psychology'),
    ('copywriting/memory-storytelling.md', 'copywriting'),
    ('copywriting/premium-voice.md', 'copywriting'),
    ('competitors/counter-strategies.md', 'competitors'),
    ('traveler-profiles/persona-templates.md', 'traveler-profiles'),
]

for fname, cat in files:
    src = f'/opt/safarizetu-ops-engine/skills/{cat}/{fname.split("/")[1]}'
    dst = f'ops_engine:/app/skills/{cat}/{fname.split("/")[1]}'
    stdin, stdout, stderr = client.exec_command(f'docker cp {src} {dst} 2>&1')
    result = stdout.read().decode().strip()
    print(f"  {cat}/{fname.split('/')[1]}: {result or 'OK'}")

# Verify in container
stdin, stdout, stderr = client.exec_command('docker exec ops_engine find /app/skills -name "*.md"')
print("\nFiles in container:")
for line in stdout:
    print(f"  {line.strip()}")

# Restart to reload
client.exec_command('docker restart ops_engine')
time.sleep(6)

# Check API
stdin, stdout, stderr = client.exec_command('curl -s http://localhost:3000/api/skills')
print("\nSkills API:", stdout.read().decode().strip()[:500])

# Check logs
stdin, stdout, stderr = client.exec_command('docker logs ops_engine --tail 5 2>&1 | grep -i skill')
for line in stdout.read().decode().splitlines():
    if line.strip():
        print(f"  {line.strip()[:120]}")

client.close()
