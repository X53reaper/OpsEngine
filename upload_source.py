import paramiko
import os

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

sftp = ssh.open_sftp()

# Upload email-templates.ts
local_path = r'D:\Projects\SafariZetu Automation\safarizetu-ops-engine\src\services\email-templates.ts'
remote_path = '/opt/safarizetu-ops-engine/src/services/email-templates.ts'
sftp.put(local_path, remote_path)
print(f'Uploaded: {local_path} -> {remote_path}')

# Create remote directory for email templates
try:
    sftp.mkdir('/opt/safarizetu-ops-engine/src/services/email-templates')
except:
    pass

# Upload email template files
template_files = [
    'enquiry-acknowledgement.ts',
    'booking-confirmation.ts',
    'revenue-report.ts',
    'index.ts'
]

for f in template_files:
    local_path = rf'D:\Projects\SafariZetu Automation\safarizetu-ops-engine\src\services\email-templates\{f}'
    remote_path = f'/opt/safarizetu-ops-engine/src/services/email-templates/{f}'
    sftp.put(local_path, remote_path)
    print(f'Uploaded: {f}')

# Upload updated division1-growth.ts
local_path = r'D:\Projects\SafariZetu Automation\safarizetu-ops-engine\src\agents\division1-growth.ts'
remote_path = '/opt/safarizetu-ops-engine/src/agents/division1-growth.ts'
sftp.put(local_path, remote_path)
print(f'Uploaded: division1-growth.ts')

# Upload updated index.ts
local_path = r'D:\Projects\SafariZetu Automation\safarizetu-ops-engine\src\index.ts'
remote_path = '/opt/safarizetu-ops-engine/src/index.ts'
sftp.put(local_path, remote_path)
print(f'Uploaded: index.ts')

sftp.close()
ssh.close()
print('\nAll files uploaded successfully!')
