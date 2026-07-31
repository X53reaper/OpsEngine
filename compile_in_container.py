import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

container_id = '8ad84cbecc4a'

# Step 1: Install TypeScript in container
print('Step 1: Installing TypeScript in container...')
stdin, stdout, stderr = ssh.exec_command(
    f'docker exec {container_id} npm install typescript --no-save',
    timeout=60
)
out = stdout.read().decode()
err = stderr.read().decode()
print(f'  npm install: {out.strip()[-200:] if out else "done"}')
if err:
    print(f'  npm stderr: {err.strip()[-200:]}')

# Step 2: Compile TypeScript
print('\nStep 2: Compiling TypeScript...')
stdin, stdout, stderr = ssh.exec_command(
    f'docker exec {container_id} ./node_modules/.bin/tsc --outDir /app/dist',
    timeout=120
)
out = stdout.read().decode()
err = stderr.read().decode()
print(f'  tsc stdout: {out.strip()[-300:] if out else "empty"}')
print(f'  tsc stderr: {err.strip()[-500:] if err else "empty"}')

# Step 3: Verify compiled files exist
print('\nStep 3: Verifying compiled files...')
stdin, stdout, stderr = ssh.exec_command(
    f'docker exec {container_id} ls -la /app/dist/services/email-templates.js /app/dist/index.js'
)
out = stdout.read().decode()
print(f'  {out.strip()}')

# Step 4: Restart container
print('\nStep 4: Restarting container...')
stdin, stdout, stderr = ssh.exec_command(f'docker restart {container_id}')
time.sleep(8)

# Step 5: Check health
stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
print(f'\nStep 5: Health: {stdout.read().decode()}')

# Step 6: Test email preview
print('\nStep 6: Testing email preview...')
stdin, stdout, stderr = ssh.exec_command(
    """curl -s -X POST http://localhost:3000/api/emails/preview -H 'Content-Type: application/json' -d '{"template":"enquiry-acknowledgement","data":{"touristName":"John","enquiryId":"ENQ-001","destination":"Victoria Falls"}}'"""
)
output = stdout.read().decode()
if 'error' in output.lower() or 'Not found' in output:
    print(f'  ERROR: {output[:500]}')
else:
    print(f'  SUCCESS! Email HTML length: {len(output)} chars')
    print(f'  Preview (first 500 chars): {output[:500]}')

ssh.close()
