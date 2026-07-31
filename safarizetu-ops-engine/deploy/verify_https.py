import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

print("=== VERIFY ALL HTTPS CALLS WORK ===")

# 1. Test Resend from container
print("\n--- RESEND FROM CONTAINER ---")
resend_key = run("grep '^RESEND_API_KEY=' /opt/safarizetu-ops-engine/.env | cut -d= -f2-")
result = run(f"""docker exec ops_engine sh -c "
curl -s -X POST 'https://api.resend.com/emails' \
  -H 'Authorization: Bearer {resend_key}' \
  -H 'Content-Type: application/json' \
  -d '{{\"from\":\"Safari Zetu <ops@safarizetu.com>\",\"to\":\"sirmarshalmuvhuni@gmail.com\",\"subject\":\"Test from container\",\"html\":\"<p>Test</p>\"}}' \
  --max-time 10
" 2>&1""")
print(f"  {result}")

# 2. Test webhook to ops engine from container
print("\n--- WEBHOOK TO OPS ENGINE ---")
result = run("""docker exec ops_engine node -e "
fetch('https://ops.safarizetu.com/webhook/safari-zetu',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'test.container',data:{}})}).then(r=>r.json()).then(d=>{console.log('Webhook:',d);process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)})
" 2>&1""")
print(f"  {result}")

# 3. Test Langfuse from container
print("\n--- LANGFUSE FROM CONTAINER ---")
result = run("docker exec ops_engine sh -c 'curl -s -o /dev/null -w \"%{http_code}\" https://langfuse.safarizetu.com/api/public/health --max-time 10 2>&1'")
print(f"  HTTP: {result}")

# 4. Test Apollo with the actual service
print("\n--- APOLLO SERVICE TEST ---")
result = run("""docker exec ops_engine node -e "
const {searchPeople,getApolloStatus}=require('./dist/services/apollo.service.js');
console.log('Status:',getApolloStatus());
(async()=>{const r=await searchPeople({titles:['ceo'],page:1,per_page:2});console.log('Results:',r?r.length:'null/error');})().catch(e=>console.error(e.message))
" 2>&1""")
print(f"  {result}")

# 5. Check if agent runs are completing properly
print("\n--- RECENT AGENT RUNS ---")
result = run("""docker exec ops_engine node -e "
const {Pool}=require('pg');
const p=new Pool({connectionString:process.env.DATABASE_URL});
p.query('SELECT agent_name,trigger_type,status,cost_usd,model_used,started_at,completed_at FROM agent_run_log ORDER BY started_at DESC LIMIT 10')
.then(r=>{console.log(JSON.stringify(r.rows?JSON.stringify(r.rows,null,2):r.rows));process.exit(0)})
.catch(e=>{console.error(e.message);process.exit(1)})
" 2>&1""")
print(f"  {result}")

c.close()