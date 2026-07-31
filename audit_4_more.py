import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.18.50', username='root', password='123456789', timeout=10)

commands = [
    'cd /opt/safarizetu-ops-engine && cat database/migrations/*.sql 2>/dev/null | tail -n +200 | head -300',
    'cd /opt/safarizetu-ops-engine && cat src/services/observability.service.ts | head -150',
    'cd /opt/safarizetu-ops-engine && cat src/services/chroma.service.ts | head -150',
    'cd /opt/safarizetu-ops-engine && cat src/agents/division1-growth.ts | head -200',
    'cd /opt/safarizetu-ops-engine && cat src/agents/sales-prospector.ts | head -200',
    'cd /opt/safarizetu-ops-engine && cat src/pipeline/marketing-pipeline.service.ts | head -200',
    'cd /opt/safarizetu-ops-engine && cat src/pipeline/feedback-pipeline.ts 2>/dev/null | head -150',
    'cd /opt/safarizetu-ops-engine && ls -la src/pipeline/',
    'cd /opt/safarizetu-ops-engine && ls -la skills/competitors/',
    'cd /opt/safarizetu-ops-engine && ls -la skills/copywriting/',
    'cd /opt/safarizetu-ops-engine && ls -la skills/psychology/',
    'cd /opt/safarizetu-ops-engine && ls -la skills/traveler-profiles/',
    'cd /opt/safarizetu-ops-engine && ls -la skills/wildlife/',
]

with open('audit_output3.txt', 'w', encoding='utf-8') as f:
    for cmd in commands:
        stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
        out = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
        f.write(f'=== {cmd} ===\n')
        f.write(out)
        f.write(err)
        f.write('\n\n')

client.close()
print("Done - output written to audit_output3.txt")