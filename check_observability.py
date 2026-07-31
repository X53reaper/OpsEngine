import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

container_id = '8ad84cbecc4a'

# Stop container first
ssh.exec_command(f'docker stop {container_id}')
time.sleep(3)

# Check the compiled observability.service.js
stdin, stdout, stderr = ssh.exec_command(f'docker exec {container_id} cat /app/dist/services/observability.service.js 2>&1 || echo "FILE NOT FOUND"')
content = stdout.read().decode()
if 'FILE NOT FOUND' in content or not content.strip():
    print('File is empty or missing!')
else:
    # Search for initLangfuse
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'initLangfuse' in line or 'exports' in line.lower():
            print(f'Line {i}: {line.strip()[:200]}')

# Also check the source file
stdin, stdout, stderr = ssh.exec_command(f'cat /opt/safarizetu-ops-engine/src/services/observability.service.ts | grep -n "export.*initLangfuse"')
print(f'\nSource export: {stdout.read().decode().strip()}')

# Check if the issue is the email-templates naming collision
stdin, stdout, stderr = ssh.exec_command(f'ls -la /opt/safarizetu-ops-engine/src/services/ | grep email')
print(f'\nEmail files on host: {stdout.read().decode().strip()}')

# Start container back
ssh.exec_command(f'docker start {container_id}')

ssh.close()
