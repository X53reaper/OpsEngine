import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=15)

# Check if typescript is installed
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine sh -c "ls /app/node_modules/typescript 2>&1 && node -e \\"console.log(require.resolve(\'typescript\'))\\" 2>&1"')
print("TypeScript check:", stdout.read().decode())

# Check npm list
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine sh -c "cd /app && npm list typescript 2>&1"')
print("npm list:", stdout.read().decode())

# Try installing again with full path
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine sh -c "cd /app && npm install typescript@5.4.5 --save 2>&1 | tail -10"')
print("Install:", stdout.read().decode())

# Check again
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine sh -c "ls /app/node_modules/typescript/lib/typescript.js 2>&1"')
print("Typescript lib:", stdout.read().decode())

# Try to require it from /app
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine sh -c "cd /app && node -e \\"const ts = require(\\'typescript\\'); console.log(ts.version)\\" 2>&1"')
print("Require test:", stdout.read().decode())

ssh.close()
