import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

container_id = '8ad84cbecc4a'

# Step 1: Stop the container
print('Step 1: Stopping container...')
ssh.exec_command(f'docker kill {container_id}')
time.sleep(3)

# Step 2: Restore the original dist from the image
print('\nStep 2: Restoring original dist from Docker image...')
commands = [
    # Extract original dist from the image
    f'docker create --name temp_extract safarizetu-ops-engine:latest',
    f'docker cp temp_extract:/app/dist /opt/safarizetu-ops-engine/original_dist',
    f'docker rm temp_extract',
]
for cmd in commands:
    stdin, stdout, stderr = ssh.exec_command(cmd)
    err = stderr.read().decode()
    if err:
        print(f'  {cmd.split()[1]}: {err.strip()[:200]}')
    else:
        print(f'  OK: {cmd.split()[1]}')

# Step 3: Copy original dist into the stopped container
print('\nStep 3: Copying original dist into container...')
stdin, stdout, stderr = ssh.exec_command(f'docker cp /opt/safarizetu-ops-engine/original_dist {container_id}:/app/dist_orig')
err = stderr.read().decode()
print(f'  Copy: {"OK" if not err else err.strip()[:200]}')

# Step 4: Replace dist with original + patched new files
print('\nStep 4: Patching with new email templates...')
# Start container with sleep to keep it alive
ssh.exec_command(f'docker start {container_id}')
time.sleep(2)

# Restore original dist
for attempt in range(5):
    stdin, stdout, stderr = ssh.exec_command(f'docker exec {container_id} sh -c "rm -rf /app/dist && mv /app/dist_orig /app/dist"')
    err = stderr.read().decode()
    if not err:
        print('  Original dist restored!')
        break
    print(f'  Attempt {attempt+1}: retrying...')
    time.sleep(2)

# Now compile TypeScript properly inside the container with proper tsc
print('\nStep 5: Installing TypeScript and compiling in container...')
# First copy all src files into the container
stdin, stdout, stderr = ssh.exec_command(f'docker cp /opt/safarizetu-ops-engine/src {container_id}:/app/src_new')
err = stderr.read().decode()
print(f'  Copy src: {"OK" if not err else err.strip()[:200]}')

# Install tsc and compile
stdin, stdout, stderr = ssh.exec_command(
    f'docker exec {container_id} sh -c "npm install -g typescript 2>/dev/null && cd /app && tsc --outDir dist_new 2>&1"',
    timeout=180
)
output = stdout.read().decode()
if output:
    # Show only errors, not warnings
    errors = [l for l in output.split('\n') if 'error TS' in l]
    if errors:
        print(f'  TS Errors ({len(errors)}):')
        for e in errors[:5]:
            print(f'    {e.strip()[:200]}')
    else:
        print(f'  Compiled with warnings only')

# Step 6: Check if the critical files exist
print('\nStep 6: Verifying compiled output...')
stdin, stdout, stderr = ssh.exec_command(
    f'docker exec {container_id} sh -c "ls -la /app/dist_new/services/observability.service.js /app/dist_new/index.js /app/dist_new/services/email-template-helpers.js 2>&1"'
)
print(f'  {stdout.read().decode().strip()}')

# Check if index.js requires paths match
stdin, stdout, stderr = ssh.exec_command(
    f'docker exec {container_id} head -5 /app/dist_new/index.js'
)
print(f'  index.js first 5 lines: {stdout.read().decode().strip()[:300]}')

# Step 7: Stop container, replace dist, restart
print('\nStep 7: Final replacement...')
ssh.exec_command(f'docker stop {container_id}')
time.sleep(3)

# Verify file structure matches
stdin, stdout, stderr = ssh.exec_command(
    f'docker exec {container_id} sh -c "diff <(ls /app/dist/services/ | sort) <(ls /app/dist_new/services/ | sort) 2>&1 | head -20"'
)
diff_output = stdout.read().decode()
if diff_output.strip():
    print(f'  Diff in services/: {diff_output.strip()[:300]}')
else:
    print('  services/ directories match!')

# Check agents diff
stdin, stdout, stderr = ssh.exec_command(
    f'docker exec {container_id} sh -c "diff <(ls /app/dist/agents/ | sort) <(ls /app/dist_new/agents/ | sort) 2>&1 | head -20"'
)
diff_output2 = stdout.read().decode()
if diff_output2.strip():
    print(f'  Diff in agents/: {diff_output2.strip()[:300]}')
else:
    print('  agents/ directories match!')

# Replace with the properly compiled version
stdin, stdout, stderr = ssh.exec_command(
    f'docker exec {container_id} sh -c "rm -rf /app/dist && mv /app/dist_new /app/dist"'
)
err = stderr.read().decode()
print(f'  Replace: {"OK" if not err else err.strip()[:200]}')

# Step 8: Start and verify
print('\nStep 8: Starting container...')
ssh.exec_command(f'docker start {container_id}')
time.sleep(15)

stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
health = stdout.read().decode().strip()
print(f'  Health: {health}')

if 'ok' in health:
    # Test email preview
    print('\nStep 9: Testing email preview...')
    payload = '{"template":"enquiry-acknowledgement","data":{"touristName":"John","enquiryId":"ENQ-001","destination":"Victoria Falls"}}'
    cmd = f"curl -s -X POST http://localhost:3000/api/emails/preview -H 'Content-Type: application/json' -d '{payload}'"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    output = stdout.read().decode()
    if 'error' in output.lower() or 'Not found' in output or len(output) < 100:
        print(f'  ERROR: {output[:500]}')
    else:
        print(f'  SUCCESS! Email HTML length: {len(output)} chars')
        print(f'  Preview: {output[:500]}')
else:
    print('\nContainer not healthy. Checking logs...')
    stdin, stdout, stderr = ssh.exec_command(f'docker logs {container_id} --tail 10 2>&1')
    print(stdout.read().decode())

ssh.close()
