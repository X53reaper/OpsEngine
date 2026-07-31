import paramiko
import json
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

print("=== APOLLO SOURCE CODE ===")
result = run("grep -rn 'APOLLO\\|apollo' /opt/safarizetu-ops-engine/src/ 2>/dev/null | head -30")
print(result)

print("\n=== APOLLO IN COMPILED JS ===")
result = run("grep -rn 'apollo\\|APOLLO' /opt/safarizetu-ops-engine/dist/ 2>/dev/null | head -30")
print(result)

print("\n=== DB QUERIES FROM CONTAINER ===")
result = run("""docker exec ops_engine node -e "const{Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query('SELECT id,safari_zetu_enquiry_id,tourist_name,tourist_email,status,created_at FROM enquiry_log ORDER BY created_at DESC LIMIT 5').then(r=>{console.log(JSON.stringify(r.rows,null,2));process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)})" 2>&1""")
print(result)

print("\n=== AGENT RUN LOG ===")
result = run("""docker exec ops_engine node -e "const{Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query('SELECT agent_name,trigger_type,status,cost_usd,model_used,started_at FROM agent_run_log ORDER BY started_at DESC LIMIT 10').then(r=>{console.log(JSON.stringify(r.rows,null,2));process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)})" 2>&1""")
print(result)

c.close()