import paramiko
import time
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='ascii', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789')

# Copy updated source to server
print("1. Copying updated division1-growth.ts to server...")
sftp = ssh.open_sftp()
with open(r"D:\Projects\SafariZetu Automation\safarizetu-ops-engine\src\agents\division1-growth.ts", "r") as f:
    source = f.read()
with sftp.open('/tmp/division1-growth.ts', 'w') as f:
    f.write(source)
sftp.close()
time.sleep(2)

# Copy to container
print("2. Copying to container...")
cmd1 = "docker cp /tmp/division1-growth.ts ops_engine:/app/src/agents/division1-growth.ts"
stdin1, stdout1, stderr1 = ssh.exec_command(cmd1)
time.sleep(5)

# We need to compile this file. Since tsc has issues with types, let's use a different approach
# Copy the source file and compile it directly
print("3. Compiling TypeScript in container...")

# Create a simple compile script
compile_script = """
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync('/app/src/agents/division1-growth.ts', 'utf8');
const result = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
    resolveJsonModule: true,
    skipLibCheck: true
  }
});

fs.writeFileSync('/app/dist/agents/division1-growth.js', result.outputText);
console.log('Compiled division1-growth.js');
"""

sftp2 = ssh.open_sftp()
with sftp2.open('/tmp/compile.js', 'w') as f:
    f.write(compile_script)
sftp2.close()
time.sleep(2)

cmd2 = "docker cp /tmp/compile.js ops_engine:/tmp/compile.js"
stdin2, stdout2, stderr2 = ssh.exec_command(cmd2)
time.sleep(3)

cmd3 = "docker exec ops_engine node /tmp/compile.js"
stdin3, stdout3, stderr3 = ssh.exec_command(cmd3)
time.sleep(10)
print(stdout3.read().decode('ascii', errors='replace'))
err3 = stderr3.read().decode('ascii', errors='replace')
if err3.strip():
    print(f"ERR: {err3[:300]}")

# Verify the compiled JS has the fix
print("4. Verifying compiled JS...")
cmd4 = "docker exec ops_engine grep -c 'touristEmail' /app/dist/agents/division1-growth.js"
stdin4, stdout4, stderr4 = ssh.exec_command(cmd4)
time.sleep(5)
count = stdout4.read().decode('ascii', errors='replace').strip()
print(f"touristEmail references: {count}")

# Also need to recompile ai-agent.service.js with the test mode fix
print("5. Recompiling ai-agent.service.js...")
sftp3 = ssh.open_sftp()
with open(r"D:\Projects\SafariZetu Automation\safarizetu-ops-engine\src\services\ai-agent.service.ts", "r") as f:
    source2 = f.read()
with sftp3.open('/tmp/ai-agent.service.ts', 'w') as f:
    f.write(source2)
sftp3.close()
time.sleep(2)

cmd5 = "docker cp /tmp/ai-agent.service.ts ops_engine:/app/src/services/ai-agent.service.ts"
stdin5, stdout5, stderr5 = ssh.exec_command(cmd5)
time.sleep(3)

# Use the same transpile approach
compile_script2 = """
const ts = require('typescript');
const fs = require('fs');

const source = fs.readFileSync('/app/src/services/ai-agent.service.ts', 'utf8');
const result = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
    resolveJsonModule: true,
    skipLibCheck: true
  }
});

fs.writeFileSync('/app/dist/services/ai-agent.service.js', result.outputText);
console.log('Compiled ai-agent.service.js');
"""

sftp4 = ssh.open_sftp()
with sftp4.open('/tmp/compile2.js', 'w') as f:
    f.write(compile_script2)
sftp4.close()
time.sleep(2)

cmd6 = "docker cp /tmp/compile2.js ops_engine:/tmp/compile2.js"
stdin6, stdout6, stderr6 = ssh.exec_command(cmd6)
time.sleep(3)

cmd7 = "docker exec ops_engine node /tmp/compile2.js"
stdin7, stdout7, stderr7 = ssh.exec_command(cmd7)
time.sleep(10)
print(stdout7.read().decode('ascii', errors='replace'))

# Restart container
print("6. Restarting container...")
cmd8 = "docker restart ops_engine"
stdin8, stdout8, stderr8 = ssh.exec_command(cmd8)
time.sleep(15)

# Wait for health
cmd9 = "curl -s http://localhost:3000/health"
stdin9, stdout9, stderr9 = ssh.exec_command(cmd9)
time.sleep(5)
print(stdout9.read().decode('ascii', errors='replace'))

ssh.close()
