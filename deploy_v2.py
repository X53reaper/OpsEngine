import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

container_id = '8ad84cbecc4a'

# Step 1: Stop the container completely
print('Step 1: Stopping container...')
ssh.exec_command(f'docker kill {container_id}')
time.sleep(3)

# Verify stopped
stdin, stdout, stderr = ssh.exec_command(f'docker inspect --format="{{{{.State.Status}}}}" {container_id}')
print(f'  Status: {stdout.read().decode().strip()}')

# Step 2: Copy compiled dist into stopped container (docker cp works on stopped containers)
print('\nStep 2: Copying compiled dist into stopped container...')
commands = [
    (f'docker cp /opt/safarizetu-ops-engine/dist_from_src/services {container_id}:/app/dist/services_tmp', 'services dir'),
    (f'docker cp /opt/safarizetu-ops-engine/dist_from_src/agents {container_id}:/app/dist/agents_tmp', 'agents dir'),
    (f'docker cp /opt/safarizetu-ops-engine/dist_from_src/index.js {container_id}:/app/dist/index.js', 'index.js'),
]

for cmd, label in commands:
    stdin, stdout, stderr = ssh.exec_command(cmd)
    err = stderr.read().decode()
    print(f'  {label}: {"OK" if not err else err.strip()[:200]}')

# Step 3: Move files (use docker start with a command)
print('\nStep 3: Moving files into place...')
# Start container with a sleep command to give us time
ssh.exec_command(f'docker start {container_id}')
time.sleep(2)

# Immediately try to move files
for attempt in range(3):
    stdin, stdout, stderr = ssh.exec_command(f'docker exec {container_id} sh -c "rm -rf /app/dist/services /app/dist/agents && mv /app/dist/services_tmp /app/dist/services && mv /app/dist/agents_tmp /app/dist/agents"')
    err = stderr.read().decode()
    if not err:
        print('  Files moved successfully!')
        break
    print(f'  Attempt {attempt+1}: {err.strip()[:200]}')
    time.sleep(2)

# Step 4: Restart
print('\nStep 4: Restarting container...')
ssh.exec_command(f'docker restart {container_id}')
time.sleep(15)

# Step 5: Check health
print('\nStep 5: Checking health...')
stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
health = stdout.read().decode().strip()
print(f'  Health: {health}')

# Step 6: Test email preview
print('\nStep 6: Testing email preview...')
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
