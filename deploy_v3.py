import paramiko
import time
import os

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=15)

# Check what compiled email-templates.js looks like
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine head -50 /app/dist/services/email-templates.js')
print("Current compiled email-templates.js:")
print(stdout.read().decode())

# Check if there's a typescript module in node_modules
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine ls /app/node_modules/typescript/lib/typescript.js 2>&1')
print("\nTypeScript module:", stdout.read().decode().strip())

# Install typescript in the container
print("\nInstalling typescript...")
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine sh -c "cd /app && npm install typescript 2>&1 | tail -5"')
print(stdout.read().decode())

# Now try transpiling
print("\nTranspiling...")
transpile_script = '''
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

function transpileDir(srcDir, outDir) {
    if (!fs.existsSync(srcDir)) { console.log('Skip:', srcDir); return; }
    fs.mkdirSync(outDir, { recursive: true });
    
    for (const file of fs.readdirSync(srcDir)) {
        if (!file.endsWith('.ts')) continue;
        const src = path.join(srcDir, file);
        const dst = path.join(outDir, file.replace('.ts', '.js'));
        const content = fs.readFileSync(src, 'utf8');
        const result = ts.transpileModule(content, {
            compilerOptions: { 
                module: ts.ModuleKind.CommonJS, 
                target: ts.ScriptTarget.ES2020,
                esModuleInterop: true
            }
        });
        fs.writeFileSync(dst, result.outputText);
        console.log('OK:', path.relative('/app/src', src));
    }
}

transpileDir('/app/src/services', '/app/dist/services');
transpileDir('/app/src/services/email-templates', '/app/dist/services/email-templates');
console.log('Done!');
'''

sftp = ssh.open_sftp()
sftp.put(r'D:\Projects\SafariZetu Automation\transpile_templates.js', '/tmp/transpile3.js')
sftp.close()

stdin, stdout, stderr = ssh.exec_command('docker cp /tmp/transpile3.js ops_engine:/tmp/transpile3.js')
time.sleep(2)

stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine node /tmp/transpile3.js 2>&1')
print(stdout.read().decode())
err = stderr.read().decode().strip()
if err:
    print(f"Errors: {err[:300]}")

# Verify
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine ls /app/dist/services/email-templates/ 2>&1')
print("\nCompiled templates:", stdout.read().decode())

# Restart
print("\nRestarting...")
stdin, stdout, stderr = ssh.exec_command('docker restart ops_engine')
time.sleep(15)

stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
print("Health:", stdout.read().decode().strip())

ssh.close()
