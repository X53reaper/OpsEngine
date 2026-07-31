import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

DB_USER = "ops_admin"
DB_PASS = "He3Qyz4x5q71uHDUG_15Z8GbAe4HqnRc"
DB_NAME = "safarizetu_ops"

print("=== POSTGRESQL CHECKS ===")

# List tables
print("\n--- TABLES ---")
result = run(f"docker exec ops_postgres psql -U {DB_USER} -d {DB_NAME} -c '\\dt' 2>&1")
print(f"{result}")

# enquiry_log count
print("\n--- ENQUIRY LOG COUNT ---")
result = run(f"docker exec ops_postgres psql -U {DB_USER} -d {DB_NAME} -c 'SELECT COUNT(*) FROM enquiry_log;' 2>&1")
print(f"{result}")

# enquiry_log data
print("\n--- ENQUIRY LOG DATA ---")
result = run(f"docker exec ops_postgres psql -U {DB_USER} -d {DB_NAME} -c 'SELECT id, listing_name, customer_name, customer_email, status, created_at FROM enquiry_log ORDER BY created_at DESC LIMIT 10;' 2>&1")
print(f"{result}")

# agent_run_log count
print("\n--- AGENT RUN LOG COUNT ---")
result = run(f"docker exec ops_postgres psql -U {DB_USER} -d {DB_NAME} -c 'SELECT COUNT(*) FROM agent_run_log;' 2>&1")
print(f"{result}")

# agent_run_log data
print("\n--- AGENT RUN LOG DATA ---")
result = run(f"docker exec ops_postgres psql -U {DB_USER} -d {DB_NAME} -c 'SELECT agent_name, event_type, listing_name, status, cost_usd, created_at FROM agent_run_log ORDER BY created_at DESC LIMIT 10;' 2>&1")
print(f"{result}")

# operator_activation_queue
print("\n--- OPERATOR ACTIVATION QUEUE ---")
result = run(f"docker exec ops_postgres psql -U {DB_USER} -d {DB_NAME} -c 'SELECT COUNT(*) FROM operator_activation_queue;' 2>&1")
print(f"{result}")

# lead_pipeline
print("\n--- LEAD PIPELINE ---")
result = run(f"docker exec ops_postgres psql -U {DB_USER} -d {DB_NAME} -c 'SELECT COUNT(*) FROM lead_pipeline;' 2>&1")
print(f"{result}")

c.close()