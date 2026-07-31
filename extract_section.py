import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

# Extract the email preview section
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine sed -n "640,690p" /app/dist/index.js')
with open(r'D:\Projects\SafariZetu Automation\email_preview_section.txt', 'wb') as f:
    f.write(stdout.read())

ssh.close()
