import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

# Step 1: Add a build arg to bust cache
print('Step 1: Modifying Dockerfile to bust cache...')
ssh.exec_command('''
sed -i '1i ARG BUILD_TIME=now' /opt/safarizetu-ops-engine/infrastructure/Dockerfile.ops
sed -i 's|^COPY src/ ./src/|ARG BUILD_TIME\nCOPY src/ ./src/|' /opt/safarizetu-ops-engine/infrastructure/Dockerfile.ops
''')
time.sleep(1)

# Verify Dockerfile
stdin, stdout, stderr = ssh.exec_command('head -25 /opt/safarizetu-ops-engine/infrastructure/Dockerfile.ops')
print(f'Dockerfile:\n{stdout.read().decode()}')

# Step 2: Verify source files are correct
print('\nStep 2: Verifying source files...')
stdin, stdout, stderr = ssh.exec_command('grep -c "emails/preview" /opt/safarizetu-ops-engine/src/index.ts')
print(f'  index.ts email preview lines: {stdout.read().decode().strip()}')

stdin, stdout, stderr = ssh.exec_command('ls /opt/safarizetu-ops-engine/src/services/email-template-helpers.ts')
print(f'  email-template-helpers.ts: {"exists" if stdout.read().decode().strip() else "MISSING"}')

# Step 3: Rebuild with build arg
print('\nStep 3: Rebuilding Docker image with cache bust...')
build_time = str(int(time.time()))
stdin, stdout, stderr = ssh.exec_command(
    f'cd /opt/safarizetu-ops-engine/infrastructure && docker build --build-arg BUILD_TIME={build_time} -t safarizetu-ops-engine:latest -f Dockerfile.ops .. 2>&1',
    timeout=600
)

output = ''
while True:
    chunk = stdout.read(4096)
    if not chunk:
        break
    output += chunk.decode()

# Check result
if 'successfully built' in output.lower() or 'exporting to image' in output:
    print('  Build SUCCESS!')
else:
    # Show relevant lines
    lines = output.split('\n')
    for line in lines:
        if 'error' in line.lower() or 'COPY' in line or 'RUN' in line:
            print(f'  {line.strip()[:200]}')

# Step 4: Verify the new image has the email preview endpoint
print('\nStep 4: Verifying new image...')
stdin, stdout, stderr = ssh.exec_command('docker run --rm safarizetu-ops-engine:latest grep -c emails/preview /app/dist/index.js')
print(f'  email preview in new image: {stdout.read().decode().strip()}')

stdin, stdout, stderr = ssh.exec_command('docker run --rm safarizetu-ops-engine:latest grep -c "email-template-helpers" /app/dist/index.js')
print(f'  email-template-helpers in new image: {stdout.read().decode().strip()}')

# Step 5: Recreate container
print('\nStep 5: Recreating container...')
stdin, stdout, stderr = ssh.exec_command(
    'cd /opt/safarizetu-ops-engine/infrastructure && docker compose up -d --force-recreate ops-engine'
)
print(stdout.read().decode())

# Step 6: Wait for healthy
print('\nStep 6: Waiting for healthy...')
for i in range(20):
    time.sleep(5)
    stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
    health = stdout.read().decode().strip()
    if health and 'ok' in health:
        print(f'  [{i*5}s] HEALTHY')
        break
    print(f'  [{i*5}s] Waiting...')

# Step 7: Test
print('\nStep 7: Testing email preview...')
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
