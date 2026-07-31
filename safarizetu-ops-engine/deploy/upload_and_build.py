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

# 1. Upload fixed apollo.service.ts
print("=== UPLOADING FIXED FILE ===")
sftp = c.open_sftp()
sftp.put(
    r"D:\Projects\SafariZetu Automation\safarizetu-ops-engine\src\services\apollo.service.ts",
    "/opt/safarizetu-ops-engine/src/services/apollo.service.ts"
)
sftp.close()
print("  Uploaded to /opt/safarizetu-ops-engine/src/services/apollo.service.ts")

# 2. Verify the fix
print("\n=== VERIFYING FIX ===")
result = run("grep -n 'X-Api-Key\\|api_key' /opt/safarizetu-ops-engine/src/services/apollo.service.ts")
print(f"  {result}")

# 3. Build Docker image
print("\n=== BUILDING DOCKER IMAGE ===")
result = run("cd /opt/safarizetu-ops-engine/infrastructure && docker build -t safarizetu-ops-engine:latest -f ../Dockerfile .. 2>&1 | tail -10", timeout=300)
print(f"  {result}")

c.close()