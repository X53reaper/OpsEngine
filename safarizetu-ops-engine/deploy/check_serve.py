import paramiko
import time

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd):
    _, o, e = c.exec_command(cmd, timeout=60)
    return o.read().decode("utf-8", errors="replace").strip()

# Check what's on port 3002 now
print("=== PORT 3002 STATUS ===")
out = run("docker exec ops_dashboard ss -tlnp | grep 3002 2>/dev/null || netstat -tlnp | grep 3002 2>/dev/null")
print(out if out else "  Nothing on port 3002")

# Try starting serve directly
print("\n=== STARTING SERVE ===")
out = run("docker exec ops_dashboard sh -c 'cd /app && nohup npx serve -s build -l 3002 > /tmp/serve.log 2>&1 &'")
print(f"  Started: {out}")
time.sleep(3)

# Check serve log
print("\n=== SERVE LOG ===")
out = run("docker exec ops_dashboard cat /tmp/serve.log 2>/dev/null")
print(out)

# Check if it's running
print("\n=== PROCESSES ===")
out = run("docker exec ops_dashboard ps aux | grep -E 'serve|node' | grep -v grep")
print(out)

# Check port
print("\n=== PORT CHECK ===")
out = run("docker exec ops_dashboard ss -tlnp 2>/dev/null | grep 3002")
print(out if out else "  Nothing on 3002")

# Try curl
print("\n=== CURL TEST ===")
out = run("curl -s http://localhost:3002/ | head -c 300")
print(out if out else "  No response")

c.close()
