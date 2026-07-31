import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

container_id = '8ad84cbecc4a'

# Check email-templates.js
stdin, stdout, stderr = ssh.exec_command(f'docker exec {container_id} cat /app/dist/services/email-templates.js')
content = stdout.read().decode()
print('email-templates.js (first 500 chars):')
print(content[:500])
print('...')

# Check division1-growth.js
stdin, stdout, stderr = ssh.exec_command(f'docker exec {container_id} cat /app/dist/agents/division1-growth.js')
content = stdout.read().decode()
print('\ndivision1-growth.js (first 500 chars):')
print(content[:500])

ssh.close()
