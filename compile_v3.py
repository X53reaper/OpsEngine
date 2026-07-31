import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

container_id = '8ad84cbecc4a'

# Step 1: Install TypeScript globally
print('Step 1: Installing TypeScript globally...')
stdin, stdout, stderr = ssh.exec_command(
    f'docker exec {container_id} npm install -g typescript',
    timeout=60
)
out = stdout.read().decode()
err = stderr.read().decode()
print(f'  {out.strip()[-200:] if out else "done"}')

# Step 2: Find tsc
print('\nStep 2: Finding tsc...')
stdin, stdout, stderr = ssh.exec_command(
    f'docker exec {container_id} which tsc'
)
tsc_path = stdout.read().decode().strip()
print(f'  tsc at: {tsc_path}')

# Step 3: Compile TypeScript
print('\nStep 3: Compiling TypeScript...')
stdin, stdout, stderr = ssh.exec_command(
    f'docker exec {container_id} {tsc_path} --outDir /app/dist',
    timeout=120
)
out = stdout.read().decode()
err = stderr.read().decode()
if out:
    print(f'  tsc output: {out[:500]}')
if err:
    print(f'  tsc errors: {err[:500]}')

# Step 4: Verify compiled files
print('\nStep 4: Verifying compiled files...')
stdin, stdout, stderr = ssh.exec_command(
    f'docker exec {container_id} ls -la /app/dist/services/email-templates.js /app/dist/services/email-templates/ /app/dist/index.js /app/dist/agents/division1-growth.js'
)
print(f'  {stdout.read().decode().strip()}')

# Step 5: Restart container
print('\nStep 5: Restarting container...')
stdin, stdout, stderr = ssh.exec_command(f'docker restart {container_id}')
time.sleep(10)

# Step 6: Check health
stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
print(f'\nStep 6: Health: {stdout.read().decode()}')

# Step 7: Test email preview
print('\nStep 7: Testing email preview...')
stdin, stdout, stderr = ssh.exec_command(
    """curl -s -X POST http://localhost:3000/api/emails/preview -H 'Content-Type: application/json' -d '{"template":"enquiry-acknowledgement","data":{"touristName":"John","enquiryId":"ENQ-001","destination":"Victoria Falls"}}'"""
)
output = stdout.read().decode()
if 'error' in output.lower() or 'Not found' in output:
    print(f'  ERROR: {output[:500]}')
else:
    print(f'  SUCCESS! Email HTML length: {len(output)} chars')
    print(f'  Preview: {output[:500]}')

ssh.close()
