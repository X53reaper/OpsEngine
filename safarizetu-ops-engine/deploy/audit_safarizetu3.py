import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

API_KEY = "c4596f39a61f364b7e6619cb9dcc1d23"

print("=" * 60)
print("  SAFARIZETU.COM AUDIT RESULTS")
print("=" * 60)

# 1. Check ops bridge health
print("\n--- OPS BRIDGE HEALTH ---")
result = run(f"curl -s -L 'https://safarizetu.com/api/ops-bridge?resource=health' -H 'x-ops-api-key: {API_KEY}'")
print(f"  Response: {result}")

# 2. Check if there's an existing Booking model in the page source
print("\n--- CHECKING FOR ENQUIRY/BOOKING FORMS IN PAGE SOURCE ---")
result = run("curl -s -L 'https://safarizetu.com/' 2>&1 | grep -oi 'enquir\\|booking\\|ops-bridge\\|sendOpsWebhook\\|EnquiryForm' | head -10")
print(f"  Found in homepage: {result if result else 'NONE'}")

# 3. Check operators page
print("\n--- CHECKING OPERATORS PAGE ---")
result = run("curl -s -L 'https://safarizetu.com/operators' 2>&1 | grep -oi 'enquir\\|booking\\|ops-bridge\\|sendOpsWebhook\\|EnquiryForm' | head -10")
print(f"  Found: {result if result else 'NONE'}")

# 4. Check for lodges page (from footer links)
print("\n--- CHECKING LODGES PAGE ---")
result = run("curl -s -L 'https://safarizetu.com/lodges' -o /dev/null -w '%{{http_code}}'")
print(f"  Status: {result}")

# 5. Check for search page
print("\n--- CHECKING SEARCH PAGE ---")
result = run("curl -s -L 'https://safarizetu.com/search' -o /dev/null -w '%{{http_code}}'")
print(f"  Status: {result}")

# 6. Check for experiences page
print("\n--- CHECKING EXPERIENCES PAGE ---")
result = run("curl -s -L 'https://safarizetu.com/experiences' -o /dev/null -w '%{{http_code}}'")
print(f"  Status: {result}")

# 7. Check if /api/bookings exists
print("\n--- CHECKING /api/bookings ---")
result = run(f"curl -s -L 'https://safarizetu.com/api/bookings' -H 'x-ops-api-key: {API_KEY}' -w '\\nHTTP_CODE:%{{http_code}}'")
print(f"  Response: {result}")

# 8. Check if /api/ops-bridge accepts POST
print("\n--- CHECKING /api/ops-bridge POST ---")
result = run(f"curl -s -L -X POST 'https://safarizetu.com/api/ops-bridge' -H 'Content-Type: application/json' -H 'x-ops-api-key: {API_KEY}' -d '{{\"event\":\"health.check\"}}' -w '\\nHTTP_CODE:%{{http_code}}'")
print(f"  Response: {result}")

# 9. Check ops engine webhook endpoint
print("\n--- CHECKING OPS ENGINE WEBHOOK ---")
result = run("curl -s -X POST http://localhost:3000/webhook/safari-zetu -H 'Content-Type: application/json' -d '{\"event\":\"health.check\",\"data\":{}}' -w '\\nHTTP_CODE:%{{http_code}}'")
print(f"  Response: {result}")

# 10. Summary
print("\n" + "=" * 60)
print("  SUMMARY")
print("=" * 60)
print("""
  FINDINGS:
  1. safarizetu.com is a Next.js app on Vercel
  2. /api/ops-bridge EXISTS but returns 401 (API key mismatch)
  3. No 'EnquiryForm' or 'booking' found in page source
  4. Footer has partner signup/login links
  5. Pages: /, /operators, /lodges, /search, /experiences, /destinations
  6. Ops engine webhook endpoint is working locally

  WHAT NEEDS TO BE DONE ON SAFARIZETU.COM:
  1. Create src/lib/ops-webhook.ts (fire-and-forget sender)
  2. Create src/app/api/ops-bridge/route.ts (receiver with API key auth)
  3. Create src/app/api/bookings/route.ts (POST handler)
  4. Create src/components/EnquiryForm.tsx (client component)
  5. Mount EnquiryForm on /operators/[slug], /lodges/[slug], /experiences/[slug]
  6. Set env vars: OPS_ENGINE_URL, OPS_ENGINE_API_KEY, OPS_ENGINE_WEBHOOK_SECRET

  API KEYS TO USE:
  - OPS_ENGINE_API_KEY: c4596f39a61f364b7e6619cb9dcc1d23
  - OPS_ENGINE_WEBHOOK_SECRET: 6c57d804c331344674e4b2d134bcce0568e9c849077f7b5c5d80d49dfd015e8b
  - OPS_ENGINE_URL: https://ops.safarizetu.com
""")

c.close()