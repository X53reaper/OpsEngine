import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

container_id = 'ops_engine'

# Step 1: Stop container
print('Step 1: Stopping container...')
ssh.exec_command(f'docker stop {container_id}')
time.sleep(3)

# Step 2: Use sed to fix the require paths directly in the container
print('\nStep 2: Fixing require paths with sed...')

# First, let's extract the file, fix it locally, and put it back
ssh.exec_command(f'docker cp {container_id}:/app/dist/index.js /tmp/index.js')
time.sleep(1)

# Read the file
stdin, stdout, stderr = ssh.exec_command('cat /tmp/index.js')
content = stdout.read().decode('utf-8', errors='replace')

# Fix all three require paths
# The issue is the file has extra blank lines between each line
# Let's normalize and fix

# Replace the exact patterns
fixes = [
    ("require('./services/email-template-helpers')", "require('./services/email-templates/enquiry-acknowledgement')"),
    ("require('./services/email-template-helpers')", "require('./services/email-templates/booking-confirmation')"),
    ("require('./services/email-template-helpers')", "require('./services/email-templates/revenue-report')"),
]

# Actually, let's just do a global replace of the incorrect path
# The email-template-helpers module doesn't export these functions
# We need to import from the correct sub-modules

# Strategy: replace the first occurrence with enquiry-acknowledgement
# second with booking-confirmation, third with revenue-report

import re

# Find all occurrences of the require path
pattern = r"require\('./services/email-template-helpers'\)"
matches = list(re.finditer(pattern, content))
print(f'  Found {len(matches)} occurrences of incorrect require path')

if len(matches) >= 3:
    # Replace each occurrence with the correct path
    replacements = [
        './services/email-templates/enquiry-acknowledgement',
        './services/email-templates/booking-confirmation',
        './services/email-templates/revenue-report',
    ]
    
    # Replace in reverse order to preserve positions
    for i in range(len(matches) - 1, -1, -1):
        old = matches[i].group(0)
        new = f"require('{replacements[i]}')"
        content = content[:matches[i].start()] + new + content[matches[i].end():]
    
    print(f'  Replaced all {len(matches)} occurrences with correct paths')

# Write the fixed file
with open(r'C:\Users\marsm\AppData\Local\Temp\index_fixed.js', 'w', encoding='utf-8') as f:
    f.write(content)

# Upload to server
sftp = ssh.open_sftp()
sftp.put(r'C:\Users\marsm\AppData\Local\Temp\index_fixed.js', '/tmp/index_fixed.js')
sftp.close()

# Copy into container
stdin, stdout, stderr = ssh.exec_command(f'docker cp /tmp/index_fixed.js {container_id}:/app/dist/index.js')
err = stderr.read().decode()
print(f'  Copy: {"OK" if not err else err.strip()[:200]}')

# Step 3: Verify the fix
print('\nStep 3: Verifying fix...')
ssh.exec_command(f'docker cp /tmp/index_fixed.js /tmp/index_verify.js')
stdin, stdout, stderr = ssh.exec_command('grep -n "require.*email" /tmp/index_verify.js')
print(f'  {stdout.read().decode().strip()[:500]}')

# Step 4: Start container
print('\nStep 4: Starting container...')
ssh.exec_command(f'docker start {container_id}')
time.sleep(10)

# Step 5: Check health
stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
health = stdout.read().decode().strip()
print(f'\n  Health: {health}')

if 'ok' in health:
    # Step 6: Test email preview
    print('\nStep 6: Testing email preview...')
    payload = '{"template":"enquiry-acknowledgement","data":{"touristName":"John","enquiryId":"ENQ-001","destination":"Victoria Falls"}}'
    cmd = f"curl -s -X POST http://localhost:3000/api/emails/preview -H 'Content-Type: application/json' -d '{payload}'"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    output = stdout.read().decode()
    if 'error' in output.lower() or 'Not found' in output or len(output) < 100:
        print(f'  Response: {output[:500]}')
    else:
        print(f'  SUCCESS! Email HTML length: {len(output)} chars')
        print(f'  Preview: {output[:500]}')

ssh.close()
