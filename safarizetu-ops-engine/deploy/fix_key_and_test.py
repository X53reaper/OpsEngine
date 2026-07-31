import paramiko
import json

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

print("=" * 60)
print("  FIXING API KEY MISMATCH")
print("=" * 60)

# 1. Update SAFARI_ZETU_API_KEY in ops engine to match what safarizetu.com expects
print("\n--- UPDATING OPS ENGINE .env ---")
run("sed -i 's/^SAFARI_ZETU_API_KEY=.*/SAFARI_ZETU_API_KEY=dee222cc2eb4afd36e7ed1057700e32e/' /opt/safarizetu-ops-engine/.env")
result = run("grep '^SAFARI_ZETU_API_KEY=' /opt/safarizetu-ops-engine/.env")
print(f"  Updated: {result}")

# 2. Restart ops engine
print("\n--- RESTARTING OPS ENGINE ---")
run("docker restart ops_engine")
print("  Restarted")

# 3. Wait for startup
import time
time.sleep(10)

# 4. Test ops engine health
print("\n--- TESTING OPS ENGINE HEALTH ---")
result = run("curl -s http://localhost:3000/health")
print(f"  Health: {result}")

# 5. Test full webhook flow: safarizetu -> ops engine
print("\n--- TESTING WEBHOOK FLOW ---")
webhook_payload = json.dumps({
    "event": "enquiry.created",
    "data": {
        "listingId": "test-listing-001",
        "listingName": "Test Safari Lodge",
        "listingType": "lodge",
        "customerName": "Test Customer",
        "customerEmail": "sirmarshalmuvhuni@gmail.com",
        "customerPhone": "+263771234567",
        "travelDate": "2026-07-15",
        "guests": 2,
        "message": "Test enquiry from ops engine"
    }
})
result = run(f"curl -s -X POST 'https://ops.safarizetu.com/webhook/safari-zetu' -H 'Content-Type: application/json' -d '{webhook_payload}' -w '\\nHTTP_CODE:%{{http_code}}'")
print(f"  Webhook response: {result}")

# 6. Check if agent fired
print("\n--- CHECKING AGENT RUNS ---")
time.sleep(15)
result = run("docker exec ops_engine node -e \"const {Pool}=require('pg');const p=new Pool({host:'host.docker.internal',port:5432,database:'safarizetu_ops',user:'safarizetu',password:'safarizetu_ops_2024'});p.query(\\\"SELECT event_type,listing_name,created_at FROM agent_run_log WHERE created_at > NOW() - INTERVAL '5 minutes' ORDER BY created_at DESC LIMIT 5\\\").then(r=>{console.log(JSON.stringify(r.rows,null,2));process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)})\"")
print(f"  Recent agent runs: {result}")

# 7. Check enquiry_log
print("\n--- CHECKING ENQUIRY LOG ---")
result = run("docker exec ops_engine node -e \"const {Pool}=require('pg');const p=new Pool({host:'host.docker.internal',port:5432,database:'safarizetu_ops',user:'safarizetu',password:'safarizetu_ops_2024'});p.query(\\\"SELECT * FROM enquiry_log WHERE created_at > NOW() - INTERVAL '5 minutes' ORDER BY created_at DESC LIMIT 5\\\").then(r=>{console.log(JSON.stringify(r.rows,null,2));process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)})\"")
print(f"  Recent enquiries: {result}")

c.close()