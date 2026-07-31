import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.18.50', username='root', password='123456789', timeout=10)

commands = [
    'cd /opt/safarizetu-ops-engine && pwd && ls -la',
    'cd /opt/safarizetu-ops-engine && docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"',
    'cd /opt/safarizetu-ops-engine && cat infrastructure/docker-compose.yml',
    'cd /opt/safarizetu-ops-engine && cat infrastructure/.env 2>/dev/null | head -50',
]

for cmd in commands:
    stdin, stdout, stderr = client.exec_command(cmd, timeout=30)
    print(f'=== {cmd} ===')
    print(stdout.read().decode())
    print(stderr.read().decode())
    print()

client.close()