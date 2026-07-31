import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789')

db_url = "postgresql://postgres:yaIcpiFUcjqGMBxVdtcVMKRNRXxAxjWK@yamanote.proxy.rlwy.net:44936/railway?sslmode=require"

sql = 'SELECT * FROM "_prisma_migrations" ORDER BY "started_at";'

cmd = f"""docker run --rm postgres:16 psql "{db_url}" -c "{sql}" """
stdin, stdout, stderr = ssh.exec_command(cmd)
time.sleep(8)
print("PRISMA MIGRATIONS:")
print(stdout.read().decode())
err = stderr.read().decode()
if err:
    print("STDERR:", err)

# Also check all tables
sql2 = "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;"
cmd2 = f"""docker run --rm postgres:16 psql "{db_url}" -c "{sql2}" """
stdin2, stdout2, stderr2 = ssh.exec_command(cmd2)
time.sleep(8)
print("\nALL TABLES:")
print(stdout2.read().decode())
ssh.close()
