import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

container_id = '8ad84cbecc4a'

# Start container
print('Starting container...')
ssh.exec_command(f'docker start {container_id}')
time.sleep(5)

# Check status
stdin, stdout, stderr = ssh.exec_command(f'docker inspect --format="{{{{.State.Status}}}}" {container_id}')
status = stdout.read().decode().strip()
print(f'Status: {status}')

# Check file sizes
stdin, stdout, stderr = ssh.exec_command(f'docker exec {container_id} wc -c /app/dist/services/observability.service.js /app/dist/index.js 2>&1')
print(f'File sizes: {stdout.read().decode().strip()}')

# Check source lines
stdin, stdout, stderr = ssh.exec_command(f'docker exec {container_id} wc -l /app/src/services/observability.service.ts /app/src/index.ts /app/src/agents/division1-growth.ts 2>&1')
print(f'Source lines: {stdout.read().decode().strip()}')

# Run tsc with noEmit to see errors
stdin, stdout, stderr = ssh.exec_command(f'docker exec {container_id} /usr/local/bin/tsc --noEmit 2>&1', timeout=120)
tsc_output = stdout.read().decode()
print(f'\nTSC errors ({len(tsc_output)} chars):')
print(tsc_output[:2000] if tsc_output else 'No errors')

ssh.close()
