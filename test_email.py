import paramiko
import time
import json
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='ascii', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789')

# Test 1: Send enquiry webhook to ops engine
print("=" * 60)
print("TEST 1: Send enquiry webhook to ops engine")
print("=" * 60)

webhook_data = json.dumps({
    "event": "enquiry.created",
    "data": {
        "id": "test-email-001",
        "name": "Simon Mvhuni",
        "email": "simonmvhuni@gmail.com",
        "listing_id": "list-001",
        "listing_name": "The Hide Safari Camp - Main Camp",
        "destination": "Hwange",
        "message": "I would like to book a 3-night safari at The Hide for 2 guests in October. What is the availability and total cost?",
        "reference": "TEST-EMAIL-001",
        "guests": 2,
        "travel_dates": "October 15-18, 2026"
    }
})

# Send webhook (no signature for test)
cmd = f"""curl -s -X POST http://localhost:3000/webhook/safari-zetu \
  -H 'Content-Type: application/json' \
  -d '{webhook_data}' 2>&1"""

stdin, stdout, stderr = ssh.exec_command(cmd)
time.sleep(10)
out = stdout.read().decode('ascii', errors='replace')
err = stderr.read().decode('ascii', errors='replace')
print(f"Webhook Response: {out[:500]}")
if err:
    print(f"Error: {err[:200]}")

# Wait for async processing
print("\nWaiting 15s for async email processing...")
time.sleep(15)

# Check agent_run_log for the test
print("\n" + "=" * 60)
print("TEST 2: Check agent_run_log for email activity")
print("=" * 60)

sftp = ssh.open_sftp()
with sftp.open('/root/check_email_log.sql', 'w') as f:
    f.write("""SELECT id, agent_name, status, result_summary, cost_usd, created_at, completed_at 
FROM agent_run_log 
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC 
LIMIT 5;""")
sftp.close()
time.sleep(2)

cmd2 = 'docker run --rm -v /root/check_email_log.sql:/tmp/q.sql:ro postgres:16 psql "postgresql://postgres:yaIcpiFUcjqGMBxVdtcVMKRNRXxAxjWK@yamanote.proxy.rlwy.net:44936/railway?sslmode=require" -f /tmp/q.sql'
stdin2, stdout2, stderr2 = ssh.exec_command(cmd2)
time.sleep(10)
print(stdout2.read().decode('ascii', errors='replace'))

# Check enquiry_log
print("=" * 60)
print("TEST 3: Check enquiry_log for test enquiry")
print("=" * 60)

sftp2 = ssh.open_sftp()
with sftp2.open('/root/check_enquiry.sql', 'w') as f:
    f.write("""SELECT id, reference, customer_name, customer_email, status, acknowledgement_sent_at, created_at 
FROM "Enquiry" 
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC 
LIMIT 5;""")
sftp2.close()
time.sleep(2)

cmd3 = 'docker run --rm -v /root/check_enquiry.sql:/tmp/q.sql:ro postgres:16 psql "postgresql://postgres:yaIcpiFUcjqGMBxVdtcVMKRNRXxAxjWK@yamanote.proxy.rlwy.net:44936/railway?sslmode=require" -f /tmp/q.sql'
stdin3, stdout3, stderr3 = ssh.exec_command(cmd3)
time.sleep(10)
print(stdout3.read().decode('ascii', errors='replace'))

# Check ops engine logs for email sending
print("=" * 60)
print("TEST 4: Check ops engine container logs for email")
print("=" * 60)

cmd4 = "docker logs ops_engine --tail 30 2>&1 | grep -i -E 'email|resend|simon|sendgrid|acknowledge'"
stdin4, stdout4, stderr4 = ssh.exec_command(cmd4)
time.sleep(8)
print(stdout4.read().decode('ascii', errors='replace'))

ssh.close()
