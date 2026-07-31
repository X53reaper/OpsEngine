import paramiko
import time

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

# Create platform_settings table
print("=== CREATING platform_settings TABLE ===")
sql = """CREATE TABLE IF NOT EXISTS platform_settings (
    id SERIAL PRIMARY KEY,
    commission_rate DECIMAL(5,4) DEFAULT 0.15,
    commission_rate_label VARCHAR(50) DEFAULT '15%',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);"""
print(run(f"docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c '{sql}'"))

# Seed with default
print("\n=== SEEDING platform_settings ===")
print(run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c \"INSERT INTO platform_settings (commission_rate, commission_rate_label) VALUES (0.15, '15%') ON CONFLICT DO NOTHING;\""))

# Verify
print("\n=== VERIFY platform_settings ===")
print(run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c 'SELECT * FROM platform_settings;'"))

# Section 4: Check server process
print("\n" + "=" * 60)
print("  SECTION 4 — SERVER PROCESS CHECK")
print("=" * 60)

print("\n--- CURRENT PROCESSES ---")
print(run("docker exec ops_engine ps aux | grep node | grep -v grep"))

print("\n--- HEALTH CHECK ---")
print(run("curl -s http://localhost:3000/health"))

# Section 5: Public reachability
print("\n" + "=" * 60)
print("  SECTION 5 — PUBLIC REACHABILITY CHECK")
print("=" * 60)

print("\n--- PUBLIC URL TEST ---")
print(run("curl -s -o /dev/null -w 'Public URL: %{http_code}' https://ops.safarizetu.com/health"))

# Section 6: Cron scheduler
print("\n" + "=" * 60)
print("  SECTION 6 — CRON SCHEDULER CHECK")
print("=" * 60)

print("\n--- CRON LOGS ---")
print(run("docker logs ops_engine --since 10m 2>&1 | grep -i -E 'cron|schedule|tick|job|run |completed' | tail -15"))

# Section 7: Agent smoke test
print("\n" + "=" * 60)
print("  SECTION 7 — AGENT SMOKE TEST")
print("=" * 60)

print("\n--- AGENT_RUN_LOG (recent) ---")
print(run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c \"SELECT agent_name, status, cost_usd, tokens_used, started_at FROM agent_run_log ORDER BY started_at DESC LIMIT 5;\""))

# Section 8: Webhook E2E test
print("\n" + "=" * 60)
print("  SECTION 8 — WEBHOOK E2E TEST")
print("=" * 60)

import json
test_payload = {
    "event": "enquiry.created",
    "data": {
        "id": "e2e-test-" + str(int(time.time())),
        "touristName": "End To End Test",
        "touristEmail": "test@example.com",
        "touristCountry": "United Kingdom",
        "operatorName": "Test Safari Lodge",
        "destination": "Hwange National Park",
        "travelDates": "10-15 September 2026",
        "groupSize": 4,
        "budgetRange": "$2000-3000",
        "specialRequests": "Celebrating an anniversary"
    }
}

print(f"\n--- SENDING WEBHOOK ---")
print(f"Payload: {json.dumps(test_payload['data'], indent=2)}")

result = run(f"""curl -s -w '\\nHTTP:%{{http_code}}' -X POST http://localhost:3000/webhook/safari-zetu -H 'Content-Type: application/json' -d '{json.dumps(test_payload)}'""")
print(f"Response: {result}")

# Wait for processing
print("\nWaiting 10 seconds for async processing...")
time.sleep(10)

# Check database
print("\n--- DATABASE EVIDENCE ---")
print(run(f"docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c \"SELECT * FROM enquiry_log WHERE safari_zetu_enquiry_id = '{test_payload['data']['id']}';\""))

print("\n--- AGENT RUNS ---")
print(run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c \"SELECT agent_name, status, cost_usd, tokens_used, started_at FROM agent_run_log ORDER BY started_at DESC LIMIT 5;\""))

# Section 10: Final bridge check
print("\n" + "=" * 60)
print("  SECTION 10 — FINAL BRIDGE CHECK")
print("=" * 60)

bridge_url = run("grep SAFARI_ZETU_BRIDGE_URL /opt/safarizetu-ops-engine/.env | cut -d= -f2-")
api_key = run("grep SAFARI_ZETU_API_KEY /opt/safarizetu-ops-engine/.env | cut -d= -f2-")
result = run(f"curl -s -L -w '\\nHTTP_CODE:%{{http_code}}' '{bridge_url}?resource=health' -H 'x-ops-api-key: {api_key}'")
print(f"Bridge result: {result}")

c.close()