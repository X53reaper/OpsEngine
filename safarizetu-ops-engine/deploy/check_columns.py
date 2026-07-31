import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

DB_USER = "ops_admin"
DB_NAME = "safarizetu_ops"

# Check enquiry_log columns
print("=== ENQUIRY LOG COLUMNS ===")
result = run(f"docker exec ops_postgres psql -U {DB_USER} -d {DB_NAME} -c \"SELECT column_name, data_type FROM information_schema.columns WHERE table_name='enquiry_log' ORDER BY ordinal_position;\" 2>&1")
print(result)

# Check enquiry_log data with all columns
print("\n=== ENQUIRY LOG DATA ===")
result = run(f"docker exec ops_postgres psql -U {DB_USER} -d {DB_NAME} -c 'SELECT * FROM enquiry_log ORDER BY created_at DESC LIMIT 5;' 2>&1")
print(result)

# Check agent_run_log columns
print("\n=== AGENT RUN LOG COLUMNS ===")
result = run(f"docker exec ops_postgres psql -U {DB_USER} -d {DB_NAME} -c \"SELECT column_name, data_type FROM information_schema.columns WHERE table_name='agent_run_log' ORDER BY ordinal_position;\" 2>&1")
print(result)

# Check agent_run_log data
print("\n=== AGENT RUN LOG DATA (LAST 5) ===")
result = run(f"docker exec ops_postgres psql -U {DB_USER} -d {DB_NAME} -c 'SELECT * FROM agent_run_log ORDER BY created_at DESC LIMIT 5;' 2>&1")
print(result)

# Check safarizetu-specific tables
print("\n=== SAFARIZETU TABLES (our custom ones) ===")
result = run(f"docker exec ops_postgres psql -U {DB_USER} -d {DB_NAME} -c \"SELECT tablename FROM pg_tables WHERE schemaname='public' AND (tablename LIKE '%enquiry%' OR tablename LIKE '%agent%' OR tablename LIKE '%content%' OR tablename LIKE '%competitor%' OR tablename LIKE '%outreach%' OR tablename LIKE '%partner%' OR tablename LIKE '%lead%' OR tablename LIKE '%approval%' OR tablename LIKE '%inventory%' OR tablename LIKE '%revenue%' OR tablename LIKE '%pricing%' OR tablename LIKE '%sustainability%') ORDER BY tablename;\" 2>&1")
print(result)

c.close()