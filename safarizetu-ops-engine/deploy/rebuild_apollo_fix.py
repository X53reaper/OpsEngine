import paramiko
import time

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=120):
    _, o, e = c.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", errors="replace").strip()
    err = e.read().decode("utf-8", errors="replace").strip()
    return out + "\n" + err if err else out

print("=== REBUILDING OPS ENGINE ===")

# 1. Copy updated source to server
print("\n--- UPLOADING FIXED apollo.service.ts ---")
sftp = c.open_sftp()
sftp.put(
    r"D:\Projects\SafariZetu Automation\safarizetu-ops-engine\src\services\apollo.service.ts",
    "/tmp/apollo.service.ts"
)
sftp.close()
print("  Uploaded")

# 2. Copy to project
result = run("cp /tmp/apollo.service.ts /opt/safarizetu-ops-engine/src/services/apollo.service.ts")
print(f"  Copied: {result}")

# 3. Rebuild Docker image
print("\n--- REBUILDING DOCKER IMAGE ---")
result = run("cd /opt/safarizetu-ops-engine && docker build -t safarizetu-ops-engine:latest -f Dockerfile.ops . 2>&1 | tail -5", timeout=300)
print(f"  {result}")

# 4. Recreate container
print("\n--- RECREATING CONTAINER ---")
result = run("cd /opt/safarizetu-ops-engine && docker compose up -d --force-recreate ops_engine 2>&1", timeout=60)
print(f"  {result}")

# 5. Wait for startup
print("\n--- WAITING FOR STARTUP ---")
time.sleep(15)

# 6. Check health
print("\n--- HEALTH CHECK ---")
result = run("curl -s http://localhost:3000/health")
print(f"  {result}")

# 7. Test Apollo directly
print("\n--- TEST APOLLO API ---")
result = run("""docker exec ops_engine node -e "
const key=process.env.APOLLO_API_KEY;
fetch('https://api.apollo.io/v1/mixed_people/search',{method:'POST',headers:{'Content-Type':'application/json','X-Api-Key':key},body:JSON.stringify({q_organization_keyword_tags:['safari'],person_titles:['owner'],page:1,per_page:3})}).then(r=>r.json()).then(d=>{console.log(JSON.stringify({total:d.pagination?.total_entries,people:d.people?.map(p=>({name:p.name,title:p.title,email:p.email}))},null,2));process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)})
" 2>&1""")
print(f"  {result}")

c.close()