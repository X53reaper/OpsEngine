import paramiko
import time
import uuid

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

# Trigger with valid UUID
print("=== TRIGGER TEST WEBHOOK (VALID UUID) ===")
test_id = str(uuid.uuid4())
import json
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

# Wait
time.sleep(15)

# Check agent run log
print("\n=== AGENT RUN LOG (RECENT) ===")
result = run("""docker exec ops_engine node -e "
const {Pool}=require('pg');
const p=new Pool({connectionString:process.env.DATABASE_URL});
p.query('SELECT agent_name,trigger_type,status,cost_usd,model_used,started_at,completed_at,error_message FROM agent_run_log ORDER BY started_at DESC LIMIT 5')
.then(r=>{console.log(r.rows.map(x=>JSON.stringify(x)).join('\\n'));process.exit(0)})
.catch(e=>{console.error(e.message);process.exit(1)})
" 2>&1""")
print(f"  {result}")

# Check ops engine logs
print("\n=== OPS ENGINE LOGS (RECENT) ===")
result = run("docker logs ops_engine --tail 100 2>&1 | grep -i 'enquiry\\|agent\\|error\\|acknowledge\\|resend' | tail -30")
print(f"  {result}")

# Check enquiry_log
print("\n=== ENQUIRY LOG (RECENT) ===")
result = run("""docker exec ops_engine node -e "
const {Pool}=require('pg');
const p=new Pool({connectionString:process.env.DATABASE_URL});
p.query('SELECT id,safari_zetu_enquiry_id,tourist_name,status,acknowledgement_sent_at FROM enquiry_log ORDER BY created_at DESC LIMIT 5')
.then(r=>{console.log(r.rows.map(x=>JSON.stringify(x)).join('\\n'));process.exit(0)})
.catch(e=>{console.error(e.message);process.exit(1)})
" 2>&1""")
print(f"  {result}")

c.close()