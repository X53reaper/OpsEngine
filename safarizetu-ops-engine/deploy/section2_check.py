import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

# Required tables checklist
required_tables = [
    'enquiry_log', 'operator_activation_queue', 'lead_pipeline',
    'partnership_pipeline', 'outreach_log', 'content_queue',
    'agent_run_log', 'approval_queue', 'platform_settings',
    'commission_rate_history'
]

print("--- REQUIRED TABLES CHECKLIST ---")
for table in required_tables:
    result = run(f"docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c \"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '{table}');\" | grep -o 't\\|f'")
    status = "[OK]" if "t" in result else "[MISSING]"
    print(f"  {status} {table}")

# Check platform_settings
print("\n--- PLATFORM_SETTINGS ---")
print(run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c 'SELECT * FROM platform_settings;' 2>&1"))

# Table count
print("\n--- TABLE COUNT ---")
print(run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';\""))

# Run migrations if any
print("\n--- MIGRATIONS ---")
print(run("ls /opt/safarizetu-ops-engine/database/migrations/ 2>/dev/null || echo 'No migration files found'"))

# Check agent_run_log structure
print("\n--- AGENT_RUN_LOG STRUCTURE ---")
print(run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c '\\d agent_run_log' 2>&1 | head -30"))

# Check approval_queue structure
print("\n--- APPROVAL_QUEUE STRUCTURE ---")
print(run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c '\\d approval_queue' 2>&1 | head -20"))

c.close()