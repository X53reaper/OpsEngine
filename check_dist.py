import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

container_id = '8ad84cbecc4a'

# Stop container
ssh.exec_command(f'docker kill {container_id}')
time.sleep(3)

# Check what's in the dist directory
stdin, stdout, stderr = ssh.exec_command(f'docker exec {container_id} ls -la /app/dist/ 2>&1')
print('dist contents:', stdout.read().decode())

# Check if dist_original exists
stdin, stdout, stderr = ssh.exec_command(f'docker exec {container_id} ls -la /app/dist_original/ 2>&1')
print('dist_original:', stdout.read().decode())

# Check if the original dist was properly restored
stdin, stdout, stderr = ssh.exec_command(f'docker exec {container_id} ls /app/dist_original/services/ 2>&1')
print('dist_original/services:', stdout.read().decode())

ssh.close()
