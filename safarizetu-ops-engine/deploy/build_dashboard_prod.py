import paramiko
import time

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd):
    _, o, e = c.exec_command(cmd, timeout=300)
    return o.read().decode("utf-8", errors="replace").strip()

# 1. Build dashboard for production inside container
print("=== BUILDING DASHBOARD FOR PRODUCTION ===")
out = run("docker exec ops_dashboard sh -c 'cd /app && npm run build 2>&1 | tail -20'")
print(out)

# 2. Check if build succeeded
print("\n=== CHECK BUILD OUTPUT ===")
out = run("docker exec ops_dashboard ls -la /app/build/ 2>&1")
print(out)

# 3. Check if nginx is serving the build
print("\n=== CHECK NGINX ===")
out = run("docker exec ops_dashboard cat /etc/nginx/conf.d/default.conf 2>&1")
print(out)

# 4. Restart dashboard to pick up production build
print("\n=== RESTART DASHBOARD ===")
run("docker restart ops_dashboard")
time.sleep(5)

# 5. Verify
print("\n=== VERIFY DASHBOARD ===")
out = run("curl -s http://localhost:3002/ | head -c 300")
print(out)

c.close()
