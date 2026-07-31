import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

# Check agent_run_log for the successful run
print("=== AGENT RUN LOG (by entity_id) ===")
result = run("""docker exec ops_engine psql -U ops_admin -d safarizetu_ops -c "
SELECT agent_name, trigger_type, status, cost_usd, model_used, started_at, completed_at 
FROM agent_run_log 
WHERE trigger_payload->>'enquiry_id' = '148485a0-4499-4f27-9a5d-0ed759a80c95'
ORDER BY started_at DESC LIMIT 5;
" 2>&1""")
print(f"  {result}")

# Check all completed runs
print("\n=== COMPLETED RUNS ===")
result = run("""docker exec ops_engine psql -U ops_admin -d safarizetu_ops -c "
SELECT agent_name, trigger_type, status, cost_usd, model_used, started_at, completed_at 
FROM agent_run_log 
WHERE completed_at IS NOT NULL 
ORDER BY completed_at DESC LIMIT 10;
" 2>&1""")
print(f"  {result}")

# Check all runs
print("\n=== ALL RECENT RUNS ===")
result = run("""docker exec ops_engine psql -U ops_admin -d safarizetu_ops -c "
SELECT agent_name, trigger_type, status, cost_usd, model_used, started_at, completed_at 
FROM agent_run_log 
ORDER BY started_at DESC LIMIT 10;
" 2>&1""")
print(f"  {result}")

c.close()