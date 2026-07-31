import paramiko
import time

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, e = c.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", errors="replace").strip()
    err = e.read().decode("utf-8", errors="replace").strip()
    return out + "\n" + err if err else out

# Find the Dockerfile
print("=== FINDING DOCKERFILE ===")
result = run("ls -la /opt/safarizetu-ops-engine/Dockerfile* /opt/safarizetu-ops-engine/docker* 2>&1")
print(result)

# Check how the container was built
print("\n=== CONTAINER IMAGE INFO ===")
result = run("docker inspect ops_engine --format '{{.Config.Image}}' 2>&1")
print(f"  Image: {result}")

# Check docker-compose.yml
print("\n=== DOCKER-COMPOSE.YML ===")
result = run("cat /opt/safarizetu-ops-engine/docker-compose.yml 2>&1 | head -40")
print(result)

c.close()