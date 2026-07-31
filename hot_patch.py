import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

# Step 1: Compile TypeScript on the server
print('Step 1: Compiling TypeScript on server...')
stdin, stdout, stderr = ssh.exec_command(
    'cd /opt/safarizetu-ops-engine && npx tsc --outDir dist',
    timeout=60
)
out = stdout.read().decode()
err = stderr.read().decode()
if out:
    print('STDOUT:', out[:500])
if err:
    print('STDERR:', err[:500])

# Step 2: Find the container ID
print('\nStep 2: Finding ops_engine container...')
stdin, stdout, stderr = ssh.exec_command(
    "docker ps -q --filter name=ops_engine"
)
container_id = stdout.read().decode().strip()
print(f'Container ID: {container_id}')

# Step 3: Copy compiled JS into the running container
print('\nStep 3: Copying compiled JS into container...')
commands = [
    f'docker cp /opt/safarizetu-ops-engine/dist/services/email-templates.js {container_id}:/app/dist/services/email-templates.js',
    f'docker cp /opt/safarizetu-ops-engine/dist/services/email-templates/ {container_id}:/app/dist/services/email-templates/',
    f'docker cp /opt/safarizetu-ops-engine/dist/agents/division1-growth.js {container_id}:/app/dist/agents/division1-growth.js',
    f'docker cp /opt/safarizetu-ops-engine/dist/index.js {container_id}:/app/dist/index.js',
]

for cmd in commands:
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out:
        print(f'  {out.strip()}')
    if err:
        print(f'  ERR: {err.strip()}')

# Step 4: Restart the container to pick up new code
print('\nStep 4: Restarting container...')
stdin, stdout, stderr = ssh.exec_command(
    f'docker restart {container_id}'
)
print(stdout.read().decode())

# Step 5: Wait and verify
print('\nStep 5: Waiting for container to be ready...')
time.sleep(8)

stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
health = stdout.read().decode()
print(f'Health: {health}')

# Step 6: Test email preview
print('\nStep 6: Testing email preview endpoint...')
stdin, stdout, stderr = ssh.exec_command(
    """curl -s -X POST http://localhost:3000/api/emails/preview -H 'Content-Type: application/json' -d '{"template":"enquiry-acknowledgement","data":{"touristName":"John","enquiryId":"ENQ-001","destination":"Victoria Falls"}}'"""
)
output = stdout.read().decode()
if 'error' in output.lower() or 'Not found' in output:
    print('ERROR:', output[:500])
else:
    print(f'SUCCESS! Email HTML length: {len(output)} chars')
    print('First 500 chars:', output[:500])

ssh.close()
