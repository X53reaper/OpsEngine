import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

_, o, _ = c.exec_command("curl -s -o /dev/null -w '%{http_code}' http://localhost:3002/")
print("Dashboard:", o.read().decode().strip())

_, o2, _ = c.exec_command("curl -s http://localhost:3000/health | head -c 200")
print("API:", o2.read().decode().strip())

_, o3, _ = c.exec_command("curl -s -o /dev/null -w '%{http_code}' https://dashboard.safarizetu.com")
print("Public dashboard:", o3.read().decode().strip())

c.close()
