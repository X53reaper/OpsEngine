import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd):
    _, o, _ = c.exec_command(cmd, timeout=30)
    return o.read().decode("utf-8", errors="replace").strip()

bridge_url = run("grep SAFARI_ZETU_BRIDGE_URL /opt/safarizetu-ops-engine/.env | cut -d= -f2-")
api_key = run("grep SAFARI_ZETU_API_KEY /opt/safarizetu-ops-engine/.env | cut -d= -f2-")

print("=== BRIDGE CHECK (with -L follow redirect) ===")
result = run(f"curl -s -L -w '\\nHTTP_CODE:%{{http_code}}' '{bridge_url}?resource=health' -H 'x-ops-api-key: {api_key}'")
print(result)

print("\n=== BRIDGE CHECK (without redirect) ===")
result2 = run(f"curl -s -w '\\nHTTP_CODE:%{{http_code}}' '{bridge_url}?resource=health' -H 'x-ops-api-key: {api_key}'")
print(result2)

print("\n=== CHECK SAFARIZETU.COM ROUTES ===")
result3 = run("curl -s -o /dev/null -w '%{http_code}' https://safarizetu.com/api/health")
print(f"  /api/health: {result3}")
result4 = run("curl -s -o /dev/null -w '%{http_code}' https://safarizetu.com/api/ops-bridge")
print(f"  /api/ops-bridge: {result4}")
result5 = run("curl -s -o /dev/null -w '%{http_code}' https://safarizetu.com/health")
print(f"  /health: {result5}")

c.close()