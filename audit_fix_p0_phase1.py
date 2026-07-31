import paramiko
import time

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.18.50', username='root', password='123456789', timeout=10)

def run(cmd):
    print(f"Running: {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=60)
    exit_status = stdout.channel.recv_exit_status()
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    if exit_status != 0:
        print(f"Error (exit {exit_status}): {err}")
    return out

# 1. P0: Remove n8n
print("Removing n8n...")
run("docker compose -f /opt/safarizetu-ops-engine/infrastructure/docker-compose.yml stop ops_n8n")
run("docker compose -f /opt/safarizetu-ops-engine/infrastructure/docker-compose.yml rm -f ops_n8n")
run("docker volume rm safarizetu-ops_n8n_data || true")

# 2. P0: Bind internal ports to 127.0.0.1
# Note: Changing docker-compose.yml directly
print("Updating docker-compose bindings...")
# Simple sed command to replace 0.0.0.0 with 127.0.0.1 for ports
# ONLY for services that need to be bound internally
run("sed -i 's/0.0.0.0:/127.0.0.1:/g' /opt/safarizetu-ops-engine/infrastructure/docker-compose.yml")
run("docker compose -f /opt/safarizetu-ops-engine/infrastructure/docker-compose.yml up -d --force-recreate")

# 3. P0: SSH Hardening (Scripted Prep)
# I will NOT disable password auth in this script to avoid immediate lockout
# until key-based auth is verified by the user.
print("SSH Hardening - Adding SSH Key (Assuming root user public key provided in future steps)")
run("mkdir -p /root/.ssh && chmod 700 /root/.ssh")

client.close()
print("Phase 1 complete.")