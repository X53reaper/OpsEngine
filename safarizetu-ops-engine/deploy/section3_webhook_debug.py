import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

# Check platform_settings more carefully
print("=== PLATFORM_SETTINGS DEBUG ===")
print(run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c '\\dt *platform*' 2>&1"))
print(run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c '\\dt *settings*' 2>&1"))

# Check the 001 migration for platform_settings
print("\n=== MIGRATION 001 - platform_settings ===")
print(run("docker exec ops_postgres cat /docker-entrypoint-initdb.d/001_initial_schema.sql | grep -A 20 'platform_settings' 2>/dev/null | head -25"))

# Check webhook 500 error
print("\n=== WEBHOOK 500 ERROR DETAILS ===")
print(run("docker logs ops_engine --since 5m 2>&1 | grep -i -E 'webhook|error|500' | tail -10"))

# Test webhook with valid payload
print("\n=== WEBHOOK TEST WITH PAYLOAD ===")
result = run("""curl -s -w '\\nHTTP:%{http_code}' -X POST http://localhost:3000/webhook/safari-zetu -H 'Content-Type: application/json' -d '{"event":"test","data":{"id":"test-123"}}'""")
print(result)

# Check what handleWebhook expects
print("\n=== WEBHOOK RECEIVER CODE ===")
print(run("docker exec ops_engine cat /app/src/webhook/receiver.ts 2>/dev/null | head -50"))

# Check if there's a separate webhook directory
print("\n=== WEBHOOK DIRECTORY ===")
print(run("docker exec ops_engine ls -la /app/src/webhook/ 2>/dev/null || echo 'No webhook directory'"))

c.close()