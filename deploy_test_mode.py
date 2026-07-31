import paramiko
import time
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='ascii', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789')

# Step 1: Add EMAIL_TEST_MODE and EMAIL_TEST_OVERRIDE to .env
print("=" * 60)
print("STEP 1: Add test mode env vars to .env")
print("=" * 60)

cmd1 = """grep -q 'EMAIL_TEST_MODE' /opt/safarizetu-ops-engine/.env || echo 'EMAIL_TEST_MODE=true' >> /opt/safarizetu-ops-engine/.env
grep -q 'EMAIL_TEST_OVERRIDE' /opt/safarizetu-ops-engine/.env || echo 'EMAIL_TEST_OVERRIDE=sirmarshalmuvhuni@gmail.com' >> /opt/safarizetu-ops-engine/.env"""

stdin1, stdout1, stderr1 = ssh.exec_command(cmd1)
time.sleep(3)
print("Added EMAIL_TEST_MODE=true and EMAIL_TEST_OVERRIDE=sirmarshalmuvhuni@gmail.com")

# Verify
cmd_verify = "grep -E 'EMAIL_TEST' /opt/safarizetu-ops-engine/.env"
stdin_v, stdout_v, stderr_v = ssh.exec_command(cmd_verify)
time.sleep(3)
print(stdout_v.read().decode('ascii', errors='replace'))

# Step 2: Copy updated source to container and recompile
print("\n" + "=" * 60)
print("STEP 2: Copy updated sendEmail to container and recompile")
print("=" * 60)

# Copy the updated file to the server
sftp = ssh.open_sftp()
with open(r"D:\Projects\SafariZetu Automation\safarizetu-ops-engine\src\services\ai-agent.service.ts", "r") as f:
    source = f.read()
with sftp.open('/tmp/ai-agent.service.ts', 'w') as f:
    f.write(source)
sftp.close()
time.sleep(2)

# Copy to container
cmd2 = "docker cp /tmp/ai-agent.service.ts ops_engine:/app/src/services/ai-agent.service.ts"
stdin2, stdout2, stderr2 = ssh.exec_command(cmd2)
time.sleep(5)
print("Copied source to container")

# Compile in container
cmd3 = "docker exec ops_engine npx tsc src/services/ai-agent.service.ts --outDir /app/dist/services --esModuleInterop --resolveJsonModule --skipLibCheck 2>&1"
stdin3, stdout3, stderr3 = ssh.exec_command(cmd3)
time.sleep(30)
out3 = stdout3.read().decode('ascii', errors='replace')
err3 = stderr3.read().decode('ascii', errors='replace')
if out3.strip():
    print(f"Compile: {out3[:300]}")
if err3.strip():
    print(f"Compile ERR: {err3[:300]}")

# Step 3: Restart the container to pick up new env vars
print("\n" + "=" * 60)
print("STEP 3: Restart ops engine with new env vars")
print("=" * 60)

cmd4 = "cd /opt/safarizetu-ops-engine/infrastructure && docker compose up -d --force-recreate ops_engine 2>&1"
stdin4, stdout4, stderr4 = ssh.exec_command(cmd4)
time.sleep(30)
out4 = stdout4.read().decode('ascii', errors='replace')
print(out4[:500])

# Step 4: Verify health
print("\n" + "=" * 60)
print("STEP 4: Verify health")
print("=" * 60)

time.sleep(10)
cmd5 = "curl -s http://localhost:3000/health"
stdin5, stdout5, stderr5 = ssh.exec_command(cmd5)
time.sleep(5)
print(stdout5.read().decode('ascii', errors='replace'))

# Step 5: Verify test mode is active
print("\n" + "=" * 60)
print("STEP 5: Verify test mode env vars")
print("=" * 60)

cmd6 = "docker exec ops_engine env | grep EMAIL_TEST"
stdin6, stdout6, stderr6 = ssh.exec_command(cmd6)
time.sleep(5)
print(stdout6.read().decode('ascii', errors='replace'))

ssh.close()
