import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

# Check health
stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
print('Health:', stdout.read().decode())

# Test email preview
payload = '{"template":"enquiry-acknowledgement","data":{"touristName":"John","enquiryId":"ENQ-001","destination":"Victoria Falls"}}'
cmd = f"curl -s -X POST http://localhost:3000/api/emails/preview -H 'Content-Type: application/json' -d '{payload}'"
stdin, stdout, stderr = ssh.exec_command(cmd)
output = stdout.read().decode()
print(f'Email preview: {len(output)} chars')
if len(output) > 100:
    print('SUCCESS!')
    print(output[:300])
else:
    print('ERROR:', output)

ssh.close()
