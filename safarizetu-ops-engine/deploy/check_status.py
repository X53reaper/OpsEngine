import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd):
    _, o, _ = c.exec_command(cmd, timeout=30)
    return o.read().decode("utf-8", errors="replace").strip()

print("=== CONTAINERS ===")
print(run("docker ps --format '{{.Names}} {{.Status}}'"))

print("\n=== ENQUIRY LOG TEST DATA ===")
print(run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c 'SELECT safari_zetu_enquiry_id, tourist_name, tourist_email, destination, status FROM enquiry_log;'"))

print("\n=== RECENT LOGS ===")
print(run("docker logs ops_engine --since 5m 2>&1 | tail -20"))

c.close()