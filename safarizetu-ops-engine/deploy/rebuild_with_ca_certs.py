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

# Upload fixed Dockerfile
print("=== UPLOADING FIXED DOCKERFILE ===")
sftp = c.open_sftp()
sftp.put(
    r"D:\Projects\SafariZetu Automation\safarizetu-ops-engine\infrastructure\Dockerfile.ops",
    "/opt/safarizetu-ops-engine/infrastructure/Dockerfile.ops"
)
sftp.close()
print("  Uploaded")

# Build
print("\n=== BUILDING IMAGE ===")
result = run("cd /opt/safarizetu-ops-engine/infrastructure && docker build -t safarizetu-ops-engine:latest -f Dockerfile.ops .. 2>&1 | tail -10", timeout=300)
print(f"  {result}")

# Recreate all services
print("\n=== RECREATING SERVICES ===")
result = run("cd /opt/safarizetu-ops-engine/infrastructure && docker compose up -d --force-recreate 2>&1 | tail -15", timeout=120)
print(f"  {result}")

time.sleep(20)

# Test network
print("\n=== TEST NETWORK ===")
result = run("docker exec ops_engine sh -c 'curl -s -o /dev/null -w \"%{http_code}\" https://google.com --max-time 10 2>&1'")
print(f"  Google HTTP: {result}")

# Test Apollo
print("\n=== TEST APOLLO ===")
result = run("""docker exec ops_engine node -e "
const key=process.env.APOLLO_API_KEY;
fetch('https://api.apollo.io/v1/people/match',{method:'POST',headers:{'Content-Type':'application/json','X-Api-Key':key},body:JSON.stringify({email:'tim@apple.com'})}).then(r=>r.json()).then(d=>{console.log('Person:',d.person?{name:d.person.name,title:d.person.title,email:d.person.email}:'not found');process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)})
" 2>&1""")
print(f"  {result}")

c.close()