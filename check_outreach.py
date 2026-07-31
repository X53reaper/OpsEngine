import paramiko
import time
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='ascii', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789')

# Check outreach_log in ops database
print("=" * 60)
print("OUTREACH_LOG in ops database:")
print("=" * 60)

cmd = "docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c \"SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'outreach_log' ORDER BY ordinal_position;\""
stdin, stdout, stderr = ssh.exec_command(cmd)
time.sleep(5)
print(stdout.read().decode('ascii', errors='replace'))

# Check if there are any rows
print("\nRows in outreach_log:")
cmd2 = "docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c \"SELECT COUNT(*) FROM outreach_log;\""
stdin2, stdout2, stderr2 = ssh.exec_command(cmd2)
time.sleep(5)
print(stdout2.read().decode('ascii', errors='replace'))

# Check the acknowledgeEnquiry function to understand the field mapping
print("\n" + "=" * 60)
print("WEBHOOK DATA vs CODE EXPECTATIONS:")
print("=" * 60)
print("Webhook sends: enquiry.email, enquiry.name")
print("Code expects: enquiry.tourist?.email, enquiry.tourist?.name")
print("")
print("The webhook data structure doesn't match what the code expects.")
print("The code wraps the data in a 'tourist' object that doesn't exist.")

ssh.close()
