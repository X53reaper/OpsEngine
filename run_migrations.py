import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789')

db_url = "postgresql://postgres:yaIcpiFUcjqGMBxVdtcVMKRNRXxAxjWK@yamanote.proxy.rlwy.net:44936/railway?sslmode=require"

# Read the SQL file
with open(r"D:\Projects\SafariZetu Automation\combined_migrations.sql", "r") as f:
    sql_content = f.read()

# Write SQL to server via SFTP
sftp = ssh.open_sftp()
with sftp.open('/root/migrations.sql', 'w') as f:
    f.write(sql_content)
sftp.close()

# Use docker run with a volume mount from the host path
# The server is Linux, so the path is /root/migrations.sql
cmd = f'docker run --rm -v /root/migrations.sql:/tmp/migrations.sql:ro postgres:16 psql "{db_url}" -f /tmp/migrations.sql'
stdin, stdout, stderr = ssh.exec_command(cmd)
time.sleep(30)
print("MIGRATION OUTPUT:")
out = stdout.read().decode()
print(out)
err = stderr.read().decode()
if err:
    print("STDERR:", err)

# Verify tables
verify_cmd = f'docker run --rm postgres:16 psql "{db_url}" -c "SELECT tablename FROM pg_tables WHERE schemaname=\'public\' ORDER BY tablename;"'
stdin2, stdout2, stderr2 = ssh.exec_command(verify_cmd)
time.sleep(10)
print("\nALL TABLES:")
print(stdout2.read().decode())

ssh.close()
