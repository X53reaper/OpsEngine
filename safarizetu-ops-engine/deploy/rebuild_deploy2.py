import paramiko
import time

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=120):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

# 1. Rebuild Docker image (longer timeout)
print("=== REBUILDING DOCKER IMAGE ===")
out = run("cd /opt/safarizetu-ops-engine/infrastructure && docker build -t safarizetu-ops-engine:latest -f Dockerfile.ops .. 2>&1 | tail -5", timeout=180)
print(out)

# 2. Recreate container
print("\n=== RECREATING CONTAINER ===")
out = run("cd /opt/safarizetu-ops-engine/infrastructure && docker compose up -d --force-recreate ops-engine 2>&1")
print(out)

time.sleep(15)

# 3. Verify compiled code
print("\n=== VERIFY COMPILED CODE ===")
_, o, _ = c.exec_command("docker exec ops_engine cat /app/dist/scheduler/cron.js | grep -A 10 'Check new enquiries'")
content = o.read()
with open("verify_compiled.txt", "wb") as f:
    f.write(content)

# 4. Check logs
print("\n=== LOGS ===")
print(run("docker logs ops_engine --since 20s 2>&1 | tail -10"))

c.close()
print("\nDone - check verify_compiled.txt")