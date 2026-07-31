import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789')

db_url = "postgresql://postgres:yaIcpiFUcjqGMBxVdtcVMKRNRXxAxjWK@yamanote.proxy.rlwy.net:44936/railway?sslmode=require"

# Read the Prisma schema and add the URL to datasource block
with open(r"D:\Projects\SafariZetu\prisma\schema.prisma", "r") as f:
    schema_content = f.read()

# Fix the datasource block to include the URL
schema_content = schema_content.replace(
    'datasource db {\n  provider = "postgresql"\n}',
    f'datasource db {{\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}}'
)

# Create directory and write schema
stdin, stdout, stderr = ssh.exec_command("mkdir -p /tmp/prisma-prj/prisma")
time.sleep(2)

sftp = ssh.open_sftp()
with sftp.open('/tmp/prisma-prj/prisma/schema.prisma', 'w') as f:
    f.write(schema_content)
sftp.close()

# Run prisma db push with the DATABASE_URL env var
run_cmd = f'''docker run --rm \
  -v /tmp/prisma-prj:/app \
  -w /app \
  -e DATABASE_URL="{db_url}" \
  node:20-alpine \
  sh -c "npx prisma db push --schema=prisma/schema.prisma --accept-data-loss 2>&1"'''

stdin, stdout, stderr = ssh.exec_command(run_cmd)
time.sleep(180)
out = stdout.read().decode('utf-8', errors='replace')
err = stderr.read().decode('utf-8', errors='replace')
# Strip non-ASCII for Windows console
out = out.encode('ascii', errors='replace').decode('ascii')
err = err.encode('ascii', errors='replace').decode('ascii')
print("PRISMA DB PUSH OUTPUT:")
print(out)
if err:
    print("STDERR:", err)

# Verify tables
verify_cmd = f'docker run --rm postgres:16 psql "{db_url}" -c "SELECT count(*) as table_count FROM pg_tables WHERE schemaname=\'public\';"'
stdin2, stdout2, stderr2 = ssh.exec_command(verify_cmd)
time.sleep(10)
print("\nTABLE COUNT:")
t2 = stdout2.read().decode('utf-8', errors='replace').encode('ascii', errors='replace').decode('ascii')
print(t2)

# List all tables
list_cmd = f'docker run --rm postgres:16 psql "{db_url}" -c "SELECT tablename FROM pg_tables WHERE schemaname=\'public\' ORDER BY tablename;"'
stdin3, stdout3, stderr3 = ssh.exec_command(list_cmd)
time.sleep(10)
print("\nALL TABLES:")
t3 = stdout3.read().decode('utf-8', errors='replace').encode('ascii', errors='replace').decode('ascii')
print(t3)

ssh.close()
