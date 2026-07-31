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

# Check build error
print("=== BUILD ERROR ===")
result = run("cd /opt/safarizetu-ops-engine/infrastructure && docker build -t safarizetu-ops-engine:latest -f Dockerfile.ops .. 2>&1 | grep -A 20 'ERROR\\|error:' | head -50", timeout=300)
print(f"  {result}")

c.close()