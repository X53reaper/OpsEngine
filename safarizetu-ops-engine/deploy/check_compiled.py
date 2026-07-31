import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd):
    _, o, _ = c.exec_command(cmd, timeout=30)
    return o.read().decode("utf-8", errors="replace").strip()

# Check the compiled cron.js
print("=== COMPILED CRON.JS (enquiry check) ===")
print(run("docker exec ops_engine cat /app/dist/scheduler/cron.js | grep -A 15 'Check new enquiries'"))

# Check if fetchFromSafariZetu is still imported
print("\n=== IMPORTS ===")
print(run("docker exec ops_engine cat /app/dist/scheduler/cron.js | head -5"))

# Check what's actually in the enquiry_check error
print("\n=== DETAILED ERROR ===")
print(run("docker logs ops_engine --since 1h 2>&1 | grep -i 'enquiry' | tail -5"))

c.close()