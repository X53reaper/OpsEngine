import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.18.50', username='root', password='123456789', timeout=10)

commands = [
    'cd /opt/safarizetu-ops-engine && cat skills/competitors/* 2>/dev/null | head -200',
    'cd /opt/safarizetu-ops-engine && cat skills/copywriting/* 2>/dev/null | head -200',
    'cd /opt/safarizetu-ops-engine && cat skills/psychology/* 2>/dev/null | head -200',
    'cd /opt/safarizetu-ops-engine && cat skills/traveler-profiles/* 2>/dev/null | head -200',
    'cd /opt/safarizetu-ops-engine && cat skills/wildlife/* 2>/dev/null | head -200',
    'cd /opt/safarizetu-ops-engine && cat dashboard/src/App.tsx 2>/dev/null | head -100',
    'cd /opt/safarizetu-ops-engine && cat src/services/apollo.service.ts 2>/dev/null | head -150',
    'cd /opt/safarizetu-ops-engine && cat src/services/buffer.service.ts 2>/dev/null | head -150',
    'cd /opt/safarizetu-ops-engine && cat src/agents/prompts.ts 2>/dev/null | head -300',
    'cd /opt/safarizetu-ops-engine && cat src/agents/division4-feedback.ts 2>/dev/null | head -200',
]

with open('audit_output4.txt', 'w', encoding='utf-8') as f:
    for cmd in commands:
        stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
        out = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
        f.write(f'=== {cmd} ===\n')
        f.write(out)
        f.write(err)
        f.write('\n\n')

client.close()
print("Done - output written to audit_output4.txt")