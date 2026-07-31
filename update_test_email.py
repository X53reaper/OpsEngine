import paramiko
import time
import json
import uuid
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='ascii', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789')

# Update EMAIL_TEST_OVERRIDE to use the deliverable address
print("=" * 60)
print("Updating EMAIL_TEST_OVERRIDE to sirmarshalmuvhuni@gmail.com")
print("=" * 60)

cmd = """sed -i 's/EMAIL_TEST_OVERRIDE=.*/EMAIL_TEST_OVERRIDE=sirmarshalmuvhuni@gmail.com/' /opt/safarizetu-ops-engine/.env"""
stdin, stdout, stderr = ssh.exec_command(cmd)
time.sleep(3)

# Verify
cmd2 = "grep EMAIL_TEST /opt/safarizetu-ops-engine/.env"
stdin2, stdout2, stderr2 = ssh.exec_command(cmd2)
time.sleep(3)
print(stdout2.read().decode('ascii', errors='replace'))

# Restart to pick up env change
print("Restarting ops engine...")
cmd3 = "docker restart ops_engine"
stdin3, stdout3, stderr3 = ssh.exec_command(cmd3)
time.sleep(15)

# Wait for health
cmd4 = "curl -s http://localhost:3000/health"
stdin4, stdout4, stderr4 = ssh.exec_command(cmd4)
time.sleep(5)
print(stdout4.read().decode('ascii', errors='replace'))

# Verify env
cmd5 = "docker exec ops_engine env | grep EMAIL_TEST"
stdin5, stdout5, stderr5 = ssh.exec_command(cmd5)
time.sleep(3)
print(stdout5.read().decode('ascii', errors='replace'))

ssh.close()
