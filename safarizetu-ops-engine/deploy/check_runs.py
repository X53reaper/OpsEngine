#!/usr/bin/env python3
import paramiko
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.18.50', 22, 'root', '123456789')

# Check agent runs from postgres container
stdin, stdout, stderr = client.exec_command(
    'docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c '
    '"SELECT agent_name, trigger_type, status, cost_usd, created_at '
    'FROM agent_run_log ORDER BY created_at DESC LIMIT 15;" 2>&1'
)
print("=== Recent agent runs (from DB) ===")
print(stdout.read().decode()[:1500])

# Check recent ops-engine logs for any agent activity
stdin, stdout, stderr = client.exec_command(
    'docker logs ops_engine --tail 200 2>&1 | grep -i "completed\\|error\\|running\\|started" | tail -20'
)
print("\n=== Agent completions ===")
for line in stdout.read().decode().splitlines():
    if line.strip():
        print(" ", line.strip()[:140])

# Check observability metrics
stdin, stdout, stderr = client.exec_command('curl -s http://localhost:3000/metrics')
print("\n=== Metrics ===")
print(stdout.read().decode().strip()[:500])

# Check Langfuse traces
stdin, stdout, stderr = client.exec_command(
    'docker exec ops_engine curl -s "http://langfuse:3000/api/public/traces?page=1&limit=5" '
    '-H "Authorization: Basic $(echo -n pk-lf-44cc98a4-9399-424e-9c94-21a624f3b652:sk-lf-6d29feee-5b51-441a-8f83-5e516814e42b | base64)" 2>&1'
)
print("\n=== Langfuse traces ===")
result = stdout.read().decode().strip()[:500]
print(result)

client.close()
