import paramiko
import time
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='ascii', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789')

# Step 1: Compile the updated TypeScript in container
print("=" * 60)
print("STEP 1: Compile TypeScript in container")
print("=" * 60)

# Use the project's tsconfig.json
cmd1 = "docker exec ops_engine sh -c 'cd /app && npx tsc src/services/ai-agent.service.ts --outDir dist/services --esModuleInterop --resolveJsonModule --skipLibCheck --ignoreConfig 2>&1'"
stdin1, stdout1, stderr1 = ssh.exec_command(cmd1)
time.sleep(30)
out1 = stdout1.read().decode('ascii', errors='replace')
err1 = stderr1.read().decode('ascii', errors='replace')
print(f"Compile: {out1[:300]}")
if err1.strip():
    print(f"ERR: {err1[:300]}")

# Step 2: Restart with correct service name
print("\n" + "=" * 60)
print("STEP 2: Restart ops-engine with new env vars")
print("=" * 60)

cmd2 = "cd /opt/safarizetu-ops-engine/infrastructure && docker compose up -d --force-recreate ops-engine 2>&1"
stdin2, stdout2, stderr2 = ssh.exec_command(cmd2)
time.sleep(40)
out2 = stdout2.read().decode('ascii', errors='replace')
print(out2[:500])

# Step 3: Wait for health
print("\n" + "=" * 60)
print("STEP 3: Wait for health and verify")
print("=" * 60)

time.sleep(15)
cmd3 = "curl -s http://localhost:3000/health"
stdin3, stdout3, stderr3 = ssh.exec_command(cmd3)
time.sleep(5)
print(stdout3.read().decode('ascii', errors='replace'))

# Step 4: Verify test mode env vars
print("\n" + "=" * 60)
print("STEP 4: Verify test mode env vars in container")
print("=" * 60)

cmd4 = "docker exec ops_engine env | grep EMAIL_TEST"
stdin4, stdout4, stderr4 = ssh.exec_command(cmd4)
time.sleep(5)
print(stdout4.read().decode('ascii', errors='replace'))

# Step 5: Check that the compiled JS has the test mode logic
print("\n" + "=" * 60)
print("STEP 5: Verify compiled JS has test mode logic")
print("=" * 60)

cmd5 = "docker exec ops_engine grep -c 'EMAIL_TEST_MODE' /app/dist/services/ai-agent.service.js"
stdin5, stdout5, stderr5 = ssh.exec_command(cmd5)
time.sleep(5)
print(f"EMAIL_TEST_MODE references in compiled JS: {stdout5.read().decode('ascii', errors='replace').strip()}")

ssh.close()
