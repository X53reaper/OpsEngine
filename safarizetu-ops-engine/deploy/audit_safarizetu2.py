import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

API_KEY = "c4596f39a61f364b7e6619cb9dcc1d23"

print("=" * 60)
print("  SECTION 0 — AUDIT SAFARIZETU.COM (HTTPS)")
print("=" * 60)

# API routes
print("\n--- API ROUTES ---")
routes = [
    ("/api/ops-bridge?resource=health", "Ops Bridge Health"),
    ("/api/ops-bridge?resource=agents&limit=1", "Ops Bridge Agents"),
    ("/api/bookings", "Bookings API"),
    ("/api/auth", "Auth"),
    ("/api/enquiries", "Enquiries API"),
    ("/api/webhook", "Webhook endpoint"),
]
for route, name in routes:
    result = run(f"curl -s -L -w '\\nHTTP_CODE:%{{http_code}}' 'https://safarizetu.com{route}' -H 'x-ops-api-key: {API_KEY}'")
    lines = result.split("\n")
    code = [l for l in lines if l.startswith("HTTP_CODE:")]
    body = "\n".join([l for l in lines if not l.startswith("HTTP_CODE:")])
    print(f"  {name}: {code[0] if code else 'unknown'}")
    if body:
        print(f"    Body: {body[:200]}")

# Pages
print("\n--- PAGES ---")
pages = [
    ("/", "Homepage"),
    ("/operators", "Operators"),
    ("/destinations", "Destinations"),
    ("/safari-packages", "Safari Packages"),
]
for route, name in pages:
    result = run(f"curl -s -L -o /dev/null -w '%{{http_code}}' 'https://safarizetu.com{route}'")
    print(f"  {name}: {result}")

# Check safarizetu.com source for ops-bridge route
print("\n--- LOOKING FOR OPS-BRIDGE IN SAFARIZETU SOURCE ---")
result = run("curl -s -L 'https://safarizetu.com/api/ops-bridge?resource=routes' -H 'x-ops-api-key: c4596f39a61f364b7e6619cb9dcc1d23'")
print(f"  Routes endpoint: {result[:300]}")

# Check for enquiry form pages
print("\n--- LOOKING FOR ENQUIRY/BOOKING FORMS ---")
result = run("curl -s -L 'https://safarizetu.com/operators' -H 'x-ops-api-key: c4596f39a61f364b7e6619cb9dcc1d23' 2>&1 | grep -i 'enquir\\|book\\|contact\\|form\\|ops-bridge' | head -20")
print(f"  Operators page mentions: {result if result else 'nothing found'}")

result = run("curl -s -L 'https://safarizetu.com/' 2>&1 | grep -i 'enquir\\|book\\|contact\\|ops-bridge' | head -20")
print(f"  Homepage mentions: {result if result else 'nothing found'}")

c.close()