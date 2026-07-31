import paramiko
import json

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

resend_key = run("grep '^RESEND_API_KEY=' /opt/safarizetu-ops-engine/.env | cut -d= -f2-")

print("=" * 60)
print("  FIX 1: RESEND - TEST WITH ops@safarizetu.com")
print("=" * 60)

# Test with the configured from email
print("\n--- TEST WITH ops@safarizetu.com ---")
result = run(f"""curl -s -X POST 'https://api.resend.com/emails' \
  -H 'Authorization: Bearer {resend_key}' \
  -H 'Content-Type: application/json' \
  -d '{{"from":"Safari Zetu <ops@safarizetu.com>","to":"sirmarshalmuvhuni@gmail.com","subject":"Safari Zetu Ops Engine Test","html":"<h2>Test Email</h2><p>This is a test from the ops engine.</p>"}}'""")
print(f"  Response: {result}")

# If 422, try without display name
if "422" in result or "error" in result.lower():
    print("\n--- RETRY WITHOUT DISPLAY NAME ---")
    result = run(f"""curl -s -X POST 'https://api.resend.com/emails' \
      -H 'Authorization: Bearer {resend_key}' \
      -H 'Content-Type: application/json' \
      -d '{{"from":"ops@safarizetu.com","to":"sirmarshalmuvhuni@gmail.com","subject":"Safari Zetu Ops Engine Test","html":"<h2>Test Email</h2><p>This is a test from the ops engine.</p>"}}'""")
    print(f"  Response: {result}")

# If still 422, check if domain is verified
if "422" in result or "error" in result.lower():
    print("\n--- CHECK RESEND DOMAINS ---")
    result = run(f"curl -s 'https://api.resend.com/domains' -H 'Authorization: Bearer {resend_key}'")
    print(f"  Response: {result}")

print("\n" + "=" * 60)
print("  FIX 2: APOLLO - CHECK SOURCE CODE")
print("=" * 60)

# Check source for Apollo usage
print("\n--- APOLLO IN SOURCE ---")
result = run("grep -rn 'APOLLO\\|apollo' /opt/safarizetu-ops-engine/src/ 2>/dev/null | head -20")
print(f"  {result}")

# Check compiled JS
print("\n--- APOLLO IN COMPILED JS ---")
result = run("grep -rn 'apollo\\|APOLLO' /opt/safarizetu-ops-engine/dist/ 2>/dev/null | head -20")
print(f"  {result}")

print("\n" + "=" * 60)
print("  FIX 3: DB - VERIFY DATA QUERIES WORK")
print("=" * 60)

# Test with full connection string
print("\n--- ENQUIRY LOG (via DATABASE_URL) ---")
result = run("""docker exec ops_engine node -e "
const {Pool}=require('pg');
const p=new Pool({connectionString:process.env.DATABASE_URL});
p.query('SELECT id, safari_zetu_enquiry_id, tourist_name, tourist_email, status, created_at FROM enquiry_log ORDER BY created_at DESC LIMIT 5')
.then(r=>{console.log(JSON.stringify(r.rows,null,2));process.exit(0)})
.catch(e=>{console.error(e.message);process.exit(1)})
" 2>&1""")
print(f"  {result}")

print("\n--- AGENT RUN LOG (via DATABASE_URL) ---")
result = run("""docker exec ops_engine node -e "
const {Pool}=require('pg');
const p=new Pool({connectionString:process.env.DATABASE_URL});
p.query('SELECT agent_name, trigger_type, status, cost_usd, model_used, started_at FROM agent_run_log ORDER BY started_at DESC LIMIT 10')
.then(r=>{console.log(JSON.stringify(r.rows,null,2));process.exit(0)})
.catch(e=>{console.error(e.message);process.exit(1)})
" 2>&1""")
print(f"  {result}")

c.close()