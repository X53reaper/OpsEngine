import paramiko
import json

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

print("=== TEST APOLLO WITH DIFFERENT QUERIES ===")

# Test 1: Search people with broader query
print("\n--- TEST 1: Search people (travel) ---")
result = run("""docker exec ops_engine node -e "
const key=process.env.APOLLO_API_KEY;
fetch('https://api.apollo.io/v1/mixed_people/search',{method:'POST',headers:{'Content-Type':'application/json','X-Api-Key':key},body:JSON.stringify({person_titles:['ceo','founder'],page:1,per_page:3})}).then(r=>r.json()).then(d=>{console.log('Status:',d.pagination?d.pagination.total_entries:'no pagination');console.log('People:',d.people?.map(p=>({name:p.name,title:p.title,email:p.email,org:p.organization?.name})));process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)})
" 2>&1""")
print(f"  {result}")

# Test 2: Search organizations
print("\n--- TEST 2: Search organizations ---")
result = run("""docker exec ops_engine node -e "
const key=process.env.APOLLO_API_KEY;
fetch('https://api.apollo.io/v1/mixed_companies/search',{method:'POST',headers:{'Content-Type':'application/json','X-Api-Key':key},body:JSON.stringify({q_organization_keyword_tags:['travel','tourism'],page:1,per_page:3})}).then(r=>r.json()).then(d=>{console.log('Status:',d.pagination?d.pagination.total_entries:'no pagination');console.log('Orgs:',d.organizations?.map(o=>({name:o.name,website:o.website_url,industry:o.industry})));process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)})
" 2>&1""")
print(f"  {result}")

# Test 3: Check if Apollo API key is configured
print("\n--- TEST 3: Apollo config status ---")
result = run("""docker exec ops_engine node -e "
const key=process.env.APOLLO_API_KEY;
console.log('Key present:', !!key);
console.log('Key length:', key?.length);
console.log('Key prefix:', key?.substring(0,10));
" 2>&1""")
print(f"  {result}")

# Test 4: Match person (most likely to return results)
print("\n--- TEST 4: Match person (by email) ---")
result = run("""docker exec ops_engine node -e "
const key=process.env.APOLLO_API_KEY;
fetch('https://api.apollo.io/v1/people/match',{method:'POST',headers:{'Content-Type':'application/json','X-Api-Key':key},body:JSON.stringify({email:'tim@apple.com'})}).then(r=>r.json()).then(d=>{console.log('Person:',d.person?{name:d.person.name,title:d.person.title,email:d.person.email,company:d.person.organization?.name}:'not found');process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)})
" 2>&1""")
print(f"  {result}")

# Test 5: Direct curl to see raw response
print("\n--- TEST 5: Raw Apollo response ---")
result = run("""docker exec ops_engine sh -c "
curl -s -X POST 'https://api.apollo.io/v1/people/match' \
  -H 'Content-Type: application/json' \
  -H 'X-Api-Key: '\$APOLLO_API_KEY \
  -d '{\"email\":\"tim@apple.com\"}' | head -c 500
" 2>&1""")
print(f"  {result}")

c.close()