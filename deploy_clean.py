import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

# Step 1: Recreate the container from the image (this gives us a clean dist)
print('Step 1: Recreating container from image...')
stdin, stdout, stderr = ssh.exec_command(
    'cd /opt/safarizetu-ops-engine/infrastructure && docker compose up -d --force-recreate ops-engine'
)
print(stdout.read().decode())
print(stderr.read().decode())

# Step 2: Wait for healthy
print('\nStep 2: Waiting for container to be healthy...')
for i in range(20):
    time.sleep(5)
    stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
    health = stdout.read().decode().strip()
    if health and 'ok' in health:
        print(f'  [{i*5}s] HEALTHY: {health}')
        break
    print(f'  [{i*5}s] Waiting...')

# Step 3: Verify it works
stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
health = stdout.read().decode().strip()

if 'ok' in health:
    print(f'\nContainer healthy! Now patching email templates...')
    
    # Step 4: Install tsc in running container and compile ONLY the new files
    print('\nStep 4: Installing TypeScript in container...')
    stdin, stdout, stderr = ssh.exec_command(
        'docker exec ops_engine npm install -g typescript 2>&1'
    )
    print(f'  {stdout.read().decode().strip()[-100:]}')
    
    # Step 5: Copy the new source files into the running container
    print('\nStep 5: Copying new source files...')
    commands = [
        'docker cp /opt/safarizetu-ops-engine/src/services/email-template-helpers.ts ops_engine:/app/src/services/email-template-helpers.ts',
        'docker cp /opt/safarizetu-ops-engine/src/services/email-templates ops_engine:/app/src/services/email-templates',
        'docker cp /opt/safarizetu-ops-engine/src/agents/division1-growth.ts ops_engine:/app/src/agents/division1-growth.ts',
    ]
    for cmd in commands:
        stdin, stdout, stderr = ssh.exec_command(cmd)
        err = stderr.read().decode()
        print(f'  {cmd.split("/")[-1]}: {"OK" if not err else err.strip()[:100]}')
    
    # Step 6: Compile the new files using tsc
    print('\nStep 6: Compiling new TypeScript files...')
    stdin, stdout, stderr = ssh.exec_command(
        'docker exec ops_engine sh -c "cd /app && /usr/local/bin/tsc --outDir /tmp/new_dist 2>&1"',
        timeout=120
    )
    output = stdout.read().decode()
    errors = [l for l in output.split('\n') if 'error TS' in l]
    if errors:
        print(f'  TS errors ({len(errors)}):')
        for e in errors[:5]:
            print(f'    {e.strip()[:200]}')
    else:
        print('  Compiled successfully!')
    
    # Step 7: Copy only the new/changed files from the new compilation
    print('\nStep 7: Patching compiled files...')
    # Stop container to copy
    ssh.exec_command('docker stop ops_engine')
    time.sleep(3)
    
    patch_commands = [
        ('/tmp/new_dist/services/email-template-helpers.js', '/app/dist/services/email-template-helpers.js'),
        ('/tmp/new_dist/services/email-templates/', '/app/dist/services/email-templates/'),
        ('/tmp/new_dist/agents/division1-growth.js', '/app/dist/agents/division1-growth.js'),
    ]
    
    for src, dst in patch_commands:
        stdin, stdout, stderr = ssh.exec_command(f'docker cp ops_engine:{src} ops_engine:{dst} 2>&1')
        err = stderr.read().decode()
        print(f'  {dst.split("/")[-1]}: {"OK" if not err else err.strip()[:100]}')
    
    # Step 8: Restart
    print('\nStep 8: Restarting container...')
    ssh.exec_command('docker start ops_engine')
    time.sleep(15)
    
    # Step 9: Verify
    stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
    health = stdout.read().decode().strip()
    print(f'\n  Health: {health}')
    
    if 'ok' in health:
        print('\nStep 10: Testing email preview...')
        payload = '{"template":"enquiry-acknowledgement","data":{"touristName":"John","enquiryId":"ENQ-001","destination":"Victoria Falls"}}'
        cmd = f"curl -s -X POST http://localhost:3000/api/emails/preview -H 'Content-Type: application/json' -d '{payload}'"
        stdin, stdout, stderr = ssh.exec_command(cmd)
        output = stdout.read().decode()
        if 'error' in output.lower() or 'Not found' in output or len(output) < 100:
            print(f'  Response: {output[:500]}')
        else:
            print(f'  SUCCESS! Email HTML length: {len(output)} chars')
            print(f'  Preview: {output[:500]}')
else:
    print(f'\nContainer not healthy: {health}')
    stdin, stdout, stderr = ssh.exec_command('docker logs ops_engine --tail 10 2>&1')
    print(stdout.read().decode())

ssh.close()
