import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

container_id = '8ad84cbecc4a'

# Wait for container to be running
print('Waiting for container to stabilize...')
time.sleep(15)

# Check container status
stdin, stdout, stderr = ssh.exec_command(f'docker inspect --format="{{{{.State.Status}}}}" {container_id}')
status = stdout.read().decode().strip()
print(f'Container status: {status}')

# Check container logs
stdin, stdout, stderr = ssh.exec_command(f'docker logs {container_id} --tail 50 2>&1')
logs = stdout.read().decode()
print(f'\nContainer logs (last 50 lines):')
print(logs[-2000:] if len(logs) > 2000 else logs)

# If running, test health
if status == 'running':
    stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
    print(f'\nHealth: {stdout.read().decode()}')

ssh.close()
