import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=15)

# Force recreate to pick up .env changes
print("Force recreating ops_engine container...")
stdin, stdout, stderr = ssh.exec_command('cd /opt/safarizetu-ops-engine/infrastructure && docker compose up -d --force-recreate ops_engine 2>&1')
output = stdout.read().decode()
err = stderr.read().decode()
print(output)
if err:
    print("STDERR:", err)

# Wait for healthy
print("Waiting for container to become healthy...")
for i in range(30):
    time.sleep(5)
    stdin, stdout, stderr = ssh.exec_command('docker inspect --format="{{.State.Health.Status}}" ops_engine 2>/dev/null')
    health = stdout.read().decode().strip()
    print(f"  [{i*5}s] Health: {health}")
    if health == 'healthy':
        break

# Verify env vars are gone
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine printenv | grep EMAIL_TEST')
env_check = stdout.read().decode().strip()
print(f"\nRunning container EMAIL_TEST vars: {env_check if env_check else '(none - clean)'}")

# Verify health endpoint
stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
health_resp = stdout.read().decode().strip()
print(f"Health endpoint: {health_resp}")

ssh.close()
