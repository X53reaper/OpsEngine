import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=15)

# Upload transpile script
sftp = ssh.open_sftp()
sftp.put(r'D:\Projects\SafariZetu Automation\transpile_templates.js', '/tmp/transpile_final.js')
sftp.close()

# Copy into container
stdin, stdout, stderr = ssh.exec_command('docker cp /tmp/transpile_final.js ops_engine:/app/transpile_final.js')
time.sleep(2)

# Run from /app directory
print("Transpiling...")
stdin, stdout, stderr = ssh.exec_command('docker exec -w /app ops_engine node transpile_final.js 2>&1')
output = stdout.read().decode().strip()
err = stderr.read().decode().strip()
print(output)
if err:
    print(f"Errors: {err[:500]}")

# Verify
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine ls /app/dist/services/email-templates/ 2>&1')
print("\nCompiled templates:", stdout.read().decode())

# Check email-templates.js
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine wc -l /app/dist/services/email-templates.js')
print("email-templates.js lines:", stdout.read().decode().strip())

# Restart
print("\nRestarting...")
stdin, stdout, stderr = ssh.exec_command('docker restart ops_engine')
time.sleep(15)

stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
print("Health:", stdout.read().decode().strip())

ssh.close()
