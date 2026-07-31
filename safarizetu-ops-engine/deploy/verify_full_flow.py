import paramiko
import time

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

# Check enquiry_log
print("=== ENQUIRY LOG (RECENT) ===")
result = run("""docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c "
SELECT id, safari_zetu_enquiry_id, tourist_name, status, acknowledgement_sent_at 
FROM enquiry_log 
ORDER BY created_at DESC LIMIT 5;
" 2>&1""")
print(f"  {result}")

# Check outreach_log
print("\n=== OUTREACH LOG (RECENT) ===")
result = run("""docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c "
SELECT entity_type, entity_id, email_to, email_subject, resend_message_id, status, agent_name, sent_at 
FROM outreach_log 
ORDER BY sent_at DESC LIMIT 5;
" 2>&1""")
print(f"  {result}")

# Check ops engine logs
print("\n=== OPS ENGINE LOGS (RECENT) ===")
result = run("docker logs ops_engine --tail 50 2>&1 | grep -i 'enquiry\\|agent\\|acknowledge\\|resend\\|email' | tail -20")
print(f"  {result}")

# Check all agent runs
print("\n=== ALL AGENT RUNS ===")
result = run("""docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c "
SELECT agent_name, trigger_type, status, cost_usd, model_used, started_at, completed_at 
FROM agent_run_log 
ORDER BY started_at DESC LIMIT 15;
" 2>&1""")
print(f"  {result}")

c.close()