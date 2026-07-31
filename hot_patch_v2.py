import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

# Find container ID
stdin, stdout, stderr = ssh.exec_command("docker ps -q --filter name=ops_engine")
container_id = stdout.read().decode().strip()
print(f'Container: {container_id}')

# Step 1: Copy source files into the container
print('\nStep 1: Copying source files into container...')
commands = [
    f'docker cp /opt/safarizetu-ops-engine/src/services/email-templates.ts {container_id}:/app/src/services/email-templates.ts',
    f'docker cp /opt/safarizetu-ops-engine/src/services/email-templates/ {container_id}:/app/src/services/email-templates/',
    f'docker cp /opt/safarizetu-ops-engine/src/agents/division1-growth.ts {container_id}:/app/src/agents/division1-growth.ts',
    f'docker cp /opt/safarizetu-ops-engine/src/index.ts {container_id}:/app/src/index.ts',
]

for cmd in commands:
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
    out = stdout.read().decode()
    err = stderr.read().decode()
    status = 'OK' if not err else f'ERR: {err.strip()}'
    print(f'  {cmd.split("/")[-1]}: {status}')

# Step 2: Compile TypeScript inside the container
print('\nStep 2: Compiling TypeScript inside container...')
stdin, stdout, stderr = ssh.exec_command(
    f'docker exec {container_id} npx tsc --outDir /app/dist',
    timeout=120
)
out = stdout.read().decode()
err = stderr.read().decode()
if out:
    print(f'  STDOUT: {out[:300]}')
if err:
    print(f'  STDERR: {err[:500]}')

# Step 3: Restart the container
print('\nStep 3: Restarting container...')
stdin, stdout, stderr = ssh.exec_command(f'docker restart {container_id}')
print(f'  {stdout.read().decode().strip()}')

# Step 4: Wait and verify
print('\nStep 4: Waiting for container to be ready...')
time.sleep(8)

stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
health = stdout.read().decode()
print(f'  Health: {health}')

# Step 5: Test email preview
print('\nStep 5: Testing email preview endpoint...')
stdin, stdout, stderr = ssh.exec_command(
    """curl -s -X POST http://localhost:3000/api/emails/preview -H 'Content-Type: application/json' -d '{"template":"enquiry-acknowledgement","data":{"touristName":"John","enquiryId":"ENQ-001","destination":"Victoria Falls"}}'"""
)
output = stdout.read().decode()
if 'error' in output.lower() or 'Not found' in output:
    print(f'  ERROR: {output[:500]}')
else:
    print(f'  SUCCESS! Email HTML length: {len(output)} chars')
    print(f'  First 500 chars: {output[:500]}')

ssh.close()
