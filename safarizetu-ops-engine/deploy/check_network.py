import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

print("=== NETWORK CONNECTIVITY FROM CONTAINER ===")

# Test DNS
print("\n--- DNS TEST ---")
result = run("docker exec ops_engine sh -c 'nslookup api.apollo.io 2>&1'")
print(f"  {result}")

# Test curl to known site
print("\n--- CURL TO GOOGLE ---")
result = run("docker exec ops_engine sh -c 'curl -s -o /dev/null -w \"%{http_code}\" https://google.com --max-time 10 2>&1'")
print(f"  HTTP: {result}")

# Test curl to apollo
print("\n--- CURL TO APOLLO (HEAD) ---")
result = run("docker exec ops_engine sh -c 'curl -s -I https://api.apollo.io --max.io --max-time 10 2>&1 | head -5'")
print(f"  {result}")

# Test with verbose
print("\n--- CURL VERBOSE TO APOLLO ---")
result = run("docker exec ops_engine sh -c 'curl -v https://api.apollo.io/v1/people/match -H \"X-Api-Key: test\" -d \"{\\\"email\\\":\\\"test@test.com\\\"}\" --max-time 10 2>&1 | tail -20'")
print(f"  {result}")

# Check if container has internet
print("\n--- PING TEST ---")
result = run("docker exec ops_engine sh -c 'apk add --no-cache iputils 2>&1 | tail -3; ping -c 1 8.8.8.8 2>&1'")
print(f"  {result}")

c.close()