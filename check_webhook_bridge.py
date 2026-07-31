import paramiko
import time
import json
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='ascii', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789')

print("=" * 70)
print("PHASE 3 — WEBHOOK BRIDGE VERIFICATION")
print("=" * 70)

# 1. Check Cloudflare Tunnel status
print("\n--- 1. Cloudflare Tunnel Status ---")
cmd = "docker logs ops_cloudflared --tail 20 2>&1 | grep -i -E 'conn|error|ingress|route'"
stdin, stdout, stderr = ssh.exec_command(cmd)
time.sleep(5)
print(stdout.read().decode('ascii', errors='replace'))

# 2. Test public URL reachability
print("\n--- 2. Public URL Reachability ---")
cmd2 = """curl -s -o /dev/null -w "%{http_code}" https://ops.safarizetu.com/health 2>&1"""
stdin2, stdout2, stderr2 = ssh.exec_command(cmd2)
time.sleep(8)
print(f"  ops.safarizetu.com/health: HTTP {stdout2.read().decode('ascii', errors='replace').strip()}")

# 3. Test webhook endpoint via public URL
print("\n--- 3. Webhook Endpoint via Public URL ---")
cmd3 = """curl -s -X POST https://ops.safarizetu.com/webhook/safari-zetu \
  -H 'Content-Type: application/json' \
  -d '{"event":"test.ping","data":{"id":"bridge-test-001","message":"bridge connectivity test"}}' 2>&1"""
stdin3, stdout3, stderr3 = ssh.exec_command(cmd3)
time.sleep(10)
print(f"  Response: {stdout3.read().decode('ascii', errors='replace')[:300]}")

# 4. Check ops-bridge from Safari Zetu
print("\n--- 4. Safari Zetu Ops Bridge Health ---")
cmd4 = """curl -s "https://safarizetu.com/api/ops-bridge?resource=health" 2>&1"""
stdin4, stdout4, stderr4 = ssh.exec_command(cmd4)
time.sleep(10)
print(f"  Response: {stdout4.read().decode('ascii', errors='replace')[:300]}")

# 5. Check n8n workflows
print("\n--- 5. n8n Workflow Status ---")
cmd5 = """curl -s "http://localhost:5678/api/v1/workflows" \
  -H "X-N8N-API-KEY: $(grep N8N_API_KEY /opt/safarizetu-ops-engine/.env 2>/dev/null | cut -d= -f2)" 2>&1 | head -c 500"""
stdin5, stdout5, stderr5 = ssh.exec_command(cmd5)
time.sleep(8)
print(f"  {stdout5.read().decode('ascii', errors='replace')[:300]}")

# 6. Check ops engine logs for any errors
print("\n--- 6. Recent Ops Engine Errors ---")
cmd6 = "docker logs ops_engine --tail 50 2>&1 | grep -i error | tail -10"
stdin6, stdout6, stderr6 = ssh.exec_command(cmd6)
time.sleep(5)
errors = stdout6.read().decode('ascii', errors='replace')
if errors.strip():
    for line in errors.strip().split('\n'):
        print(f"  {line}")
else:
    print("  No recent errors")

ssh.close()
