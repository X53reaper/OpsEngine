import paramiko
import json

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

API_KEY = "c4596f39a61f364b7e6619cb9dcc1d23"
WEBHOOK_SECRET = "6c57d804c331344674e4b2d134bcce0568e9c849077f7b5c5d80d49dfd015e8b"

print("=" * 60)
print("  TESTING SAFARIZETU.COM API WITH ALIGNED KEYS")
print("=" * 60)

# 1. Test /api/bookings with API key
print("\n--- TEST /api/bookings GET ---")
result = run(f"curl -s -L 'https://safarizetu.com/api/bookings' -H 'x-ops-api-key: {API_KEY}' -w '\\nHTTP_CODE:%{{http_code}}'")
print(f"  Response: {result}")

# 2. Test /api/ops-bridge with API key
print("\n--- TEST /api/ops-bridge GET ---")
result = run(f"curl -s -L 'https://safarizetu.com/api/ops-bridge?resource=health' -H 'x-ops-api-key: {API_KEY}' -w '\\nHTTP_CODE:%{{http_code}}'")
print(f"  Response: {result}")

# 3. Test /api/ops-bridge POST with webhook secret
print("\n--- TEST /api/ops-bridge POST ---")
payload = json.dumps({"event": "health.check", "data": {}})
result = run(f"curl -s -L -X POST 'https://safarizetu.com/api/ops-bridge' -H 'Content-Type: application/json' -H 'x-ops-api-key: {API_KEY}' -H 'x-ops-webhook-secret: {WEBHOOK_SECRET}' -d '{payload}' -w '\\nHTTP_CODE:%{{http_code}}'")
print(f"  Response: {result}")

# 4. Test /api/bookings POST (create test booking)
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
result = run(f"curl -s -L -X POST 'https://safarizetu.com/api/bookings' -H 'Content-Type: application/json' -H 'x-ops-api-key: {API_KEY}' -d '{booking_payload}' -w '\\nHTTP_CODE:%{{http_code}}'")
print(f"  Response: {result}")

# 5. Check if safarizetu.com can reach ops engine
print("\n--- TEST OPS ENGINE HEALTH FROM SAFARIZETU ---")
result = run("curl -s -L 'https://ops.safarizetu.com/health' -w '\\nHTTP_CODE:%{{http_code}}'")
print(f"  Response: {result}")

# 6. Test webhook from safarizetu to ops engine
print("\n--- TEST WEBHOOK FROM SAFARIZETU TO OPS ENGINE ---")
webhook_payload = json.dumps({
    "event": "test.connection",
    "data": {"source": "safarizetu-audit", "timestamp": "2026-06-19T00:00:00Z"}
})
result = run(f"curl -s -L -X POST 'https://ops.safarizetu.com/webhook/safari-zetu' -H 'Content-Type: application/json' -d '{webhook_payload}' -w '\\nHTTP_CODE:%{{http_code}}'")
print(f"  Response: {result}")

c.close()