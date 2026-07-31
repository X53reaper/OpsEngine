import paramiko
import json

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

# The key that safarizetu.com expects (OPS_ENGINE_API_KEY from bridge code)
CORRECT_KEY = "dee222cc2eb4afd36e7ed1057700e32e"
WEBHOOK_SECRET = "6c57d804c331344674e4b2d134bcce0568e9c849077f7b5c5d80d49dfd015e8b"

print("=" * 60)
print("  TESTING WITH CORRECT API KEY")
print("=" * 60)

# 1. Test /api/ops-bridge with correct key
print("\n--- TEST /api/ops-bridge GET ---")
result = run(f"curl -s -L 'https://safarizetu.com/api/ops-bridge?resource=health' -H 'x-ops-api-key: {CORRECT_KEY}' -w '\\nHTTP_CODE:%{{http_code}}'")
print(f"  Response: {result}")

# 2. Test /api/bookings with correct key
print("\n--- TEST /api/bookings GET ---")
result = run(f"curl -s -L 'https://safarizetu.com/api/bookings' -H 'x-ops-api-key: {CORRECT_KEY}' -w '\\nHTTP_CODE:%{{http_code}}'")
print(f"  Response: {result}")

# 3. Test /api/bookings POST with correct key
print("\n--- TEST /api/bookings POST ---")
booking_payload = json.dumps({
    "listingId": "test-listing-001",
    "listingName": "Test Safari Lodge",
    "listingType": "lodge",
    "customerName": "Test Customer",
    "customerEmail": "sirmarshalmuvhuni@gmail.com",
    "customerPhone": "+263771234567",
    "travelDate": "2026-07-15",
    "guests": 2,
    "message": "Test enquiry from ops engine"
})
result = run(f"curl -s -L -X POST 'https://safarizetu.com/api/bookings' -H 'Content-Type: application/json' -H 'x-ops-api-key: {CORRECT_KEY}' -d '{booking_payload}' -w '\\nHTTP_CODE:%{{http_code}}'")
print(f"  Response: {result}")

# 4. Test /api/ops-bridge POST with webhook secret
print("\n--- TEST /api/ops-bridge POST ---")
payload = json.dumps({"event": "health.check", "data": {}})
result = run(f"curl -s -L -X POST 'https://safarizetu.com/api/ops-bridge' -H 'Content-Type: application/json' -H 'x-ops-api-key: {CORRECT_KEY}' -H 'x-ops-webhook-secret: {WEBHOOK_SECRET}' -d '{payload}' -w '\\nHTTP_CODE:%{{http_code}}'")
print(f"  Response: {result}")

c.close()