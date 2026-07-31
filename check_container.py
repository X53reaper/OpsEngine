import paramiko
import time
import json

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=15)

# Check container structure
print("=== Container file structure ===")
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine ls -la /app/src/services/')
print(stdout.read().decode())

stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine ls -la /app/dist/services/')
print(stdout.read().decode())

# Check if email-templates dir exists in container
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine ls -la /app/src/services/email-templates/ 2>&1')
print("email-templates dir:", stdout.read().decode())

# Check compiled JS
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine ls -la /app/dist/services/email-templates/ 2>&1')
print("dist/email-templates dir:", stdout.read().decode())

# Check if the preview endpoint exists
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine grep -r "emails/preview" /app/dist/ 2>/dev/null | head -5')
print("Preview endpoint:", stdout.read().decode())

ssh.close()
