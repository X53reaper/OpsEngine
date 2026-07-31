import paramiko
import time
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='ascii', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789')

# Find the correct service name
cmd = "cd /opt/safarizetu-ops-engine/infrastructure && docker compose config --services 2>&1"
stdin, stdout, stderr = ssh.exec_command(cmd)
time.sleep(5)
print("Services:")
print(stdout.read().decode('ascii', errors='replace'))

# Check what the container is actually named
cmd2 = "docker ps --format '{{.Names}}' | grep ops"
stdin2, stdout2, stderr2 = ssh.exec_command(cmd2)
time.sleep(3)
print("Running containers:")
print(stdout2.read().decode('ascii', errors='replace'))

ssh.close()
