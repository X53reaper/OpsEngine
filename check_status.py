import paramiko, time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

time.sleep(5)

# Check container status
stdin, stdout, stderr = ssh.exec_command('docker ps -a --filter name=ops_engine --format "{{.Status}}"')
print('Status:', stdout.read().decode())

# Check logs
stdin, stdout, stderr = ssh.exec_command('docker logs 8ad84cbecc4a --tail 20 2>&1')
print('Logs:', stdout.read().decode())

# Check if files are in place
stdin, stdout, stderr = ssh.exec_command('docker exec 8ad84cbecc4a ls -la /app/dist/services/observability.service.js 2>&1')
print('File check:', stdout.read().decode())

# Check email-template-helpers.js
stdin, stdout, stderr = ssh.exec_command('docker exec 8ad84cbecc4a ls -la /app/dist/services/email-template-helpers.js 2>&1')
print('Email helpers:', stdout.read().decode())

ssh.close()
