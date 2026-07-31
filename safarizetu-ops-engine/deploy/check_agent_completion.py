import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

print("=== CHECK AGENT COMPLETION ===")

# Check recent completed runs
print("\n--- COMPLETED AGENT RUNS ---")
result = run("""docker exec ops_engine node -e "
const {Pool}=require('pg');
const p=new Pool({connectionString:process.env.DATABASE_URL});
p.query('SELECT agent_name,trigger_type,status,cost_usd,model_used,started_at,completed_at FROM agent_run_log WHERE completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 10')
.then(r=>{console.log(r.rows.map(x=>JSON.stringify(x)).join('\\n'));process.exit(0)})
.catch(e=>{console.error(e.message);process.exit(1)})
" 2>&1""")
print(f"  {result}")

# Check enquiry_log for acknowledgement_sent_at
print("\n--- ENQUIRY LOG ACK STATUS ---")
result = run("""docker exec ops_engine node -e "
const {Pool}=require('pg');
const p=new Pool({connectionString:process.env.DATABASE_URL});
p.query('SELECT id,safari_zetu_enquiry_id,tourist_name,status,acknowledgement_sent_at FROM enquiry_log ORDER BY created_at DESC LIMIT 10')
.then(r=>{console.log(r.rows.map(x=>JSON.stringify(x)).join('\\n'));process.exit(0)})
.catch(e=>{console.error(e.message);process.exit(1)})
" 2>&1""")
print(f"  {result}")

# Check ops engine logs for agent completion
print("\n--- OPS ENGINE LOGS (AGENTS) ---")
result = run("docker logs ops_engine --tail 50 2>&1 | grep -i 'agent\\|enquiry\\|acknowledgement\\|complete' | tail -20")
print(f"  {result}")

# Test running an agent manually
print("\n--- TEST ENQUIRY ACKNOWLEDGEMENT AGENT ---")
result = run("""docker exec ops_engine node -e "
const {enquiryAcknowledgementAgent}=require('./dist/agents/enquiry-acknowledgement.js');
const result = await enquiryAcknowledgementAgent({
  listingId: 'test-003',
  listingName: 'Test Lodge',
  listingType: 'lodge',
  customerName: 'Test User',
  customerEmail: 'sirmarshalmuvhuni@gmail.com',
  customerPhone: '+263771234567',
  travelDate: '2026-08-01',
  guests: 2,
  message: 'Test from manual run'
});
console.log('Result:', result);
" 2>&1""")
print(f"  {result}")

c.close()