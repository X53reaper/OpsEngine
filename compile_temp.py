import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

# Step 1: Compile TypeScript in a temporary container
print('Step 1: Compiling TypeScript in temporary container...')
stdin, stdout, stderr = ssh.exec_command(
    'docker run --rm -v /opt/safarizetu-ops-engine/src:/app/src -v /opt/safarizetu-ops-engine/tsconfig.json:/app/tsconfig.json -w /app safarizetu-ops-engine:latest sh -c "npm install -g typescript 2>/dev/null && tsc --outDir dist"',
    timeout=180
)
output = stdout.read().decode()
error = stderr.read().decode()
if output:
    print(f'  stdout: {output[:500]}')
if error:
    print(f'  stderr: {error[:500]}')

# Step 2: Check if dist was created
print('\nStep 2: Checking compiled output...')
stdin, stdout, stderr = ssh.exec_command(
    'docker run --rm -v /opt/safarizetu-ops-engine/src:/app/src safarizetu-ops-engine:latest ls -la /app/dist/services/observability.service.js 2>&1'
)
print(f'  {stdout.read().decode().strip()}')

# Step 3: Copy compiled files to server dist directory
print('\nStep 3: Copying compiled dist to server...')
stdin, stdout, stderr = ssh.exec_command(
    'docker run --rm -v /opt/safarizetu-ops-engine:/data -w /data safarizetu-ops-engine:latest cp -r /app/src /tmp/src_backup 2>&1 || true'
)

# Actually, let me just copy the dist from the temp container to the server
# Better approach: mount the whole project and compile
stdin, stdout, stderr = ssh.exec_command(
    'docker run --rm -v /opt/safarizetu-ops-engine:/project -w /project safarizetu-ops-engine:latest sh -c "npm install -g typescript 2>/dev/null && cd src && tsc --outDir ../dist_from_src"',
    timeout=180
)
output2 = stdout.read().decode()
error2 = stderr.read().decode()
if output2:
    print(f'  compile2 stdout: {output2[:500]}')
if error2:
    print(f'  compile2 stderr: {error2[:500]}')

# Check the compiled files
stdin, stdout, stderr = ssh.exec_command('ls -la /opt/safarizetu-ops-engine/dist_from_src/services/ 2>&1')
print(f'\n  dist_from_src contents: {stdout.read().decode().strip()}')

ssh.close()
