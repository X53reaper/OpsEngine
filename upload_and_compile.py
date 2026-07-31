import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

sftp = ssh.open_sftp()

# Upload fixed files
files_to_upload = [
    (r'D:\Projects\SafariZetu Automation\safarizetu-ops-engine\src\agents\division1-growth.ts', '/opt/safarizetu-ops-engine/src/agents/division1-growth.ts'),
    (r'D:\Projects\SafariZetu Automation\safarizetu-ops-engine\src\services\email-templates\index.ts', '/opt/safarizetu-ops-engine/src/services/email-templates/index.ts'),
]

for local, remote in files_to_upload:
    sftp.put(local, remote)
    print(f'Uploaded: {remote.split("/")[-1]}')

sftp.close()

# Copy files into container
container_id = '8ad84cbecc4a'

print('\nCopying files into container...')
commands = [
    f'docker cp /opt/safarizetu-ops-engine/src/agents/division1-growth.ts {container_id}:/app/src/agents/division1-growth.ts',
    f'docker cp /opt/safarizetu-ops-engine/src/services/email-templates/index.ts {container_id}:/app/src/services/email-templates/index.ts',
]

for cmd in commands:
    stdin, stdout, stderr = ssh.exec_command(cmd)
    err = stderr.read().decode()
    if err:
        print(f'  Error: {err.strip()}')
    else:
        print(f'  OK: {cmd.split("/")[-1]}')

# Recompile TypeScript
print('\nCompiling TypeScript...')
stdin, stdout, stderr = ssh.exec_command(
    f'docker exec {container_id} /usr/local/bin/tsc --outDir /app/dist 2>&1',
    timeout=120
)
out = stdout.read().decode()
if out:
    print(f'  Compilation output (first 500 chars): {out[:500]}')

# Restart container
print('\nRestarting container...')
stdin, stdout, stderr = ssh.exec_command(f'docker restart {container_id}')
time.sleep(10)

# Check health
stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
print(f'\nHealth: {stdout.read().decode()}')

# Test email preview
print('\nTesting email preview...')
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
