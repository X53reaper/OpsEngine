import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

# Step 1: Verify source files exist
print('Step 1: Verifying source files...')
stdin, stdout, stderr = ssh.exec_command('grep -c "emails/preview" /opt/safarizetu-ops-engine/src/index.ts')
count = stdout.read().decode().strip()
print(f'  index.ts email preview lines: {count}')

stdin, stdout, stderr = ssh.exec_command('ls /opt/safarizetu-ops-engine/src/services/email-template-helpers.ts /opt/safarizetu-ops-engine/src/services/email-templates/ 2>&1')
files = stdout.read().decode().strip()
print(f'  Files: {files[:200]}')

# Step 2: Rebuild Docker image (use timestamp arg to bust cache)
print('\nStep 2: Rebuilding Docker image...')
build_time = str(int(time.time()))
cmd = f'cd /opt/safarizetu-ops-engine/infrastructure && docker build --build-arg BUILD_TIME={build_time} --no-cache -t safarizetu-ops-engine:latest -f Dockerfile.ops ..'
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=600)

output = ''
while True:
    chunk = stdout.read(4096)
    if not chunk:
        break
    output += chunk.decode()

if 'exporting to image' in output or 'naming to' in output:
    print('  Build SUCCESS!')
else:
    # Show last 1000 chars
    print(f'  Build output: {output[-1000:]}')

# Step 3: Verify new image
print('\nStep 3: Verifying new image...')
stdin, stdout, stderr = ssh.exec_command('docker run --rm safarizetu-ops-engine:latest grep -c emails/preview /app/dist/index.js')
print(f'  email preview count: {stdout.read().decode().strip()}')

stdin, stdout, stderr = ssh.exec_command('docker run --rm safarizetu-ops-engine:latest grep -c email-template-helpers /app/dist/agents/division1-growth.js')
print(f'  email-template-helpers import: {stdout.read().decode().strip()}')

# Step 4: Recreate container
print('\nStep 4: Recreating container...')
stdin, stdout, stderr = ssh.exec_command('cd /opt/safarizetu-ops-engine/infrastructure && docker compose up -d --force-recreate ops-engine')
print(stdout.read().decode())

# Step 5: Wait for healthy
print('\nStep 5: Waiting for healthy...')
for i in range(20):
    time.sleep(5)
    stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
    health = stdout.read().decode().strip()
    if health and 'ok' in health:
        print(f'  [{i*5}s] HEALTHY')
        break
    print(f'  [{i*5}s] Waiting...')

# Step 6: Test
print('\nStep 6: Testing email preview...')
payload = '{"template":"enquiry-acknowledgement","data":{"touristName":"John","enquiryId":"ENQ-001","destination":"Victoria Falls"}}'
cmd = f"curl -s -X POST http://localhost:3000/api/emails/preview -H 'Content-Type: application/json' -d '{payload}'"
stdin, stdout, stderr = ssh.exec_command(cmd)
output = stdout.read().decode()
if 'error' in output.lower() or 'Not found' in output or len(output) < 100:
    print(f'  Response: {output[:500]}')
else:
    print(f'  SUCCESS! Email HTML length: {len(output)} chars')
    print(f'  Preview: {output[:500]}')

ssh.close()
