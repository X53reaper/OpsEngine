import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=15)

# 1. Check current env
stdin, stdout, stderr = ssh.exec_command('grep -n "EMAIL_TEST" /opt/safarizetu-ops-engine/.env')
lines = stdout.read().decode().strip()
print("Current EMAIL_TEST lines:")
print(lines if lines else "  (none found)")

# 2. Remove EMAIL_TEST_MODE and EMAIL_TEST_OVERRIDE from .env
stdin, stdout, stderr = ssh.exec_command('sed -i "/EMAIL_TEST_MODE/d; /EMAIL_TEST_OVERRIDE/d" /opt/safarizetu-ops-engine/.env')
print("\nRemoved EMAIL_TEST_MODE and EMAIL_TEST_OVERRIDE from .env")

# 3. Verify removal
stdin, stdout, stderr = ssh.exec_command('grep "EMAIL_TEST" /opt/safarizetu-ops-engine/.env')
remaining = stdout.read().decode().strip()
print("Remaining EMAIL_TEST lines:", remaining if remaining else "  (none - clean)")

# 4. Hot-patch the compiled JS to remove test mode logic
# Read the current ai-agent.service.js
stdin, stdout, stderr = ssh.exec_command('cat /app/dist/services/ai-agent.service.js')
js_content = stdout.read().decode()

# Check if test mode logic is present
if 'EMAIL_TEST_MODE' in js_content:
    print("\nTest mode logic found in ai-agent.service.js - patching...")
    
    # We need to remove the test mode block. The logic is:
    # if (process.env.EMAIL_TEST_MODE === 'true') { ... route to test address ... }
    # We'll replace it with a no-op
    
    # Find and replace the test mode block
    import re
    
    # Pattern to match the test mode if block (multiple lines)
    # Looking for: if (process.env.EMAIL_TEST_MODE === "true") { ... }
    pattern = r'if\s*\(\s*process\.env\.EMAIL_TEST_MODE\s*===\s*["\']true["\']\s*\)\s*\{[^}]*\}'
    
    matches = list(re.finditer(pattern, js_content, re.DOTALL))
    print(f"Found {len(matches)} test mode block(s)")
    
    if matches:
        # Replace each match with empty string
        new_js = js_content
        for match in reversed(matches):  # reverse to preserve positions
            new_js = new_js[:match.start()] + new_js[match.end():]
        
        # Write to temp file locally then upload
        with open('D:\\Projects\\SafariZetu Automation\\tmp_patched_ai_agent.js', 'w') as f:
            f.write(new_js)
        print("Patched JS written locally")
    else:
        print("No test mode blocks found via regex - may need manual check")
else:
    print("\nNo EMAIL_TEST_MODE found in ai-agent.service.js - already clean")

# 5. Restart the container
stdin, stdout, stderr = ssh.exec_command('docker restart ops_engine')
restart_output = stdout.read().decode().strip()
restart_err = stderr.read().decode().strip()
print(f"\nContainer restart: {restart_output or restart_err or 'success'}")

# 6. Wait and verify container is healthy
import time
time.sleep(10)
stdin, stdout, stderr = ssh.exec_command('docker inspect --format="{{.State.Health.Status}}" ops_engine')
health = stdout.read().decode().strip()
print(f"Container health: {health}")

# 7. Check env is clean in running container
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine printenv | grep EMAIL_TEST')
env_check = stdout.read().decode().strip()
print(f"Running container EMAIL_TEST vars: {env_check if env_check else '(none - clean)'}")

ssh.close()
