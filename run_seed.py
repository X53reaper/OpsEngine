import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789')

db_url = "postgresql://postgres:yaIcpiFUcjqGMBxVdtcVMKRNRXxAxjWK@yamanote.proxy.rlwy.net:44936/railway?sslmode=require"

# Upload seed SQL
sftp = ssh.open_sftp()
with open(r"D:\Projects\SafariZetu Automation\seed_production_fixed.sql", "r") as f:
    seed_content = f.read()
with sftp.open('/root/seed_fixed.sql', 'w') as f:
    f.write(seed_content)
sftp.close()
time.sleep(2)

# Run seed SQL
cmd = f'docker run --rm -v /root/seed_fixed.sql:/tmp/seed.sql:ro postgres:16 psql "{db_url}" -f /tmp/seed.sql'
stdin, stdout, stderr = ssh.exec_command(cmd)
time.sleep(30)
out = stdout.read().decode('ascii', errors='replace')
err = stderr.read().decode('ascii', errors='replace')
print("SEED OUTPUT:")
print(out)
if err:
    print("STDERR:", err)

# Verify
sftp2 = ssh.open_sftp()
with sftp2.open('/root/verify2.sql', 'w') as f:
    f.write("""SELECT 'Destination' as tbl, COUNT(*) as cnt FROM "Destination"
UNION ALL SELECT 'Operator', COUNT(*) FROM "Operator"
UNION ALL SELECT 'Listing', COUNT(*) FROM "Listing"
UNION ALL SELECT 'Setting', COUNT(*) FROM "Setting"
UNION ALL SELECT 'HeroSlide', COUNT(*) FROM "HeroSlide"
UNION ALL SELECT 'Category', COUNT(*) FROM "Category"
ORDER BY tbl;""")
sftp2.close()
time.sleep(2)

cmd2 = f'docker run --rm -v /root/verify2.sql:/tmp/verify.sql:ro postgres:16 psql "{db_url}" -f /tmp/verify.sql'
stdin2, stdout2, stderr2 = ssh.exec_command(cmd2)
time.sleep(10)
print("\nVERIFICATION:")
print(stdout2.read().decode('ascii', errors='replace'))

ssh.close()
