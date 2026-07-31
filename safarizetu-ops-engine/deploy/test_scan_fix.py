import paramiko
import json
import threading

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd):
    _, o, _ = c.exec_command(cmd, timeout=30)
    return o.read().decode("utf-8", errors="replace").strip()

# 1. Test competitors/scan endpoint (may take a while)
print("=== TESTING /api/competitors/scan ===")
import subprocess
result = subprocess.run(
    ["curl", "-s", "-w", "\\nHTTP_CODE:%{http_code}\\nTIME:%{time_total}", 
     "-X", "POST", "http://192.168.18.50:3000/api/competitors/scan"],
    capture_output=True, text=True, timeout=120
)
print(f"  Response: {result.stdout[:500]}")

# 2. Test /api/competitors/landscape (should be faster)
print("\n=== TESTING /api/competitors/landscape ===")
result2 = subprocess.run(
    ["curl", "-s", "-w", "\\nHTTP_CODE:%{http_code}\\nTIME:%{time_total}", 
     "http://192.168.18.50:3000/api/competitors/landscape"],
    capture_output=True, text=True, timeout=30
)
print(f"  Response: {result2.stdout[:500]}")

# 3. Fix the enquiry check - the bridge URL returns 308 redirect
# Let's check what URL it should actually be
print("\n=== FIXING ENQUIRY CHECK ===")
print("  The bridge URL https://safarizetu.com/api/ops-bridge returns 308 redirect")
print("  Options: 1) Follow redirects 2) Use local DB 3) Update URL")

# 4. Check if we can query local enquiry_log
print("\n=== LOCAL ENQUIRY_LOG ===")
out = run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c 'SELECT COUNT(*) as total FROM enquiry_log;' 2>&1")
print(out)

# 5. Check what tables exist
print("\n=== ALL TABLES ===")
out = run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c '\\dt' 2>&1")
print(out)

c.close()
