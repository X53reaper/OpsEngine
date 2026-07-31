#!/usr/bin/env python3
"""Trigger an LLM call on the remote server and check Langfuse for traces"""
import paramiko, json, time

HOST = "192.168.18.50"
USER = "root"
PASS = "123456789"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, 22, USER, PASS)

# 1. Trigger LLM research call
print("--- Triggering LLM research call ---")
stdin, stdout, stderr = client.exec_command(
    'curl -s -X POST http://localhost:3000/api/research'
    ' -H "Content-Type: application/json"'
    ' -d \'{"topic": "Why tourists choose Kenya for safaris"}\' 2>&1'
)
result = stdout.read().decode('utf-8', errors='replace')[:1000]
print("Research response:", result)
print()

# 2. Check Langfuse UI
print("--- Langfuse trace count ---")
stdin, stdout, stderr = client.exec_command(
    'curl -s http://localhost:3001/api/public/observations'
    ' -H "Authorization: Bearer sk-lf-6d29feee-5b51-441a-8f83-5e516814e42b" 2>&1'
)
lf = stdout.read().decode('utf-8', errors='replace')[:500]
print("Langfuse observations:", lf)
print()

# 3. Check ops-engine metrics endpoint
print("--- Ops Engine Metrics ---")
stdin, stdout, stderr = client.exec_command('curl -s http://localhost:3000/metrics 2>&1')
metrics = stdout.read().decode('utf-8', errors='replace')
print("Metrics:", metrics)
print()

# 4. Check ops-engine logs for trace entries
print("--- Recent logs with traces ---")
stdin, stdout, stderr = client.exec_command(
    'docker logs ops_engine --tail 50 2>&1 | grep -i "trace\|langfuse\|research\|cost" || echo "(no matching lines)"'
)
logs = stdout.read().decode('utf-8', errors='replace')
print(logs[:1000])

client.close()
