import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

# Get the API key
apollo_key = run("grep '^APOLLO_API_KEY=' /opt/safarizetu-ops-engine/.env | cut -d= -f2-")
print(f"=== APOLLO KEY: {apollo_key[:10]}... (len={len(apollo_key)}) ===")

# Test with curl to see full response
print("\n=== RAW APOLLO RESPONSE ===")
result = run(f"""docker exec ops_engine sh -c "
curl -s -X POST 'https://api.apollo.io/v1/people/match' \
  -H 'Content-Type: application/json' \
  -H 'X-Api-Key: {apollo_key}' \
  -d '{{\"email\":\"tim@apple.com\"}}'
" 2>&1""")
print(f"  {result}")

# Test with auth check endpoint
print("\n=== AUTH CHECK ===")
result = run(f"""docker exec ops_engine sh -c "
curl -s -X GET 'https://api.apollo.io/v1/auth/health' \
  -H 'X-Api-Key: {apollo_key}'
" 2>&1""")
print(f"  {result}")

# Test with mixed_people/search
print("\n=== MIXED PEOPLE SEARCH ===")
result = run(f"""docker exec ops_engine sh -c "
curl -s -X POST 'https://api.apollo.io/v1/mixed_people/search' \
  -H 'Content-Type: application/json' \
  -H 'X-Api-Key: {apollo_key}' \
  -d '{{\"person_titles\":[\"ceo\"],\"page\":1,\"per_page\":3}}'
" 2>&1""")
print(f"  {result}")

# Test with wrong key to compare
print("\n=== WITH WRONG KEY (should error) ===")
result = run(f"""docker exec ops_engine sh -c "
curl -s -X POST 'https://api.apollo.io/v1/people/match' \
  -H 'Content-Type: application/json' \
  -H 'X-Api-Key: invalid_key' \
  -d '{{\"email\":\"tim@apple.com\"}}'
" 2>&1""")
print(f"  {result}")

c.close()