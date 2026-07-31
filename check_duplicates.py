import paramiko
import json

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=15)

# Check for duplicate destinations in production DB
stdin, stdout, stderr = ssh.exec_command('''docker run --rm postgres:16 psql "postgresql://postgres:yaIcpiFUcjqGMBxVdtcVMKRNRXxAxjWK@yamanote.proxy.rlwy.net:44936/railway?sslmode=require" -c "SELECT name, COUNT(*) as cnt FROM \"Destination\" GROUP BY name HAVING COUNT(*) > 1 ORDER BY cnt DESC;"''')
print("Duplicate destinations:")
print(stdout.read().decode())

# Check for duplicate slugs
stdin, stdout, stderr = ssh.exec_command('''docker run --rm postgres:16 psql "postgresql://postgres:yaIcpiFUcjqGMBxVdtcVMKRNRXxAxjWK@yamanote.proxy.rlwy.net:44936/railway?sslmode=require" -c "SELECT slug, COUNT(*) as cnt FROM \"Destination\" GROUP BY slug HAVING COUNT(*) > 1 ORDER BY cnt DESC;"''')
print("\nDuplicate slugs:")
print(stdout.read().decode())

ssh.close()
