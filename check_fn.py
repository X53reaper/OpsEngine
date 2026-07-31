import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=15)

# Get the full compiled JS for the acknowledgeEnquiry function
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine cat /app/dist/agents/division1-growth.js')
content = stdout.read().decode()

# Find the acknowledgeEnquiry function
import re
match = re.search(r'async function acknowledgeEnquiry.*?(?=async function|\Z)', content, re.DOTALL)
if match:
    print("acknowledgeEnquiry function:")
    print(match.group(0)[:2000])
else:
    print("Function not found")
    # Show first 3000 chars
    print(content[:3000])

ssh.close()
