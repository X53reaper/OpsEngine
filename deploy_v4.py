import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=15)

# Run transpile from /app directory so it can find typescript module
print("Transpiling from /app directory...")
stdin, stdout, stderr = ssh.exec_command('''docker exec ops_engine sh -c "cd /app && node -e \"
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

function transpileDir(srcDir, outDir) {
    if (!fs.existsSync(srcDir)) return;
    fs.mkdirSync(outDir, { recursive: true });
    for (const file of fs.readdirSync(srcDir)) {
        if (!file.endsWith('.ts')) continue;
        const src = path.join(srcDir, file);
        const dst = path.join(outDir, file.replace('.ts', '.js'));
        const content = fs.readFileSync(src, 'utf8');
        const result = ts.transpileModule(content, {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
        });
        fs.writeFileSync(dst, result.outputText);
        console.log('OK:', file);
    }
}
transpileDir('/app/src/services', '/app/dist/services');
transpileDir('/app/src/services/email-templates', '/app/dist/services/email-templates');
console.log('Done!');
\"" 2>&1''')
output = stdout.read().decode().strip()
err = stderr.read().decode().strip()
print(output)
if err:
    print(f"Errors: {err[:500]}")

# Verify
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine ls /app/dist/services/email-templates/ 2>&1')
print("\nCompiled templates:", stdout.read().decode())

# Check the first few lines of the compiled file
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine head -20 /app/dist/services/email-templates.js')
print("\nemail-templates.js head:")
print(stdout.read().decode())

# Restart
print("Restarting...")
stdin, stdout, stderr = ssh.exec_command('docker restart ops_engine')
time.sleep(15)

stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
print("Health:", stdout.read().decode().strip())

ssh.close()
