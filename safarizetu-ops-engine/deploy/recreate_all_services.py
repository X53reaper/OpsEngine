import paramiko
import time

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

# Check docker-compose services
print("=== DOCKER-COMPOSE SERVICES ===")
result = run("cat /opt/safarizetu-ops-engine/infrastructure/docker-compose.yml | grep -E '^  [a-z_]+:' | head -20")
print(f"  {result}")

# Recreate all services
print("\n=== RECREATING ALL SERVICES ===")
result = run("cd /opt/safarizetu-ops-engine/infrastructure && docker compose up -d --force-recreate 2>&1 | tail -20", timeout=120)
print(f"  {result}")

time.sleep(20)

# Check health
print("\n=== HEALTH CHECK ===")
result = run("curl -s http://localhost:3000/health")
print(f"  {result}")

# Test Apollo in compiled JS
print("\n=== TEST APOLLO IN COMPILED JS ===")
result = run("docker exec ops_engine grep -n 'X-Api-Key\\|api_key' /app/dist/services/apollo.service.js 2>&1")
print(f"  {result}")

# Test Apollo API
print("\n=== TEST APOLLO API ===")
result = run("""docker exec ops_engine node -e "
const key=process.env.APOLLO_API_KEY;
fetch('https://api.apollo.io/v1/mixed_people/search',{method:'POST',headers:{'Content-Type':'application/json','X-Api-Key':key},body:JSON.stringify({q_organization_keyword_tags:['safari'],person_titles:['owner'],page:1,per_page:3})}).then(r=>r.json()).then(d=>{console.log(JSON.stringify({total:d.pagination?.total_entries,people:d.people?.map(p=>({name:p.name,title:p.title,email:p.email}))},null,2));process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)})
" 2>&1""")
print(f"  {result}")

c.close()