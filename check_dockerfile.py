import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

# Check Dockerfile
stdin, stdout, stderr = ssh.exec_command('cat /opt/safarizetu-ops-engine/infrastructure/Dockerfile.ops')
content = stdout.read()

# Write to file to avoid encoding issues
with open(r'D:\Projects\SafariZetu Automation\Dockerfile_check.txt', 'wb') as f:
    f.write(content)

# Check what's in the new image
stdin, stdout, stderr = ssh.exec_command('docker run --rm safarizetu-ops-engine:latest cat /app/src/index.ts 2>&1 | head -5')
with open(r'D:\Projects\SafariZetu Automation\image_src_check.txt', 'wb') as f:
    f.write(stdout.read())

# Check if the image has the new files
stdin, stdout, stderr = ssh.exec_command('docker run --rm safarizetu-ops-engine:latest ls /app/src/services/email-template-helpers.ts 2>&1')
with open(r'D:\Projects\SafariZetu Automation\image_files_check.txt', 'wb') as f:
    f.write(stdout.read())

ssh.close()
