import paramiko
import time

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

# Section 2: Seed platform_settings if empty
print("=== SEEDING platform_settings ===")
# Check if table has data
result = run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c 'SELECT COUNT(*) FROM platform_settings;' 2>&1")
print(f"  Current count: {result}")

# Insert default if empty
if "0" in result and "ERROR" not in result:
    insert_result = run("""docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c "INSERT INTO platform_settings (commission_rate, commission_rate_label) VALUES (0.15, '15%') ON CONFLICT DO NOTHING;" 2>&1""")
    print(f"  Insert: {insert_result}")

# Verify
verify = run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c 'SELECT * FROM platform_settings;' 2>&1")
print(f"  After seed: {verify}")

# Run migrations (non-destructive)
print("\n=== RUNNING MIGRATIONS ===")
migrations = run("ls /opt/safarizetu-ops-engine/database/migrations/ 2>/dev/null")
print(f"  Found: {migrations}")

for migration in migrations.strip().split("\n"):
    if migration:
        print(f"  Running: {migration}")
        result = run(f"docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -f /docker-entrypoint-initdb.d/{migration} 2>&1 | tail -3")
        print(f"    {result}")

# Section 3: Webhook receiver check
print("\n" + "=" * 60)
print("  SECTION 3 — WEBHOOK RECEIVER ACTIVATION")
print("=" * 60)

# Find webhook files
print("\n--- WEBHOOK FILES ---")
print(run("docker exec ops_engine find /app/src -iname '*webhook*' -type f 2>/dev/null"))

# Check index.ts for webhook route
print("\n--- INDEX.TS WEBHOOK ROUTE ---")
print(run("docker exec ops_engine cat /app/src/index.ts | grep -A 10 'webhook/safari-zetu' | head -15"))

# Check if server.ts exists
print("\n--- SERVER.TS CHECK ---")
print(run("docker exec ops_engine ls /app/src/server.ts 2>/dev/null || echo 'server.ts does not exist'"))

# Check what entry point is used
print("\n--- ENTRY POINT ---")
print(run("docker exec ops_engine cat /app/package.json | grep -A 3 '\"start\"'"))

# Check what's actually running
print("\n--- RUNNING PROCESS ---")
print(run("docker exec ops_engine ps aux | grep node | grep -v grep"))

# Health endpoint test
print("\n--- HEALTH ENDPOINT ---")
print(run("curl -s http://localhost:3000/health"))

# Check webhook route
print("\n--- WEBHOOK TEST ---")
print(run("curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3000/webhook/safari-zetu"))

c.close()