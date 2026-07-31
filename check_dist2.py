import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

container_id = '8ad84cbecc4a'

# Start container
print('Starting container...')
ssh.exec_command(f'docker start {container_id}')
time.sleep(3)

# Check status
stdin, stdout, stderr = ssh.exec_command(f'docker inspect --format="{{{{.State.Status}}}}" {container_id}')
status = stdout.read().decode().strip()
print(f'Status: {status}')

# If running, check dist
if status == 'running':
    stdin, stdout, stderr = ssh.exec_command(f'docker exec {container_id} ls -la /app/dist/ 2>&1')
    print(f'dist: {stdout.read().decode()[:500]}')
    
    stdin, stdout, stderr = ssh.exec_command(f'docker exec {container_id} ls /app/dist_original/ 2>&1')
    print(f'dist_original: {stdout.read().decode()[:500]}')
else:
    # Container is not running - use docker cp to check
    print('\nContainer not running. Using docker cp approach...')
    
    # Extract dist to host
    ssh.exec_command('rm -rf /tmp/container_dist')
    stdin, stdout, stderr = ssh.exec_command(f'docker cp {container_id}:/app/dist /tmp/container_dist')
    time.sleep(2)
    
    stdin, stdout, stderr = ssh.exec_command('ls -la /tmp/container_dist/ 2>&1')
    print(f'dist from container: {stdout.read().decode()[:500]}')
    
    stdin, stdout, stderr = ssh.exec_command('ls /tmp/container_dist/services/ 2>&1')
    print(f'services: {stdout.read().decode()[:500]}')

ssh.close()
