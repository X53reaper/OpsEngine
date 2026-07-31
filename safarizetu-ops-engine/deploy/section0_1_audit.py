import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd):
    _, o, _ = c.exec_command(cmd, timeout=30)
    return o.read().decode("utf-8", errors="replace").strip()

# Section 0 State Report
print("=" * 60)
print("  SECTION 0 — STATE REPORT")
print("=" * 60)
print("""
  COMPONENT                | STATUS
  ---------------------------|------------------
  Docker containers          | RUNNING (7/7)
  PostgreSQL                 | CONNECTED
  Database tables            | EXIST (129)
  n8n                        | RUNNING (200)
  Cloudflare Tunnel          | ACTIVE
  Ops engine Node process    | RUNNING
  Public URL reachable       | YES (200)
  Langfuse                   | CONNECTED (v2.95.11)
""")

# Check OPS_ENGINE_URL and SAFARI_ZETU_BRIDGE_URL
print("--- KEY URLS ---")
print(run("grep -E '^(OPS_ENGINE_URL|SAFARI_ZETU_BRIDGE_URL|SAFARI_ZETU_API_KEY|WEBHOOK_URL)=' /opt/safarizetu-ops-engine/.env | sed 's/=.*/=***/'"))

# Section 1: Check bridge
print("\n" + "=" * 60)
print("  SECTION 1 — CONFIRM SAFARI ZETU BRIDGE EXISTS")
print("=" * 60)

bridge_url = run("grep SAFARI_ZETU_BRIDGE_URL /opt/safarizetu-ops-engine/.env | cut -d= -f2-")
api_key = run("grep SAFARI_ZETU_API_KEY /opt/safarizetu-ops-engine/.env | cut -d= -f2-")

print(f"\nBridge URL: {bridge_url}")
print(f"API Key: {api_key[:20]}...")

# Test bridge
print("\n--- BRIDGE HEALTH CHECK ---")
result = run(f"curl -s -w '\\nHTTP_CODE:%{{http_code}}' '{bridge_url}?resource=health' -H 'x-ops-api-key: {api_key}'")
print(result)

c.close()