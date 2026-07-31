import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

# The new compiled index.js has the email preview endpoint but wrong paths
# The old index.js has correct paths but no email preview endpoint
# Solution: Add the email preview endpoint to the OLD index.js

print('Reading new index.js for email preview endpoint code...')
stdin, stdout, stderr = ssh.exec_command('cat /tmp/new_dist/index.js')
new_index = stdout.read().decode()

# Extract the email preview endpoint block
# Look for the /api/emails/preview route
import re
# Find the email preview handler
match = re.search(r"// POST /api/emails/preview.*?return\s*\}", new_index, re.DOTALL)
if match:
    email_preview_code = match.group(0)
    print(f'Found email preview code ({len(email_preview_code)} chars)')
else:
    print('Could not find email preview code in new index.js')
    # Let me search more broadly
    lines = new_index.split('\n')
    for i, line in enumerate(lines):
        if 'emails/preview' in line:
            print(f'  Line {i}: {line.strip()[:150]}')

ssh.close()
