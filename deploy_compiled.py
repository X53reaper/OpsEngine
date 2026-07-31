import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

container_id = '8ad84cbecc4a'

# Step 1: Start the container (it will crash but we need it running to copy files)
print('Step 1: Starting container...')
ssh.exec_command(f'docker start {container_id}')
time.sleep(3)

# Step 2: Copy compiled dist into the container
print('\nStep 2: Copying compiled dist into container...')
commands = [
    # Copy services directory
    f'docker cp /opt/safarizetu-ops-engine/dist_from_src/services {container_id}:/app/dist/services_tmp',
    # Copy agents directory  
    f'docker cp /opt/safarizetu-ops-engine/dist_from_src/agents {container_id}:/app/dist/agents_tmp',
    # Copy root files
    f'docker cp /opt/safarizetu-ops-engine/dist_from_src/index.js {container_id}:/app/dist/index.js',
    f'docker cp /opt/safarizetu-ops-engine/dist_from_src/index.d.ts {container_id}:/app/dist/index.d.ts',
]

for cmd in commands:
    stdin, stdout, stderr = ssh.exec_command(cmd)
    err = stderr.read().decode()
    if err:
        print(f'  Error: {err.strip()[:200]}')
    else:
        print(f'  OK')

# Step 3: Replace the old dist with new one
print('\nStep 3: Replacing old dist with new...')
commands2 = [
    f'docker exec {container_id} rm -rf /app/dist/services /app/dist/agents',
    f'docker exec {container_id} mv /app/dist/services_tmp /app/dist/services',
    f'docker exec {container_id} mv /app/dist/agents_tmp /app/dist/agents',
]
for cmd in commands2:
    stdin, stdout, stderr = ssh.exec_command(cmd)
    err = stderr.read().decode()
    if err:
        print(f'  Error: {err.strip()[:200]}')
    else:
        print(f'  OK')

# Step 4: Verify key files
print('\nStep 4: Verifying key files...')
stdin, stdout, stderr = ssh.exec_command(f'docker exec {container_id} ls -la /app/dist/services/observability.service.js /app/dist/services/email-template-helpers.js /app/dist/index.js')
print(stdout.read().decode().strip())

# Step 5: Restart container
print('\nStep 5: Restarting container...')
ssh.exec_command(f'docker restart {container_id}')
time.sleep(10)

# Step 6: Check health
print('\nStep 6: Checking health...')
for i in range(6):
    time.sleep(5)
    stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
    health = stdout.read().decode().strip()
    if health and 'ok' in health:
        print(f'  [{i*5}s] HEALTHY: {health}')
        break
    print(f'  [{i*5}s] Waiting... {health[:100]}')

# Step 7: Test email preview
print('\nStep 7: Testing email preview...')
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
