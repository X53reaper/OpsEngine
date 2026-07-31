import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

container_id = '8ad84cbecc4a'

# Wait for container to be running
print('Waiting for container to stabilize...')
for i in range(12):
    time.sleep(5)
    stdin, stdout, stderr = ssh.exec_command(f'docker inspect --format="{{{{.State.Status}}}}" {container_id}')
    status = stdout.read().decode().strip()
    print(f'  [{i*5}s] Status: {status}')
    if status == 'running':
        # Check if health is ok
        stdin, stdout, stderr = ssh.exec_command(f'docker inspect --format="{{{{.State.Health.Status}}}}" {container_id}')
        health = stdout.read().decode().strip()
        print(f'  Health: {health}')
        if health in ('healthy', 'starting'):
            break

# Now compile TypeScript
print('\nCompiling TypeScript...')
stdin, stdout, stderr = ssh.exec_command(
    f'docker exec {container_id} /usr/local/bin/tsc --outDir /app/dist 2>&1',
    timeout=180
)
out = stdout.read().decode()
if out:
    print(f'  Output (first 800 chars):')
    print(out[:800])
else:
    print('  No output (success!)')

# Verify compiled files
print('\nVerifying compiled files...')
stdin, stdout, stderr = ssh.exec_command(
    f'docker exec {container_id} ls -la /app/dist/services/email-templates.js /app/dist/services/observability.service.js /app/dist/agents/division1-growth.js /app/dist/index.js 2>&1'
)
print(stdout.read().decode())

# Check file sizes
stdin, stdout, stderr = ssh.exec_command(
    f'docker exec {container_id} wc -c /app/dist/services/email-templates.js /app/dist/services/observability.service.js'
)
print('File sizes:', stdout.read().decode())

ssh.close()
