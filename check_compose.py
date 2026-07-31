import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=15)

# Check service names in docker-compose
stdin, stdout, stderr = ssh.exec_command('grep -E "^[a-z].*:" /opt/safarizetu-ops-engine/infrastructure/docker-compose.yml | head -20')
print("Service names:")
print(stdout.read().decode())

# Check current env in .env
stdin, stdout, stderr = ssh.exec_command('grep "EMAIL_TEST" /opt/safarizetu-ops-engine/.env')
env_lines = stdout.read().decode().strip()
print(f"\n.env EMAIL_TEST lines: {env_lines if env_lines else '(none)'}")

# Force recreate all services
print("\nForce recreating all services...")
stdin, stdout, stderr = ssh.exec_command('cd /opt/safarizetu-ops-engine/infrastructure && docker compose up -d --force-recreate 2>&1')
output = stdout.read().decode()
err = stderr.read().decode()
print(output)
if err:
    print("STDERR:", err)

ssh.close()
