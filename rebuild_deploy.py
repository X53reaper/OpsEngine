import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

print('Rebuilding Docker image with --no-cache...')
stdin, stdout, stderr = ssh.exec_command(
    'cd /opt/safarizetu-ops-engine/infrastructure && docker build --no-cache -t safarizetu-ops-engine:latest -f Dockerfile.ops ..',
    timeout=300
)
output = stdout.read().decode()
error = stderr.read().decode()
print(output[-1000:] if len(output) > 1000 else output)
if error:
    print('STDERR:', error[-500:] if len(error) > 500 else error)

print('\nWaiting for container to be ready...')
time.sleep(5)

print('Force recreating ops-engine...')
stdin, stdout, stderr = ssh.exec_command(
    'cd /opt/safarizetu-ops-engine/infrastructure && docker compose up -d --force-recreate ops-engine'
)
print(stdout.read().decode())

time.sleep(5)

print('\nChecking health...')
stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
print(stdout.read().decode())

print('\nTesting email preview endpoint...')
stdin, stdout, stderr = ssh.exec_command(
    """curl -s -X POST http://localhost:3000/api/emails/preview -H 'Content-Type: application/json' -d '{"template":"enquiry-acknowledgement","data":{"touristName":"John","enquiryId":"ENQ-001","destination":"Victoria Falls"}}'"""
)
output = stdout.read().decode()
if 'error' in output.lower():
    print('ERROR:', output)
else:
    print('SUCCESS! Email HTML length:', len(output))
    print('First 300 chars:', output[:300])

ssh.close()
