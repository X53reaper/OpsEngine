import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789')

# List all tables in the ops database
cmd = "docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c \"SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;\""
stdin, stdout, stderr = ssh.exec_command(cmd)
time.sleep(3)
print("OPS DB TABLES:")
print(stdout.read().decode())
print(stderr.read().decode())
ssh.close()
