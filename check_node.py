import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789')

# Check if node/npm is available on the VPS
commands = [
    "node --version",
    "npm --version",
    "which npx",
]

for cmd in commands:
    stdin, stdout, stderr = ssh.exec_command(cmd)
    time.sleep(2)
    result = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    print(f"{cmd}: {result or err}")

ssh.close()
