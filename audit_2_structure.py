import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.18.50', username='root', password='123456789', timeout=10)

commands = [
    'cd /opt/safarizetu-ops-engine && cat infrastructure/docker-compose.yml',
    'cd /opt/safarizetu-ops-engine && cat infrastructure/.env 2>/dev/null | head -80',
    'cd /opt/safarizetu-ops-engine && ls -la src/',
    'cd /opt/safarizetu-ops-engine && ls -la src/services/',
    'cd /opt/safarizetu-ops-engine && ls -la src/agents/',
    'cd /opt/safarizetu-ops-engine && ls -la src/scheduler/',
    'cd /opt/safarizetu-ops-engine && ls -la n8n/',
    'cd /opt/safarizetu-ops-engine && ls -la skills/',
]

with open('audit_output.txt', 'w', encoding='utf-8') as f:
    for cmd in commands:
        stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
        out = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
        f.write(f'=== {cmd} ===\n')
        f.write(out)
        f.write(err)
        f.write('\n\n')

client.close()
print("Done - output written to audit_output.txt")