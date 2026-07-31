#!/usr/bin/env python3
"""Check cron scheduler status and recent job runs"""
import paramiko
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.18.50', 22, 'root', '123456789')

# Check scheduler logs
stdin, stdout, stderr = client.exec_command(
    'docker logs ops_engine --tail 100 2>&1 | grep -i "cron\\|schedule\\|agent.*completed\\|run\\|interval" | tail -30'
)
print("=== Scheduler activity ===")
for line in stdout.read().decode().splitlines():
    if line.strip():
        print(" ", line.strip()[:140])

# Check agent run log in database
stdin, stdout, stderr = client.exec_command(
    'docker exec ops_engine psql -U ops_admin -d safarizetu_ops -c '
    '"SELECT agent_name, trigger_type, status, cost_usd, created_at '
    'FROM agent_run_log ORDER BY created_at DESC LIMIT 10;" 2>&1'
)
print("\n=== Recent agent runs ===")
print(stdout.read().decode()[:1000])

# Check observability metrics
stdin, stdout, stderr = client.exec_command('curl -s http://localhost:3000/metrics')
print("\n=== Metrics ===")
print(stdout.read().decode().strip()[:500])

client.close()
