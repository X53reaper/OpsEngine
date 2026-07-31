import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=15)

# Read the current compiled email-templates.js
stdin, stdout, stderr = ssh.exec_command('docker exec ops_engine cat /app/dist/services/email-templates.js')
current_js = stdout.read().decode()
print(f"Current email-templates.js: {len(current_js)} bytes")

# If it's empty or doesn't exist, we need to create it from the TypeScript source
if len(current_js) < 100:
    print("Current JS is empty/minimal - creating from source")
    
    # Read the TypeScript source
    with open(r'D:\Projects\SafariZetu Automation\safarizetu-ops-engine\src\services\email-templates.ts', 'r', encoding='utf-8') as f:
        ts_source = f.read()
    
    # Manually convert TypeScript to JavaScript
    js_content = ts_source
    
    # Remove type annotations (simple approach)
    import re
    
    # Remove 'export type' lines
    js_content = re.sub(r'export type \w+ = [^;]+;', '', js_content)
    
    # Remove 'export interface' blocks
    js_content = re.sub(r'export interface \w+ \{[^}]+\}', '', js_content, flags=re.DOTALL)
    
    # Remove type annotations from function parameters
    js_content = re.sub(r':\s*(string|number|boolean|EmailPalette|EmailColors|Record<[^>]+>)[^,)]', '', js_content)
    
    # Remove ': string' etc from variable declarations
    js_content = re.sub(r':\s*(string|number|boolean)\s*=', '=', js_content)
    
    # Clean up remaining type syntax
    js_content = js_content.replace(': EmailPalette', '')
    js_content = js_content.replace(': EmailColors', '')
    js_content = js_content.replace(': string', '')
    js_content = js_content.replace(': number', '')
    
    print(f"Converted JS: {len(js_content)} bytes")
    
    # Write to temp file
    with open(r'D:\Projects\SafariZetu Automation\email-templates-compiled.js', 'w', encoding='utf-8') as f:
        f.write(js_content)
else:
    print("Current JS has content - will update with new design")

ssh.close()
