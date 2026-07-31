import paramiko
import time

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd):
    _, o, _ = c.exec_command(cmd, timeout=30)
    return o.read().decode("utf-8", errors="replace").strip()

# 1. Check enquiry_log schema
print("=== ENQUIRY_LOG SCHEMA ===")
out = run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c '\\d enquiry_log'")
print(out)

# 2. Add test data with correct schema
print("\n=== ADDING TEST DATA ===")
sql = """INSERT INTO enquiry_log (safari_zetu_enquiry_id, tourist_name, tourist_email, tourist_country, operator_name, destination, travel_dates, group_size, budget_range, special_requests, status, created_at, updated_at) 
VALUES ('test-001', 'John Test', 'test1@example.com', 'USA', 'Safari Zetu', 'Victoria Falls', '2026-08-15 to 2026-08-22', 2, '5000-8000', 'Want luxury lodge', 'new', NOW(), NOW()),
('test-002', 'Jane Test', 'test2@example.com', 'UK', 'Safari Zetu', 'Hwange', '2026-09-01 to 2026-09-08', 4, '3000-5000', 'Photography focused', 'new', NOW(), NOW()),
('test-003', 'Bob Test', 'test3@example.com', 'Germany', 'Safari Zetu', 'Mana Pools', '2026-07-20 to 2026-07-27', 2, '7000-10000', 'Walking safari', 'contacted', NOW(), NOW())
ON CONFLICT (safari_zetu_enquiry_id) DO NOTHING;"""
out = run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c " + '"' + sql + '"')
print(out)

out = run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c \"SELECT safari_zetu_enquiry_id, tourist_name, tourist_email, destination, status FROM enquiry_log;\"")
print(out)

# 3. Fix fetchFromSafariZetu to follow redirects - use sed
print("\n=== FIXING fetchFromSafariZetu ===")
# The fix: add redirect: 'follow' to fetch options
sed_cmd = "sed -i 's/signal: AbortSignal.timeout(15000)/redirect: \"follow\",\\n    signal: AbortSignal.timeout(15000)/' /app/src/services/ai-agent.service.ts"
out = run("docker exec ops_engine " + sed_cmd)
print(f"  sed result: {out}")

# Verify
out = run("docker exec ops_engine cat /app/src/services/ai-agent.service.ts | grep -A 20 'fetchFromSafariZetu'")
print(out)

# 4. Restart ops_engine
print("\n=== RESTARTING OPS_ENGINE ===")
run("docker restart ops_engine")
time.sleep(10)

# 5. Check logs
print("\n=== CHECKING LOGS ===")
out = run("docker logs ops_engine --since 30s 2>&1 | grep -i -E 'enquiry|fetch|error' | tail -10")
print(out)

c.close()