import paramiko
import sys

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd):
    _, o, _ = c.exec_command(cmd, timeout=30)
    return o.read().decode("utf-8", errors="replace").strip()

# Check Apify config - write to file
out = run("cat /opt/safarizetu-ops-engine/.env | grep -i APIFY")
with open("apify_config.txt", "w", encoding="utf-8") as f:
    f.write(out + "\n")

# Check competitor intelligence service
out = run("docker exec ops_engine cat /app/src/services/competitor-intelligence.service.ts 2>/dev/null | grep -A 30 'Apify' | head -50")
with open("apify_service.txt", "w", encoding="utf-8") as f:
    f.write(out + "\n")

# Check Apify actors
out = run("docker exec ops_engine cat /app/src/services/competitor-intelligence.service.ts 2>/dev/null | grep -i 'actor' | head -20")
with open("apify_actors.txt", "w", encoding="utf-8") as f:
    f.write(out + "\n")

print("Done - check files")
c.close()