import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

sftp = ssh.open_sftp()

# Step 1: Upload ALL source files
print('Step 1: Uploading source files...')
files_to_upload = [
    (r'D:\Projects\SafariZetu Automation\safarizetu-ops-engine\src\index.ts', '/opt/safarizetu-ops-engine/src/index.ts'),
    (r'D:\Projects\SafariZetu Automation\safarizetu-ops-engine\src\agents\division1-growth.ts', '/opt/safarizetu-ops-engine/src/agents/division1-growth.ts'),
    (r'D:\Projects\SafariZetu Automation\safarizetu-ops-engine\src\services\email-template-helpers.ts', '/opt/safarizetu-ops-engine/src/services/email-template-helpers.ts'),
    (r'D:\Projects\SafariZetu Automation\safarizetu-ops-engine\src\services\email-templates\index.ts', '/opt/safarizetu-ops-engine/src/services/email-templates/index.ts'),
    (r'D:\Projects\SafariZetu Automation\safarizetu-ops-engine\src\services\email-templates\enquiry-acknowledgement.ts', '/opt/safarizetu-ops-engine/src/services/email-templates/enquiry-acknowledgement.ts'),
    (r'D:\Projects\SafariZetu Automation\safarizetu-ops-engine\src\services\email-templates\booking-confirmation.ts', '/opt/safarizetu-ops-engine/src/services/email-templates/booking-confirmation.ts'),
    (r'D:\Projects\SafariZetu Automation\safarizetu-ops-engine\src\services\email-templates\revenue-report.ts', '/opt/safarizetu-ops-engine/src/services/email-templates/revenue-report.ts'),
]

for local, remote in files_to_upload:
    try:
        sftp.put(local, remote)
        print(f'  {remote.split("/")[-1]}')
    except Exception as e:
        print(f'  ERROR: {remote.split("/")[-1]}: {e}')

sftp.close()

# Step 2: Verify files on server
print('\nStep 2: Verifying files on server...')
stdin, stdout, stderr = ssh.exec_command('grep -n "emails/preview" /opt/safarizetu-ops-engine/src/index.ts')
result = stdout.read().decode().strip()
print(f'  index.ts has email preview: {"YES" if result else "NO"}')

stdin, stdout, stderr = ssh.exec_command('ls /opt/safarizetu-ops-engine/src/services/email-template-helpers.ts')
result2 = stdout.read().decode().strip()
print(f'  email-template-helpers.ts exists: {"YES" if result2 else "NO"}')

# Step 3: Delete the old email-templates.ts if it still exists (naming collision)
stdin, stdout, stderr = ssh.exec_command('ls /opt/safarizetu-ops-engine/src/services/email-templates.ts 2>/dev/null && echo EXISTS')
old_file = stdout.read().decode().strip()
if old_file:
    print('\n  Removing old email-templates.ts (naming collision)...')
    ssh.exec_command('rm /opt/safarizetu-ops-engine/src/services/email-templates.ts')

# Step 4: Touch Dockerfile to bust cache
ssh.exec_command('touch /opt/safarizetu-ops-engine/infrastructure/Dockerfile.ops')
ssh.exec_command('echo "# rebuild $(date)" >> /opt/safarizetu-ops-engine/infrastructure/Dockerfile.ops')

# Step 5: Rebuild Docker image
print('\nStep 5: Rebuilding Docker image (this may take a few minutes)...')
stdin, stdout, stderr = ssh.exec_command(
    'cd /opt/safarizetu-ops-engine/infrastructure && docker build --no-cache -t safarizetu-ops-engine:latest -f Dockerfile.ops ..',
    timeout=600
)

# Read output
output = ''
while True:
    try:
        chunk = stdout.read(4096)
        if not chunk:
            break
        output += chunk.decode()
    except:
        break

# Check for success
if 'exporting to image' in output:
    print('  Build SUCCESS!')
else:
    print(f'  Build output (last 500 chars): {output[-500:]}')

# Step 6: Recreate container
print('\nStep 6: Recreating container...')
stdin, stdout, stderr = ssh.exec_command(
    'cd /opt/safarizetu-ops-engine/infrastructure && docker compose up -d --force-recreate ops-engine'
)
print(stdout.read().decode())

# Step 7: Wait for healthy
print('\nStep 7: Waiting for container to be healthy...')
for i in range(20):
    time.sleep(5)
    stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
    health = stdout.read().decode().strip()
    if health and 'ok' in health:
        print(f'  [{i*5}s] HEALTHY: {health}')
        break
    print(f'  [{i*5}s] Waiting...')

# Step 8: Test email preview
print('\nStep 8: Testing email preview...')
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
