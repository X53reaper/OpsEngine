import paramiko
import json

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

API_KEY = "dee222cc2eb4afd36e7ed1057700e32e"

print("=" * 60)
print("  CHECKING OPS-BRIDGE RESOURCES")
print("=" * 60)

# 1. Check enquiries resource
print("\n--- ENQUIRIES ---")
result = run(f"curl -s -L 'https://safarizetu.com/api/ops-bridge?resource=enquiries&limit=5' -H 'x-ops-api-key: {API_KEY}'")
print(f"  {result}")

# 2. Check operators resource
print("\n--- OPERATORS ---")
result = run(f"curl -s -L 'https://safarizetu.com/api/ops-bridge?resource=operators&limit=5' -H 'x-ops-api-key: {API_KEY}'")
print(f"  {result}")

# 3. Check metrics resource
print("\n--- METRICS ---")
result = run(f"curl -s -L 'https://safarizetu.com/api/ops-bridge?resource=metrics' -H 'x-ops-api-key: {API_KEY}'")
print(f"  {result}")

# 4. Check booking resource
print("\n--- BOOKING ---")
result = run(f"curl -s -L 'https://safarizetu.com/api/ops-bridge?resource=booking&limit=5' -H 'x-ops-api-key: {API_KEY}'")
print(f"  {result}")

# 5. Check DB tables
print("\n--- DB TABLES ---")
result = run("""docker exec ops_engine node -e "
const {Pool}=require('pg');
const p=new Pool({host:'host.docker.internal',port:5432,database:'safarizetu_ops',user:'safarizetu',password:'safarizetu_ops_2024'});
p.query(\\\"SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name\\\")
.then(r=>{console.log(r.rows.map(x=>x.table_name).join('\\n'));process.exit(0)})
.catch(e=>{console.error(e.message);process.exit(1)})
" """)
print(f"  {result}")

# 6. Check enquiry_log table structure
print("\n--- ENQUIRY LOG COLUMNS ---")
result = run("""docker exec ops_engine node -e "
const {Pool}=require('pg');
const p=new Pool({host:'host.docker.internal',port:5432,database:'safarizetu_ops',user:'safarizetu',password:'safarizetu_ops_2024'});
p.query(\\\"SELECT column_name,data_type FROM information_schema.columns WHERE table_name='enquiry_log' ORDER BY ordinal_position\\\")
.then(r=>{console.log(JSON.stringify(r.rows,null,2));process.exit(0)})
.catch(e=>{console.error(e.message);process.exit(1)})
" """)
print(f"  {result}")

# 7. Check agent_run_log table structure
print("\n--- AGENT RUN LOG COLUMNS ---")
result = run("""docker exec ops_engine node -e "
const {Pool}=require('pg');
const p=new Pool({host:'host.docker.internal',port:5432,database:'safarizetu_ops',user:'safarizetu',password:'safarizetu_ops_2024'});
p.query(\\\"SELECT column_name,data_type FROM information_schema.columns WHERE table_name='agent_run_log' ORDER BY ordinal_position\\\")
.then(r=>{console.log(JSON.stringify(r.rows,null,2));process.exit(0)})
.catch(e=>{console.error(e.message);process.exit(1)})
" """)
print(f"  {result}")

c.close()