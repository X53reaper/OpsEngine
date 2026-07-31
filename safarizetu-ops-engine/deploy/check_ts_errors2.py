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

# Check TypeScript errors from container
print("=== TYPESCRIPT ERRORS (FROM CONTAINER) ===")
result = run("docker exec ops_engine npx tsc --noEmit 2>&1 | head -50", timeout=120)
print(f"  {result}")

c.close()