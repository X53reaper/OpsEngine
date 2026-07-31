import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

# Section 1 Report
print("=" * 60)
print("  SECTION 1 — BRIDGE STATUS REPORT")
print("=" * 60)
print("""
RESULT: 401 — API KEY MISMATCH

The Safari Zetu bridge exists at https://safarizetu.com/api/ops-bridge
but returns 401 Unauthorized.

FIX NEEDED: The API key in this engine's .env (SAFARI_ZETU_API_KEY)
must match the OPS_ENGINE_API_KEY on safarizetu.com.

Continuing with other sections — Section 8 end-to-end test will
partially fail until this is fixed.
""")

# Section 2: Database migration and seed verification
print("=" * 60)
print("  SECTION 2 — DATABASE MIGRATION AND SEED VERIFICATION")
print("=" * 60)

# List all tables
print("\n--- ALL TABLES ---")
print(run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c \"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;\""))

# Required tables checklist
required_tables = [
    'enquiry_log', 'operator_activation_queue', 'lead_pipeline',
    'partnership_pipeline', 'outreach_log', 'content_queue',
    'agent_run_log', 'approval_queue', 'platform_settings',
    'commission_rate_history'
]

print("\n--- REQUIRED TABLES CHECKLIST ---")
for table in required_tables:
    result = run(f"docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c \"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '{table}');\" | grep -o 't\\|f'")
    status = "✅" if "t" in result else "❌"
    print(f"  {status} {table}: {'EXISTS' if 't' in result else 'MISSING'}")

# Check platform_settings
print("\n--- PLATFORM_SETTINGS ---")
print(run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c 'SELECT * FROM platform_settings;' 2>&1"))

# Table count
print("\n--- TABLE COUNT ---")
print(run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';\""))

# Run migrations if any
print("\n--- MIGRATIONS ---")
print(run("ls /opt/safarizetu-ops-engine/database/migrations/ 2>/dev/null || echo 'No migration files found'"))

c.close()