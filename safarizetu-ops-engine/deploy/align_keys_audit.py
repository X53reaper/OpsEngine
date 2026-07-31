import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

# 1. Set TEST_EMAIL in ops engine .env
print("=== SETTING TEST EMAIL ===")
result = run("grep -q 'TEST_EMAIL=' /opt/safarizetu-ops-engine/.env && echo EXISTS || echo MISSING")
if "EXISTS" in result:
    run("sed -i 's/^TEST_EMAIL=.*/TEST_EMAIL=sirmarshalmuvhuni@gmail.com/' /opt/safarizetu-ops-engine/.env")
    print("  Updated TEST_EMAIL")
else:
    run("echo 'TEST_EMAIL=sirmarshalmuvhuni@gmail.com' >> /opt/safarizetu-ops-engine/.env")
    print("  Added TEST_EMAIL")

# 2. Get all API keys and secrets from ops engine
print("\n=== OPS ENGINE API KEYS ===")
keys = {
    "SAFARI_ZETU_API_KEY": run("grep '^SAFARI_ZETU_API_KEY=' /opt/safarizetu-ops-engine/.env | cut -d= -f2-"),
    "SAFARI_ZETU_WEBHOOK_SECRET": run("grep '^SAFARI_ZETU_WEBHOOK_SECRET=' /opt/safarizetu-ops-engine/.env | cut -d= -f2-"),
    "OPS_ENGINE_API_KEY": run("grep '^OPS_ENGINE_API_KEY=' /opt/safarizetu-ops-engine/.env | cut -d= -f2-"),
    "OPS_ENGINE_SECRET": run("grep '^OPS_ENGINE_SECRET=' /opt/safarizetu-ops-engine/.env | cut -d= -f2-"),
}

for key, value in keys.items():
    print(f"  {key}={value}")

# 3. Restart ops engine to pick up new TEST_EMAIL
print("\n=== RESTARTING OPS ENGINE ===")
run("docker restart ops_engine")
print("  Restarted")

# 4. Check what exists on safarizetu.com
print("\n" + "=" * 60)
print("  SECTION 0 — AUDIT SAFARIZETU.COM")
print("=" * 60)

# Check for existing routes
routes_to_check = [
    ("/api/bookings", "Booking API"),
    ("/api/ops-bridge", "Ops Bridge"),
    ("/api/auth", "Auth"),
    ("/health", "Health"),
    ("/api/enquiries", "Enquiries API"),
]

for route, name in routes_to_check:
    result = run(f"curl -s -o /dev/null -w '%{{http_code}}' https://safarizetu.com{route}")
    print(f"  {name} ({route}): {result}")

# Check for enquiry-related pages
print("\n--- PAGES CHECK ---")
pages_to_check = [
    ("/", "Homepage"),
    ("/operators", "Operators"),
    ("/destinations", "Destinations"),
    ("/listings", "Listings"),
]

for route, name in pages_to_check:
    result = run(f"curl -s -o /dev/null -w '%{{http_code}}' https://safarizetu.com{route}")
    print(f"  {name} ({route}): {result}")

# Check if ops-bridge responds to health check with our API key
print("\n--- OPS BRIDGE HEALTH CHECK ---")
api_key = keys.get("SAFARI_ZETU_API_KEY", "")
result = run(f"curl -s -L -w '\\nHTTP_CODE:%{{http_code}}' 'https://safarizetu.com/api/ops-bridge?resource=health' -H 'x-ops-api-key: {api_key}'")
print(f"  Result: {result}")

c.close()