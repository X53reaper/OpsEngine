import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

resend_key = run("grep '^RESEND_API_KEY=' /opt/safarizetu-ops-engine/.env | cut -d= -f2-")
from_email = run("grep '^RESEND_FROM_EMAIL=' /opt/safarizetu-ops-engine/.env | cut -d= -f2-")
from_name = run("grep '^RESEND_FROM_NAME=' /opt/safarizetu-ops-engine/.env | cut -d= -f2-")

print(f"=== RESEND CONFIG ===")
print(f"  Key: {resend_key[:10]}...")
print(f"  From: {from_name} <{from_email}>")

# Test from container with full response
print("\n=== RESEND FROM CONTAINER (VERBOSE) ===")
result = run(f"""docker exec ops_engine sh -c "
curl -v -X POST 'https://api.resend.com/emails' \
  -H 'Authorization: Bearer {resend_key}' \
  -H 'Content-Type: application/json' \
  -d '{{\"from\":\"{from_name} <{from_email}>\",\"to\":\"sirmarshalmuvhuni@gmail.com\",\"subject\":\"Test from container\",\"html\":\"<p>Test</p>\"}}' \
  --max-time 15 2>&1
" 2>&1""")
print(f"  {result}")

# Test with just email (no display name)
print("\n=== RESEND WITHOUT DISPLAY NAME ===")
result = run(f"""docker exec ops_engine sh -c "
curl -s -X POST 'https://api.resend.com/emails' \
  -H 'Authorization: Bearer {resend_key}' \
  -H 'Content-Type: application/json' \
  -d '{{\"from\":\"{from_email}\",\"to\":\"sirmarshalmuvhuni@gmail.com\",\"subject\":\"Test from container\",\"html\":\"<p>Test</p>\"}}' \
  --max-time 15 2>&1
" 2>&1""")
print(f"  {result}")

# Test with Resend's default domain
print("\n=== RESEND WITH ONBOARDING DOMAIN ===")
result = run(f"""docker exec ops_engine sh -c "
curl -s -X POST 'https://api.resend.com/emails' \
  -H 'Authorization: Bearer {resend_key}' \
  -H 'Content-Type: application/json' \
  -d '{{\"from\":\"onboarding@resend.dev\",\"to\":\"sirmarshalmuvhuni@gmail.com\",\"subject\":\"Test from container\",\"html\":\"<p>Test</p>\"}}' \
  --max-time 15 2>&1
" 2>&1""")
print(f"  {result}")

c.close()