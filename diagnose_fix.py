import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

container_id = '8ad84cbecc4a'

# Force stop the container
print('Force stopping container...')
ssh.exec_command(f'docker kill {container_id}')
time.sleep(3)

# Check if stopped
stdin, stdout, stderr = ssh.exec_command(f'docker inspect --format="{{{{.State.Status}}}}" {container_id}')
print(f'Status: {stdout.read().decode().strip()}')

# Now run diagnostics while container is stopped
stdin, stdout, stderr = ssh.exec_command(f'docker exec {container_id} wc -c /app/dist/services/observability.service.js 2>&1')
print(f'observability.service.js size: {stdout.read().decode().strip()}')

# Run tsc from within container
stdin, stdout, stderr = ssh.exec_command(
    f'docker run --rm -v /opt/safarizetu-ops-engine/src:/src -v /opt/safarizetu-ops-engine/tsconfig.json:/tsconfig.json safarizetu-ops-engine:latest /usr/local/bin/tsc --noEmit --project /tsconfig.json 2>&1',
    timeout=120
)
tsc_output = stdout.read().decode()
print(f'\nTSC errors:')
print(tsc_output[:3000] if tsc_output else 'No errors')

# If there are errors, fix the naming collision by renaming email-templates.ts
if 'error' in tsc_output.lower():
    print('\n--- Naming collision detected! Renaming email-templates.ts ---')
    # The issue: email-templates.ts conflicts with email-templates/ directory
    # Rename the file to email-template-helpers.ts
    ssh.exec_command('mv /opt/safarizetu-ops-engine/src/services/email-templates.ts /opt/safarizetu-ops-engine/src/services/email-template-helpers.ts')
    time.sleep(1)
    
    # Update imports in email-templates/*.ts to use new name
    stdin, stdout, stderr = ssh.exec_command("sed -i \"s|'../email-templates'|'../email-template-helpers'|g\" /opt/safarizetu-ops-engine/src/services/email-templates/*.ts")
    stdout.read()
    
    # Update imports in division1-growth.ts
    stdin, stdout, stderr = ssh.exec_command("sed -i \"s|'../services/email-templates'|'../services/email-template-helpers'|g\" /opt/safarizetu-ops-engine/src/agents/division1-growth.ts")
    stdout.read()
    
    # Update imports in index.ts
    stdin, stdout, stderr = ssh.exec_command("sed -i \"s|'./services/email-templates'|'./services/email-template-helpers'|g\" /opt/safarizetu-ops-engine/src/index.ts")
    stdout.read()
    
    print('Renamed and updated imports.')
    
    # Verify
    stdin, stdout, stderr = ssh.exec_command('ls /opt/safarizetu-ops-engine/src/services/email-template*')
    print(f'Files: {stdout.read().decode().strip()}')
    
    # Re-run tsc
    stdin, stdout, stderr = ssh.exec_command(
        f'docker run --rm -v /opt/safarizetu-ops-engine/src:/src -v /opt/safarizetu-ops-engine/tsconfig.json:/tsconfig.json safarizetu-ops-engine:latest /usr/local/bin/tsc --noEmit --project /tsconfig.json 2>&1',
        timeout=120
    )
    tsc_output2 = stdout.read().decode()
    print(f'\nTSC errors after rename:')
    print(tsc_output2[:3000] if tsc_output2 else 'No errors - SUCCESS!')

ssh.close()
