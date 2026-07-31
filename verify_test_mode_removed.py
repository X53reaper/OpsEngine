import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=15)

# Verify env vars are gone
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine printenv | grep EMAIL_TEST')
env_check = stdout.read().decode().strip()
if env_check:
    print("STILL PRESENT:", env_check)
else:
    print("[OK] EMAIL_TEST_MODE and EMAIL_TEST_OVERRIDE removed from running container")

# Verify health endpoint still works
stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
health_resp = stdout.read().decode().strip()
print("Health:", health_resp)

# Verify the compiled JS no longer has test mode logic
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine grep -c "EMAIL_TEST" /app/dist/services/ai-agent.service.js')
count = stdout.read().decode().strip()
print("EMAIL_TEST references in compiled JS:", count)

# Check the sendEmail function for test mode override
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine grep -n "testMode\|test_address\|test_address_override\|originalTo\|TEST.*intended" /app/dist/services/ai-agent.service.js')
test_refs = stdout.read().decode().strip()
print("Test mode references:", test_refs if test_refs else "(none)")

ssh.close()
