import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

# Get DB credentials from ops engine .env
print("=== OPS ENGINE DB CONFIG ===")
db_host = run("grep '^DB_HOST=' /opt/safarizetu-ops-engine/.env | cut -d= -f2-")
db_port = run("grep '^DB_PORT=' /opt/safarizetu-ops-engine/.env | cut -d= -f2-")
db_name = run("grep '^DB_NAME=' /opt/safarizetu-ops-engine/.env | cut -d= -f2-")
db_user = run("grep '^DB_USER=' /opt/safarizetu-ops-engine/.env | cut -d= -f2-")
db_pass = run("grep '^DB_PASSWORD=' /opt/safarizetu-ops-engine/.env | cut -d= -f2-")
print(f"  DB_HOST={db_host}")
print(f"  DB_PORT={db_port}")
print(f"  DB_NAME={db_name}")
print(f"  DB_USER={db_user}")
print(f"  DB_PASSWORD={'*' * len(db_pass)}")

# Also check DATABASE_URL
db_url = run("grep '^DATABASE_URL=' /opt/safarizetu-ops-engine/.env | cut -d= -f2-")
print(f"  DATABASE_URL={db_url}")

# Try connecting with the correct user
print(f"\n=== CONNECTING WITH USER: {db_user} ===")
result = run(f"docker exec ops_postgres psql -U {db_user} -d {db_name} -c '\\dt' 2>&1")
print(f"  Tables:\n{result}")

# Check enquiry_log
result = run(f"docker exec ops_postgres psql -U {db_user} -d {db_name} -c 'SELECT COUNT(*) FROM enquiry_log;' 2>&1")
print(f"  enquiry_log count: {result}")

# Check agent_run_log
result = run(f"docker exec ops_postgres psql -U {db_user} -d {db_name} -c 'SELECT COUNT(*) FROM agent_run_log;' 2>&1")
print(f"  agent_run_log count: {result}")

# List all data in enquiry_log
result = run(f"docker exec ops_postgres psql -U {db_user} -d {db_name} -c 'SELECT id, listing_name, customer_name, status, created_at FROM enquiry_log ORDER BY created_at DESC LIMIT 10;' 2>&1")
print(f"  enquiry_log data:\n{result}")

# List agent_run_log
result = run(f"docker exec ops_postgres psql -U {db_user} -d {db_name} -c 'SELECT agent_name, event_type, status, cost_usd, created_at FROM agent_run_log ORDER BY created_at DESC LIMIT 10;' 2>&1")
print(f"  agent_run_log data:\n{result}")

c.close()