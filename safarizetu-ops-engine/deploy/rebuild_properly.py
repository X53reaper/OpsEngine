import paramiko
import time

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=300):
    _, o, e = c.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", errors="replace").strip()
    err = e.read().decode("utf-8", errors="replace").strip()
    return (out + "\n" + err).strip()

# Check docker-compose services
print("=== DOCKER-COMPOSE SERVICES ===")
result = run("cat /opt/safarizetu-ops-engine/infrastructure/docker-compose.yml 2>&1 | head -60")
print(f"  {result}")

# Build properly
print("\n=== BUILDING IMAGE ===")
result = run("cd /opt/safarizetu-ops-engine && docker build -t safarizetu-ops-engine:latest -f Dockerfile . 2>&1 | tail -20", timeout=300)
print(f"  {result}")

# Check new image
print("\n=== NEW IMAGE ===")
result = run("docker images safarizetu-ops-engine:latest --format '{{.CreatedAt}} {{.Size}}'")
print(f"  {result}")

# Get service name
print("\n=== RECREATING WITH CORRECT SERVICE NAME ===")
result = run("cd /opt/safarizetu-ops-engine/infrastructure && docker compose up -d --force-recreate 2>&1 | tail -20", timeout=120)
print(f"  {result}")

# Wait
time.sleep(15)

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