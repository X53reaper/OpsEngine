import paramiko
import json

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd):
    _, o, _ = c.exec_command(cmd, timeout=30)
    return o.read().decode("utf-8", errors="replace").strip()

# 1. Check all DB tables
print("=== ALL TABLES ===")
out = run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c '\\dt'")
print(out)

# 2. Check competitor_content table (was missing earlier)
print("\n=== COMPETITOR CONTENT TABLE ===")
out = run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c \"SELECT COUNT(*) FROM competitor_content;\" 2>&1")
print(out)

# 3. Check enquiry_log
print("\n=== ENQUIRY LOG ===")
out = run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c \"SELECT COUNT(*) FROM enquiry_log;\" 2>&1")
print(out)

# 4. Fix n8n workflow - reduce timeout and add error handling
n8n_key = run("cat /opt/safarizetu-ops-engine/.env | grep N8N_API_KEY | cut -d= -f2-")

# Get current workflow
print("\n=== UPDATING N8N WORKFLOW ===")
out = run(f'curl -s "http://localhost:5678/api/v1/workflows/3ORPVNZtQByEZp4K" -H "X-N8N-API-KEY: {n8n_key}"')
try:
    wf = json.loads(out)
    # Update the Scan Competitors node to have a shorter timeout
    for node in wf.get('nodes', []):
        if node.get('name') == 'Scan Competitors':
            node['parameters']['options'] = {'timeout': 60000}  # 60 seconds
            print(f"  Updated 'Scan Competitors' timeout to 60s")
        if node.get('name') == 'Get Landscape':
            node['parameters']['options'] = {'timeout': 30000}  # 30 seconds
            print(f"  Updated 'Get Landscape' timeout to 30s")
    
    # Update the workflow
    import subprocess
    wf_json = json.dumps(wf)
    result = subprocess.run(
        ["curl", "-s", "-X", "PUT", 
         f"http://localhost:5678/api/v1/workflows/3ORPVNZtQByEZp4K",
         "-H", f"X-N8N-API-KEY: {n8n_key}",
         "-H", "Content-Type: application/json",
         "-d", wf_json],
        capture_output=True, text=True, timeout=10
    )
    print(f"  Update result: {result.stdout[:200]}")
except Exception as ex:
    print(f"  Error: {ex}")

c.close()
