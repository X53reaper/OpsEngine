import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

container_id = '8ad84cbecc4a'

# Check the compiled email-templates.js exports
stdin, stdout, stderr = ssh.exec_command(f'docker exec {container_id} grep -n "exports" /app/dist/services/email-templates.js')
print('email-templates.js exports:', stdout.read().decode())

# Check division1-growth.js imports
stdin, stdout, stderr = ssh.exec_command(f'docker exec {container_id} head -10 /app/dist/agents/division1-growth.js')
print('division1-growth.js imports:', stdout.read().decode())

# Check observability.service.js exports
stdin, stdout, stderr = ssh.exec_command(f'docker exec {container_id} grep -n "exports" /app/dist/services/observability.service.js')
print('observability.service.js exports:', stdout.read().decode())

ssh.close()
