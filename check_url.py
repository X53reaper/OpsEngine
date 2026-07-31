import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=15)

# Check the specific line with the enquiry URL
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine grep -n "safarizetu.com/enquiry" /app/dist/agents/division1-growth.js')
print("Enquiry URLs found:")
print(stdout.read().decode())

ssh.close()
