import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

sftp = ssh.open_sftp()

# Upload all source files that changed
files = [
    # Rename: email-templates.ts -> email-template-helpers.ts on server
    # Already done on server, but need to upload the updated division1-growth.ts
    (r'D:\Projects\SafariZetu Automation\safarizetu-ops-engine\src\agents\division1-growth.ts', '/opt/safarizetu-ops-engine/src/agents/division1-growth.ts'),
    (r'D:\Projects\SafariZetu Automation\safarizetu-ops-engine\src\index.ts', '/opt/safarizetu-ops-engine/src/index.ts'),
    (r'D:\Projects\SafariZetu Automation\safarizetu-ops-engine\src\services\email-templates\index.ts', '/opt/safarizetu-ops-engine/src/services/email-templates/index.ts'),
]

for local, remote in files:
    try:
        sftp.put(local, remote)
        print(f'Uploaded: {remote.split("/")[-1]}')
    except Exception as e:
        print(f'Error uploading {remote}: {e}')

sftp.close()

# Touch the Dockerfile to bust cache
stdin, stdout, stderr = ssh.exec_command('touch /opt/safarizetu-ops-engine/infrastructure/Dockerfile.ops')
stdout.read()

# Also touch tsconfig.json
stdin, stdout, stderr = ssh.exec_command('touch /opt/safarizetu-ops-engine/tsconfig.json')
stdout.read()

# Stop the crashing container first
print('\nStopping container...')
ssh.exec_command('docker kill 8ad84cbecc4a 2>/dev/null')
time.sleep(3)

# Rebuild Docker image (touch Dockerfile busts cache)
print('Rebuilding Docker image...')
stdin, stdout, stderr = ssh.exec_command(
    'cd /opt/safarizetu-ops-engine/infrastructure && docker build --no-cache -t safarizetu-ops-engine:latest -f Dockerfile.ops ..',
    timeout=600
)
# Read output in chunks
output = ''
while True:
    chunk = stdout.read(4096).decode()
    if not chunk:
        break
    output += chunk
print(output[-1500:] if len(output) > 1500 else output)

# Recreate container
print('\nRecreating container...')
stdin, stdout, stderr = ssh.exec_command(
    'cd /opt/safarizetu-ops-engine/infrastructure && docker compose up -d --force-recreate ops-engine'
)
print(stdout.read().decode())

# Wait for healthy
print('\nWaiting for container to be healthy...')
for i in range(20):
    time.sleep(5)
    stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
    health = stdout.read().decode().strip()
    if health and 'ok' in health:
        print(f'  [{i*5}s] HEALTHY: {health}')
        break
    print(f'  [{i*5}s] Waiting... {health[:100]}')

# Test email preview
print('\nTesting email preview...')
payload = '{"template":"enquiry-acknowledgement","data":{"touristName":"John","enquiryId":"ENQ-001","destination":"Victoria Falls"}}'
cmd = f"curl -s -X POST http://localhost:3000/api/emails/preview -H 'Content-Type: application/json' -d '{payload}'"
stdin, stdout, stderr = ssh.exec_command(cmd)
output = stdout.read().decode()
if 'error' in output.lower() or 'Not found' in output or len(output) < 100:
    print(f'  ERROR: {output[:500]}')
else:
    print(f'  SUCCESS! Email HTML length: {len(output)} chars')
    print(f'  Preview: {output[:500]}')

ssh.close()
