import paramiko
import json

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

print("=" * 60)
print("  CHECKING DB CONNECTION AND TABLES")
print("=" * 60)

# 1. Check if we can connect to DB
print("\n--- DB CONNECTION TEST ---")
result = run("""docker exec ops_engine node -e "
const {Pool}=require('pg');
const p=new Pool({host:'host.docker.internal',port:5432,database:'safarizetu_ops',user:'safarizetu',password:'safarizetu_ops_2024'});
p.query('SELECT 1 as test')
.then(r=>{console.log('Connection OK:', JSON.stringify(r.rows));process.exit(0)})
.catch(e=>{console.error('Connection FAILED:', e.message);process.exit(1)})
" """)
print(f"  {result}")

# 2. List all tables
print("\n--- ALL TABLES ---")
result = run("""docker exec ops_engine node -e "
const {Pool}=require('pg');
const p=new Pool({host:'host.docker.internal',port:5432,database:'safarizetu_ops',user:'safarizetu',password:'safarizetu_ops_2024'});
p.query(\\\"SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename\\\")
.then(r=>{console.log(r.rows.map(x=>x.tablename).join('\\n'));process.exit(0)})
.catch(e=>{console.error(e.message);process.exit(1)})
" """)
print(f"  {result}")

# 3. Check enquiry_log specifically
print("\n--- ENQUIRY LOG COUNT ---")
result = run("""docker exec ops_engine node -e "
const {Pool}=require('pg');
const p=new Pool({host:'host.docker.internal',port:5432,database:'safarizetu_ops',user:'safarizetu',password:'safarizetu_ops_2024'});
p.query('SELECT COUNT(*) as count FROM enquiry_log')
.then(r=>{console.log('Count:', r.rows[0].count);process.exit(0)})
.catch(e=>{console.error('Error:', e.message);process.exit(1)})
" """)
print(f"  {result}")

# 4. Check agent_run_log
print("\n--- AGENT RUN LOG COUNT ---")
result = run("""docker exec ops_engine node -e "
const {Pool}=require('pg');
const p=new Pool({host:'host.docker.internal',port:5432,database:'safarizetu_ops',user:'safarizetu',password:'safarizetu_ops_2024'});
p.query('SELECT COUNT(*) as count FROM agent_run_log')
.then(r=>{console.log('Count:', r.rows[0].count);process.exit(0)})
.catch(e=>{console.error('Error:', e.message);process.exit(1)})
" """)
print(f"  {result}")

# 5. List all data from enquiry_log
print("\n--- ENQUIRY LOG DATA ---")
result = run("""docker exec ops_engine node -e "
const {Pool}=require('pg');
const p=new Pool({host:'host.docker.internal',port:5432,database:'safarizetu_ops',user:'safarizetu',password:'safarizetu_ops_2024'});
p.query('SELECT * FROM enquiry_log LIMIT 10')
.then(r=>{console.log(JSON.stringify(r.rows,null,2));process.exit(0)})
.catch(e=>{console.error('Error:', e.message);process.exit(1)})
" """)
print(f"  {result}")

# 6. Check ops engine logs for DB errors
print("\n--- OPS ENGINE LOGS (DB ERRORS) ---")
result = run("docker logs ops_engine --tail 100 2>&1 | grep -i 'error\\|fail\\|db\\|database\\|pg' | tail -20")
print(f"  {result}")

c.close()