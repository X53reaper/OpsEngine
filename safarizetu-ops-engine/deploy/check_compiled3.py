import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

# Check compiled cron.js - write to file
_, o, _ = c.exec_command("docker exec ops_engine cat /app/dist/scheduler/cron.js | grep -A 15 'Check new enquiries'")
with open("cron_check.txt", "wb") as f:
    f.write(o.read())

c.close()
print("Done - check cron_check.txt")