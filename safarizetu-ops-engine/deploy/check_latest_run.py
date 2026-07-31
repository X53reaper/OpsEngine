import paramiko
import time

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

# Check the latest agent run log for the successful one
print("=== LATEST AGENT RUN LOG ===")
result = run("""docker exec ops_engine node -e "
const {Pool}=require('pg');
const p=new Pool({connectionString:process.env.DATABASE_URL});
p.query('SELECT agent_name,trigger_type,status,cost_usd,model_used,started_at,completed_at,error_message FROM agent_run_log WHERE trigger_payload->>\\''enquiry_id\\'' = \\'148485a0-4499-4f27-9a5d-0ed759a80c95\\'')
.then(r=>{console.log(r.rows.map(x=>JSON.stringify(x)).join('\\n'));process.exit(0)})
.catch(e=>{console.error(e.message);process.exit(1)})
" 2>&1""")
print(f"  {result}")

# Check all agent runs with completed_at not null
print("\n=== COMPLETED AGENT RUNS ===")
result = run("""docker exec ops_engine node -e "
const {Pool}=require('pg');
const p=new Pool({connectionString:process.env.DATABASE_URL});
p.query('SELECT agent_name,trigger_type,status,cost_usd,model_used,started_at,completed_at FROM agent_run_log WHERE completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 10')
.then(r=>{console.log(r.rows.map(x=>JSON.stringify(x)).join('\\n'));process.exit(0)})
.catch(e=>{console.error(e.message);process.exit(1)})
" 2>&1""")
print(f"  {result}")

# Check outreach_log for the email
print("\n=== OUTREACH LOG (LATEST) ===")
result = run("""docker exec ops_engine node -e "
const {Pool}=require('pg');
const p=new Pool({connectionString:process.env.DATABASE_URL});
p.query('SELECT entity_type,entity_id,email_to,email_subject,resend_message_id,status,agent_name,sent_at FROM outreach_log ORDER BY sent_at DESC LIMIT 5')
.then(r=>{console.log(r.rows.map(x=>JSON.stringify(x)).join('\\n'));process.exit(0)})
.catch(e=>{console.error(e.message);process.exit(1)})
" 2>&1""")
print(f"  {result}")

c.close()