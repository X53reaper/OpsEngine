import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

# Find Dockerfile
print("=== FIND DOCKERFILE ===")
result = run("find /opt/safarizetu-ops-engine -name 'Dockerfile*' -o -name 'dockerfile*' 2>/dev/null")
print(result)

# Check the directory structure
print("\n=== PROJECT STRUCTURE ===")
result = run("ls -la /opt/safarizetu-ops-engine/")
print(result)

print("\n=== INFRASTRUCTURE DIR ===")
result = run("ls -la /opt/safarizetu-ops-engine/infrastructure/")
print(result)

# Check what image the container uses
print("\n=== CONTAINER IMAGE ===")
result = run("docker inspect ops_engine --format '{{.Image}}'")
print(result)

# Build from infrastructure with correct path
print("\n=== TRY BUILD FROM INFRASTRUCTURE ===")
result = run("cd /opt/safarizetu-ops-engine/infrastructure && ls -la Dockerfile* 2>&1")
print(result)

c.close()