import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

container_id = '8ad84cbecc4a'

# Step 1: Stop the container
print('Step 1: Stopping container...')
stdin, stdout, stderr = ssh.exec_command(f'docker stop {container_id}')
time.sleep(3)
print(f'  {stdout.read().decode().strip()}')

# Step 2: Copy all source files into the container
print('\nStep 2: Copying source files into container...')
commands = [
    f'docker cp /opt/safarizetu-ops-engine/src/services/email-templates.ts {container_id}:/app/src/services/email-templates.ts',
    f'docker cp /opt/safarizetu-ops-engine/src/services/email-templates/ {container_id}:/app/src/services/email-templates/',
    f'docker cp /opt/safarizetu-ops-engine/src/agents/division1-growth.ts {container_id}:/app/src/agents/division1-growth.ts',
    f'docker cp /opt/safarizetu-ops-engine/src/index.ts {container_id}:/app/src/index.ts',
]

for cmd in commands:
    stdin, stdout, stderr = ssh.exec_command(cmd)
    err = stderr.read().decode()
    if err:
        print(f'  Error: {err.strip()}')
    else:
        print(f'  OK')

# Step 3: Compile TypeScript (container is stopped, so use docker start with a command)
print('\nStep 3: Compiling TypeScript...')
# Start container temporarily to compile
stdin, stdout, stderr = ssh.exec_command(f'docker start {container_id}')
time.sleep(3)

# Wait for container to be running
for i in range(6):
    time.sleep(3)
    stdin, stdout, stderr = ssh.exec_command(f'docker inspect --format="{{{{.State.Status}}}}" {container_id}')
    status = stdout.read().decode().strip()
    if status == 'running':
        break

# Compile
stdin, stdout, stderr = ssh.exec_command(
    f'docker exec {container_id} /usr/local/bin/tsc --outDir /app/dist 2>&1',
    timeout=180
)
out = stdout.read().decode()
if out:
    print(f'  Output (first 1000 chars):')
    print(out[:1000])
else:
    print('  No output (success!)')

# Step 4: Verify compiled files
print('\nStep 4: Verifying compiled files...')
stdin, stdout, stderr = ssh.exec_command(
    f'docker exec {container_id} ls -la /app/dist/services/email-templates.js /app/dist/services/observability.service.js /app/dist/agents/division1-growth.js /app/dist/index.js 2>&1'
)
print(stdout.read().decode())

# Step 5: Restart container
print('\nStep 5: Restarting container...')
stdin, stdout, stderr = ssh.exec_command(f'docker restart {container_id}')
time.sleep(10)

# Step 6: Check health
stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
print(f'\nStep 6: Health: {stdout.read().decode()}')

# Step 7: Test email preview
print('\nStep 7: Testing email preview...')
payload = '{"template":"enquiry-acknowledgement","data":{"touristName":"John","enquiryId":"ENQ-001","destination":"Victoria Falls"}}'
cmd = f"curl -s -X POST http://localhost:3000/api/emails/preview -H 'Content-Type: application/json' -d '{payload}'"
stdin, stdout, stderr = ssh.exec_command(cmd)
output = stdout.read().decode()
if 'error' in output.lower() or 'Not found' in output:
    print(f'  ERROR: {output[:500]}')
else:
    print(f'  SUCCESS! Email HTML length: {len(output)} chars')
    print(f'  Preview: {output[:500]}')

ssh.close()
