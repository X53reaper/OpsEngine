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

# Step 2: Extract and patch index.js
print('\nStep 2: Patching index.js...')
ssh.exec_command(f'docker cp {container_id}:/app/dist/index.js /tmp/index.js')
time.sleep(1)

stdin, stdout, stderr = ssh.exec_command('cat /tmp/index.js')
content = stdout.read().decode('utf-8', errors='replace')

# Find and replace the incorrect require paths in the email preview endpoint
# Replace require('./services/email-template-helpers') with correct paths
old_imports = [
    ("require('./services/email-template-helpers')", "enquiryAcknowledgementEmail"),
    ("require('./services/email-template-helpers')", "bookingConfirmationEmail"),
    ("require('./services/email-template-helpers')", "revenueReportEmail"),
]

# Better approach: replace the entire email preview block with correct imports
old_block = """        if (template === 'enquiry-acknowledgement') {
          const { enquiryAcknowledgementEmail } = require('./services/email-template-helpers')"""

new_block = """        if (template === 'enquiry-acknowledgement') {
          const { enquiryAcknowledgementEmail } = require('./services/email-templates/enquiry-acknowledgement')"""

content = content.replace(old_block, new_block)

old_block2 = """        } else if (template === 'booking-confirmation') {
          const { bookingConfirmationEmail } = require('./services/email-template-helpers')"""

new_block2 = """        } else if (template === 'booking-confirmation') {
          const { bookingConfirmationEmail } = require('./services/email-templates/booking-confirmation')"""

content = content.replace(old_block2, new_block2)

old_block3 = """        } else if (template === 'revenue-report') {
          const { revenueReportEmail } = require('./services/email-template-helpers')"""

new_block3 = """        } else if (template === 'revenue-report') {
          const { revenueReportEmail } = require('./services/email-templates/revenue-report')"""

content = content.replace(old_block3, new_block3)

print('  Fixed import paths')

# Write patched file
with open(r'C:\Users\marsm\AppData\Local\Temp\index_patched2.js', 'w', encoding='utf-8') as f:
    f.write(content)

# Upload to server
sftp = ssh.open_sftp()
sftp.put(r'C:\Users\marsm\AppData\Local\Temp\index_patched2.js', '/tmp/index_patched2.js')
sftp.close()

# Copy into container
stdin, stdout, stderr = ssh.exec_command(f'docker cp /tmp/index_patched2.js {container_id}:/app/dist/index.js')
err = stderr.read().decode()
print(f'  Copy: {"OK" if not err else err.strip()[:200]}')

# Step 3: Start container
print('\nStep 3: Starting container...')
ssh.exec_command(f'docker start {container_id}')
time.sleep(10)

# Step 4: Check health
stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
health = stdout.read().decode().strip()
print(f'\n  Health: {health}')

if 'ok' in health:
    # Step 5: Test email preview
    print('\nStep 5: Testing email preview...')
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
