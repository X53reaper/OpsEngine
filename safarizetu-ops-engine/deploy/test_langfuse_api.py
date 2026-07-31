#!/usr/bin/env python3
"""Check if Langfuse server received traces from the SDK"""
import paramiko, json, base64

HOST = "192.168.18.50"
USER = "root"
PASS = "123456789"
PK = "pk-lf-44cc98a4-9399-424e-9c94-21a624f3b652"
SK = "sk-lf-6d29feee-5b51-441a-8f83-5e516814e42b"
auth = base64.b64encode(f"{PK}:{SK}".encode()).decode()

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, 22, USER, PASS)

# Query Langfuse traces API (v2 endpoint)
cmd = (
    f'curl -s "http://localhost:3001/api/public/traces?page=1&limit=10"'
    f' -H "Authorization: Basic {auth}" 2>&1'
)
stdin, stdout, stderr = client.exec_command(cmd)
result = stdout.read().decode('utf-8', errors='replace')[:2000]
print("Langfuse traces API response:")
print(result)
print()

# Try observations too
cmd2 = (
    f'curl -s "http://localhost:3001/api/public/observations?page=1&limit=10"'
    f' -H "Authorization: Basic {auth}" 2>&1'
)
stdin, stdout, stderr = client.exec_command(cmd2)
result2 = stdout.read().decode('utf-8', errors='replace')[:2000]
print("Langfuse observations API response:")
print(result2)

client.close()
