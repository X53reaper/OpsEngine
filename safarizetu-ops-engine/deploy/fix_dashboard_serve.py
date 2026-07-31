import paramiko
import time

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd):
    _, o, e = c.exec_command(cmd, timeout=60)
    return o.read().decode("utf-8", errors="replace").strip(), e.read().decode("utf-8", errors="replace").strip()

# 1. Check what's running in the dashboard container
print("=== DASHBOARD CONTAINER PROCESSES ===")
out, _ = run("docker exec ops_dashboard ps aux")
print(out)

# 2. Check if nginx is installed
print("\n=== CHECK NGINX ===")
out, _ = run("docker exec ops_dashboard which nginx 2>&1")
print(f"  nginx path: {out}")

# 3. Check what's listening on port 3002
print("\n=== PORT 3002 LISTENERS ===")
out, _ = run("docker exec ops_dashboard netstat -tlnp 2>/dev/null | grep 3002 || ss -tlnp | grep 3002")
print(out)

# 4. Option: Use 'serve' package to serve static files
print("\n=== INSTALLING SERVE ===")
out, err = run("docker exec ops_dashboard npm install -g serve 2>&1")
print(f"  install: {out[-200:]}")
if err:
    print(f"  stderr: {err[-200:]}")

# 5. Kill the dev server and start serve
print("\n=== STOPPING DEV SERVER ===")
run("docker exec ops_dashboard pkill -f 'react-scripts' 2>&1")
time.sleep(2)

# 6. Start serve on port 3002
print("\n=== STARTING PRODUCTION SERVER ===")
run("docker exec -d ops_dashboard sh -c 'cd /app && npx serve -s build -l 3002'")
time.sleep(3)

# 7. Verify
print("\n=== VERIFY PRODUCTION DASHBOARD ===")
out, _ = run("curl -s http://localhost:3002/ | head -c 500")
print(out)

# 8. Check processes
print("\n=== NEW PROCESSES ===")
out, _ = run("docker exec ops_dashboard ps aux | grep -E 'serve|node'")
print(out)

c.close()
