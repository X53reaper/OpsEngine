import paramiko
import time

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd):
    _, o, _ = c.exec_command(cmd, timeout=30)
    return o.read().decode("utf-8", errors="replace").strip()

print("Waiting 6 minutes for cron tick...")
time.sleep(360)

print("\n=== ENQUIRY CHECK LOGS ===")
print(run("docker logs ops_engine --since 10m 2>&1 | grep -i enquiry | tail -10"))

print("\n=== ALL RECENT LOGS ===")
print(run("docker logs ops_engine --since 10m 2>&1 | tail -15"))

print("\n=== ENQUIRY DATA ===")
print(run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c 'SELECT safari_zetu_enquiry_id, tourist_name, destination, status FROM enquiry_log;'"))

print("\n=== HEALTH ===")
print(run("curl -s http://localhost:3000/health"))

c.close()
