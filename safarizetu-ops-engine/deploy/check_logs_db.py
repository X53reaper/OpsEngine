import paramiko
import json

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

print("=" * 60)
print("  CHECKING OPS ENGINE LOGS AND DB")
print("=" * 60)

# 1. Check ops engine logs for the webhook
print("\n--- OPS ENGINE LOGS ---")
result = run("docker logs ops_engine --tail 50 2>&1 | grep -i 'enquiry\\|webhook\\|agent\\|error' | tail -20")
print(f"  {result}")

# 2. Check enquiry_log in database
print("\n--- ENQUIRY LOG (LAST 10) ---")
result = run("""docker exec ops_engine node -e "
const {Pool}=require('pg');
const p=new Pool({host:'host.docker.internal',port:5432,database:'safarizetu_ops',user:'safarizetu',password:'safarizetu_ops_2024'});
p.query('SELECT id,listing_name,customer_name,customer_email,status,created_at FROM enquiry_log ORDER BY created_at DESC LIMIT 10')
.then(r=>{console.log(JSON.stringify(r.rows,null,2));process.exit(0)})
.catch(e=>{console.error(e.message);process.exit(1)})
" """)
print(f"  {result}")

# 3. Check agent_run_log
print("\n--- AGENT RUN LOG (LAST 10) ---")
result = run("""docker exec ops_engine node -e "
const {Pool}=require('pg');
const p=new Pool({host:'host.docker.internal',port:5432,database:'safarizetu_ops',user:'safarizetu',password:'safarizetu_ops_2024'});
p.query('SELECT agent_name,event_type,listing_name,status,created_at FROM agent_run_log ORDER BY created_at DESC LIMIT 10')
.then(r=>{console.log(JSON.stringify(r.rows,null,2));process.exit(0)})
.catch(e=>{console.error(e.message);process.exit(1)})
" """)
print(f"  {result}")

# 4. Test ops-bridge agents resource
print("\n--- OPS-BRIDGE AGENTS ---")
result = run("curl -s -L 'https://safarizetu.com/api/ops-bridge?resource=agents&limit=5' -H 'x-ops-api-key: dee222cc2eb4afd36e7ed1057700e32e'")
print(f"  {result}")

# 5. Test ops-bridge content/pending
print("\n--- OPS-BRIDGE CONTENT PENDING ---")
result = run("curl -s -L 'https://safarizetu.com/api/ops-bridge?resource=content/pending&limit=5' -H 'x-ops-api-key: dee222cc2eb4afd36e7ed1057700e32e'")
print(f"  {result}")

# 6. Test ops-bridge memories/pending
print("\n--- OPS-BRIDGE MEMORIES PENDING ---")
result = run("curl -s -L 'https://safarizetu.com/api/ops-bridge?resource=memories/pending&limit=5' -H 'x-ops-api-key: dee222cc2eb4afd36e7ed1057700e32e'")
print(f"  {result}")

c.close()