import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

# Find the actual project location
print("=== FINDING PROJECT FILES ===")
result = run("find / -name 'docker-compose.yml' -path '*safarizetu*' 2>/dev/null")
print(f"  docker-compose.yml: {result}")

result = run("find / -name 'Dockerfile*' -path '*safarizetu*' 2>/dev/null")
print(f"  Dockerfile: {result}")

# Check container mounts
print("\n=== CONTAINER MOUNTS ===")
result = run("docker inspect ops_engine --format '{{json .Mounts}}' 2>&1 | python3 -m json.tool 2>/dev/null || docker inspect ops_engine --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}'")
print(f"  {result}")

# Check the entrypoint/cmd
print("\n=== CONTAINER CMD ===")
result = run("docker inspect ops_engine --format 'Image: {{.Config.Image}} Cmd: {{.Config.Cmd}} Entrypoint: {{.Config.Entrypoint}}'")
print(f"  {result}")

# Check where the source code lives inside the container
print("\n=== SOURCE IN CONTAINER ===")
result = run("docker exec ops_engine ls -la /app/ 2>&1 | head -20")
print(f"  {result}")

result = run("docker exec ops_engine ls -la /app/dist/ 2>&1 | head -20")
print(f"  {result}")

c.close()