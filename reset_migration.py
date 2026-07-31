import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789')

db_url = "postgresql://postgres:yaIcpiFUcjqGMBxVdtcVMKRNRXxAxjWK@yamanote.proxy.rlwy.net:44936/railway?sslmode=require"

# Step 1: Clear the failed migration entry
sql1 = 'DELETE FROM "_prisma_migrations" WHERE "migration_name" = \'1779262174894_add_filename_cloudflareid_to_destinationimage\';'

cmd1 = f"""docker run --rm postgres:16 psql "{db_url}" -c "{sql1}" """
stdin1, stdout1, stderr1 = ssh.exec_command(cmd1)
time.sleep(8)
print("CLEAR FAILED MIGRATION:")
print(stdout1.read().decode())
err1 = stderr1.read().decode()
if err1:
    print("STDERR:", err1)

# Step 2: Verify it's cleared
sql2 = 'SELECT * FROM "_prisma_migrations";'
cmd2 = f"""docker run --rm postgres:16 psql "{db_url}" -c "{sql2}" """
stdin2, stdout2, stderr2 = ssh.exec_command(cmd2)
time.sleep(8)
print("\nVERIFY CLEAR:")
print(stdout2.read().decode())
ssh.close()
