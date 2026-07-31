import paramiko
import time

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd):
    _, o, e = c.exec_command(cmd, timeout=300)
    return o.read().decode("utf-8", errors="replace").strip()

# 1. Stop the current dashboard container
print("=== STOPPING DASHBOARD ===")
run("docker stop ops_dashboard")
run("docker rm ops_dashboard")

# 2. Create a new Dockerfile for production
print("\n=== CREATING PRODUCTION DOCKERFILE ===")
dockerfile = """FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

FROM node:20-alpine
RUN npm install -g serve
WORKDIR /app
COPY --from=build /app/build ./build
EXPOSE 3002
CMD ["serve", "-s", "build", "-l", "3002"]
"""
run(f"cat > /opt/safarizetu-ops-engine/dashboard/Dockerfile.prod << 'EOF'\n{dockerfile}\nEOF")
print("  Created Dockerfile.prod")

# 3. Build the new image
print("\n=== BUILDING PRODUCTION IMAGE ===")
out = run("cd /opt/safarizetu-ops-engine && docker build -t safarizetu-ops-dashboard:prod -f dashboard/Dockerfile.prod dashboard/ 2>&1 | tail -20")
print(out)

# 4. Run the new container
print("\n=== STARTING PRODUCTION CONTAINER ===")
out = run("""docker run -d \\
  --name ops_dashboard \\
  --restart unless-stopped \\
  -p 3002:3002 \\
  safarizetu-ops-dashboard:prod""")
print(f"  Container: {out}")

time.sleep(5)

# 5. Verify
print("\n=== VERIFY PRODUCTION ===")
out = run("docker ps | grep dashboard")
print(f"  Status: {out}")

out = run("curl -s http://localhost:3002/ | head -c 300")
print(f"  Response: {out}")

c.close()
