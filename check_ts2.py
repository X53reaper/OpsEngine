import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=15)

# Check if typescript is installed
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine ls /app/node_modules/typescript/lib/typescript.js 2>&1')
print("Typescript lib:", stdout.read().decode().strip())

# Check npm list
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine sh -c "cd /app && npm list typescript 2>&1"')
print("npm list:", stdout.read().decode().strip())

# Try a simpler require test
sftp = ssh.open_sftp()
with sftp.open('/tmp/test_ts.js', 'w') as f:
    f.write("try { const ts = require('/app/node_modules/typescript'); console.log('TS version:', ts.version); } catch(e) { console.log('Error:', e.message); }\n")
sftp.close()

stdin, stdout, stderr = ssh.exec_command('docker cp /tmp/test_ts.js ops_engine:/tmp/test_ts.js')
time.sleep(1)

stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine node /tmp/test_ts.js 2>&1')
print("Require test:", stdout.read().decode().strip())

ssh.close()
