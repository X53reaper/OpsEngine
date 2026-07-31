import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=15)

# Check current compiled division1-growth.js
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine grep -n "enquiry.*id" /app/dist/agents/division1-growth.js | head -5')
print("Current enquiry URL in compiled JS:")
print(stdout.read().decode())

# Fix the URL in the compiled JS
stdin, stdout, stderr = ssh.exec_command('''docker exec ops_engine sed -i 's|/enquiry/${enquiry.id}"|/enquiry/${enquiry.id}/confirmed"|g' /app/dist/agents/division1-growth.js''')
err = stderr.read().decode().strip()
if err:
    print(f"sed error: {err}")
else:
    print("Fixed URL in compiled JS")

# Verify
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine grep -n "enquiry.*id" /app/dist/agents/division1-growth.js | head -5')
print("\nUpdated URL:")
print(stdout.read().decode())

# Restart
print("\nRestarting...")
stdin, stdout, stderr = ssh.exec_command('docker restart ops_engine')
time.sleep(15)

stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
print("Health:", stdout.read().decode().strip())

ssh.close()
