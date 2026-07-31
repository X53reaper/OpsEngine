import paramiko
import time

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=300):
    _, o, e = c.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", errors="replace").strip()
    err = e.read().decode("utf-8", errors="replace").strip()
    return (out + "\n" + err).strip()

# Upload fixed file
print("=== UPLOADING FIXED FILE ===")
sftp = c.open_sftp()
sftp.put(
    r"D:\Projects\SafariZetu Automation\safarizetu-ops-engine\src\services\ai-agent.service.ts",
    "/opt/safarizetu-ops-engine/src/services/ai-agent.service.ts"
)
sftp.close()
print("  Uploaded")

# Build
print("\n=== BUILDING IMAGE ===")
result = run("cd /opt/safarizetu-ops-engine/infrastructure && docker build -t safarizetu-ops-engine:latest -f Dockerfile.ops .. 2>&1 | tail -10", timeout=300)
print(f"  {result}")

# Recreate
print("\n=== RECREATING SERVICES ===")
result = run("cd /opt/safarizetu-ops-engine/infrastructure && docker compose up -d --force-recreate 2>&1 | tail -15", timeout=120)
print(f"  {result}")

time.sleep(20)

# Trigger test webhook
print("\n=== TRIGGER TEST WEBHOOK ===")
import uuid
import json
test_id = str(uuid.uuid4())
webhook_payload = json.dumps({
    "event": "enquiry.created",
    "data": {
        "id": test_id,
        "tourist": {"name": "Test User", "email": "sirmarshalmuvhuni@gmail.com"},
        "destination": "Victoria Falls",
        "travelDates": "2026-08-15 to 2026-08-22",
        "groupSize": 2,
        "specialRequests": "Test from webhook",
        "operator": {"name": "Test Operator"}
    }
})
result = run(f"curl -s -X POST 'https://ops.safarizetu.com/webhook/safari-zetu' -H 'Content-Type: application/json' -d '{webhook_payload}'")
print(f"  Webhook: {result}")

time.sleep(15)

# Check agent run log
print("\n=== AGENT RUN LOG (from postgres) ===")
result = run("""docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c "
SELECT agent_name, trigger_type, status, cost_usd, model_used, started_at, completed_at 
FROM agent_run_log 
WHERE trigger_payload->>'enquiry_id' = '" + test_id + "'
ORDER BY started_at DESC LIMIT 5;
" 2>&1""")
print(f"  {result}")

# Check completed runs
print("\n=== COMPLETED RUNS ===")
result = run("""docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c "
SELECT agent_name, trigger_type, status, cost_usd, model_used, started_at, completed_at 
FROM agent_run_log 
WHERE completed_at IS NOT NULL 
ORDER BY completed_at DESC LIMIT 5;
" 2>&1""")
print(f"  {result}")

c.close()