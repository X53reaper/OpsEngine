import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd):
    _, o, _ = c.exec_command(cmd, timeout=30)
    return o.read().decode("utf-8", errors="replace").strip()

# Check Apify config
print("=== APIFY CONFIG ===")
out = run("cat /opt/safarizetu-ops-engine/.env | grep -i APIFY")
print(out)

# Check the competitor intelligence service to see what Apify config it needs
print("\n=== COMPETITOR INTELLIGENCE SERVICE ===")
out = run("docker exec ops_engine cat /app/src/services/competitor-intelligence.service.ts 2>/dev/null | grep -A 30 'Apify' | head -50")
print(out)

# Check what Apify actors are being used
print("\n=== APIFY ACTORS ===")
out = run("docker exec ops_engine cat /app/src/services/competitor-intelligence.service.ts 2>/dev/null | grep -i 'actor' | head -20")
print(out)

c.close()