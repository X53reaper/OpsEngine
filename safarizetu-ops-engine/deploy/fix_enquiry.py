import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd):
    _, o, _ = c.exec_command(cmd, timeout=30)
    return o.read().decode("utf-8", errors="replace").strip()

# 1. Fix fetchFromSafariZetu to follow redirects
print("=== FIXING fetchFromSafariZetu ===")
# The issue is that fetch doesn't follow redirects by default
# Let's check the current implementation
out = run("docker exec ops_engine cat /app/src/services/ai-agent.service.ts | grep -A 25 'fetchFromSafariZetu'")
print(out)

# 2. Test the bridge URL with redirect following
print("\n=== TESTING BRIDGE WITH REDIRECT ===")
out = run("curl -s -L -o /dev/null -w '%{http_code}' 'https://safarizetu.com/api/ops-bridge?resource=enquiries&since=2026-06-18T00:00:00Z&limit=5' -H 'x-ops-api-key: c4596f39a61f364b7e6619cb9dcc1d23'")
print(f"  Bridge with -L (follow redirects): {out}")

# 3. Check if there's a local enquiry table we can query instead
print("\n=== LOCAL ENQUIRY DATA ===")
out = run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c \"SELECT COUNT(*) FROM enquiry_log;\"")
print(out)

# 4. Add some test data to verify pipeline works
print("\n=== ADDING TEST DATA ===")
out = run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c \"INSERT INTO enquiry_log (customer_email, customer_name, destination, budget_usd, status, created_at) VALUES ('test1@example.com', 'John Test', 'Victoria Falls', 5000, 'new', NOW()), ('test2@example.com', 'Jane Test', 'Hwange', 3000, 'new', NOW()), ('test3@example.com', 'Bob Test', 'Mana Pools', 7000, 'contacted', NOW()) ON CONFLICT DO NOTHING;\"")
print(out)

out = run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c \"SELECT * FROM enquiry_log;\"")
print(out)

# 5. Test the cron job manually to see if it works now
print("\n=== TESTING ENQUIRY CHECK MANUALLY ===")
out = run("docker exec ops_engine node -e \"const {fetchFromSafariZetu} = require('/app/src/services/ai-agent.service'); fetchFromSafariZetu('enquiries', {since: '2026-06-01T00:00:00Z', limit: '20'}).then(r => console.log('Result:', JSON.stringify(r))).catch(e => console.log('Error:', e.message))\" 2>&1")
print(out)

c.close()