import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=15):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

# Check container mounts
print("=== CONTAINER MOUNTS ===")
result = run("docker inspect ops_engine --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}'")
print(result)

# Check container working dir
print("\n=== CONTAINER WORKDIR ===")
result = run("docker inspect ops_engine --format '{{.Config.WorkingDir}}'")
print(result)

# Check source in container
print("\n=== /app structure ===")
result = run("docker exec ops_engine ls /app/")
print(result)

# Check /app/src
print("\n=== /app/src ===")
result = run("docker exec ops_engine ls /app/src/services/ 2>&1 | head -20")
print(result)

# Check if apollo.service.ts is in the built JS
print("\n=== APOLLO IN COMPILED JS ===")
result = run("docker exec ops_engine grep -n 'X-Api-Key\\|api_key' /app/dist/services/apollo.service.js 2>&1 | head -10")
print(result)

# Check the actual compose file location
print("\n=== COMPOSE FILE ===")
result = run("docker inspect ops_engine --format '{{index .Config.Labels \"com.docker.compose.project.working_dir\"}}'")
print(f"  Working dir: {result}")
result = run("docker inspect ops_engine --format '{{index .Config.Labels \"com.docker.compose.project.config_files\"}}'")
print(f"  Config files: {result}")

c.close()