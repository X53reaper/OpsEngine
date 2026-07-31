import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.18.50', username='root', password='123456789', timeout=10)

commands = [
    'cd /opt/safarizetu-ops-engine && ls -la n8n/workflows/',
    'cd /opt/safarizetu-ops-engine && cat src/scheduler/cron.ts',
    'cd /opt/safarizetu-ops-engine && cat src/scheduler/mailing-cron.ts',
    'cd /opt/safarizetu-ops-engine && cat src/webhook/receiver.ts',
    'cd /opt/safarizetu-ops-engine && cat src/index.ts | head -200',
    'cd /opt/safarizetu-ops-engine && cat src/services/ai-agent.service.ts | head -200',
    'cd /opt/safarizetu-ops-engine && cat database/migrations/*.sql 2>/dev/null | head -200',
]

with open('audit_output2.txt', 'w', encoding='utf-8') as f:
    for cmd in commands:
        stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
        out = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
        f.write(f'=== {cmd} ===\n')
        f.write(out)
        f.write(err)
        f.write('\n\n')

client.close()
print("Done - output written to audit_output2.txt")