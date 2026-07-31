import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

print("=== CHECKING POSTGRES ===")
# Check if postgres container is running
result = run("docker ps --format '{{.Names}} {{.Status}}' | grep postgres")
print(f"  Container: {result}")

# Check tables via psql directly
result = run("docker exec ops_postgres psql -U safarizetu -d safarizetu_ops -c '\\dt' 2>&1")
print(f"  Tables: {result[:1000]}")

# Check enquiry_log
result = run("docker exec ops_postgres psql -U safarizetu -d safarizetu_ops -c 'SELECT COUNT(*) FROM enquiry_log;' 2>&1")
print(f"  enquiry_log count: {result}")

# Check agent_run_log
result = run("docker exec ops_postgres psql -U safarizetu -d safarizetu_ops -c 'SELECT COUNT(*) FROM agent_run_log;' 2>&1")
print(f"  agent_run_log count: {result}")

# Check all data in enquiry_log
result = run("docker exec ops_postgres psql -U safarizetu -d safarizetu_ops -c 'SELECT id, listing_name, customer_name, status, created_at FROM enquiry_log ORDER BY created_at DESC LIMIT 10;' 2>&1")
print(f"  enquiry_log data:\n{result}")

# Check agent_run_log recent
result = run("docker exec ops_postgres psql -U safarizetu -d safarizetu_ops -c 'SELECT agent_name, event_type, status, cost_usd, created_at FROM agent_run_log ORDER BY created_at DESC LIMIT 10;' 2>&1")
print(f"  agent_run_log data:\n{result}")

c.close()