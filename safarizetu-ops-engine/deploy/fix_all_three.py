import paramiko
import json

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

print("=" * 60)
print("  FIX 1: RESEND EMAIL")
print("=" * 60)

# Check current Resend config
print("\n--- CURRENT RESEND CONFIG ---")
result = run("grep -E '^RESEND_' /opt/safarizetu-ops-engine/.env")
print(f"  {result}")

# Test Resend API key directly
print("\n--- TESTING RESEND API KEY ---")
resend_key = run("grep '^RESEND_API_KEY=' /opt/safarizetu-ops-engine/.env | cut -d= -f2-")
result = run(f"curl -s -X POST 'https://api.resend.com/emails' -H 'Authorization: Bearer {resend_key}' -H 'Content-Type: application/json' -d '{{\"from\":\"onboarding@resend.dev\",\"to\":\"sirmarshalmuvhuni@gmail.com\",\"subject\":\"Test from Safari Zetu Ops\",\"html\":\"<p>Test email</p>\"}}'")
print(f"  Response: {result}")

# Check what from email is configured
print("\n--- CHECKING FROM EMAIL ---")
result = run("grep -E 'FROM_EMAIL|EMAIL_FROM|RESEND_FROM' /opt/safarizetu-ops-engine/.env")
print(f"  {result}")

print("\n" + "=" * 60)
print("  FIX 2: APOLLO API")
print("=" * 60)

# Check Apollo config
print("\n--- CURRENT APOLLO CONFIG ---")
result = run("grep -E '^APOLLO_' /opt/safarizetu-ops-engine/.env")
print(f"  {result}")

# Check how Apollo key is used in code
print("\n--- APOLLO KEY USAGE IN CODE ---")
result = run("grep -rn 'APOLLO' /opt/safarizetu-ops-engine/dist/ 2>/dev/null | head -10")
print(f"  {result}")

print("\n" + "=" * 60)
print("  FIX 3: NODE.JS DB CONNECTION")
print("=" * 60)

# Check how ops_engine connects to DB
print("\n--- DB CONNECTION CONFIG ---")
result = run("grep -E '^DB_|^DATABASE_' /opt/safarizetu-ops-engine/.env")
print(f"  {result}")

# Check what the container sees for host.docker.internal
print("\n--- CONTAINER DNS ---")
result = run("docker exec ops_engine cat /etc/hosts 2>&1 | tail -5")
print(f"  {result}")

# Check if postgres is reachable from ops_engine container
print("\n--- PING POSTGRES FROM OPS_ENGINE ---")
result = run("docker exec ops_engine sh -c 'ping -c 1 postgres 2>&1 || echo FAILED'")
print(f"  {result}")

# Test DB connection from inside the container
print("\n--- TEST DB CONNECTION FROM CONTAINER ---")
result = run("""docker exec ops_engine node -e "
const {Pool}=require('pg');
const p=new Pool({connectionString: process.env.DATABASE_URL});
p.query('SELECT 1 as test')
.then(r=>{console.log('OK:', JSON.stringify(r.rows));process.exit(0)})
.catch(e=>{console.error('FAIL:', e.message);process.exit(1)})
" 2>&1""")
print(f"  {result}")

# Try with individual params from DATABASE_URL
print("\n--- TEST DB CONNECTION WITH PARSED URL ---")
result = run("""docker exec ops_engine node -e "
const {Pool}=require('pg');
const url=new URL(process.env.DATABASE_URL);
const p=new Pool({host:url.hostname,port:url.port,database:url.pathname.slice(1),user:url.username,password:url.password});
p.query('SELECT 1 as test')
.then(r=>{console.log('OK:', JSON.stringify(r.rows));process.exit(0)})
.catch(e=>{console.error('FAIL:', e.message);process.exit(1)})
" 2>&1""")
print(f"  {result}")

c.close()