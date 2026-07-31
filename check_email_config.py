import paramiko
import time
import sys
import io

# Fix encoding for Windows console
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='ascii', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='ascii', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789')

# Check ops engine email config
commands = [
    ("Email Config", "grep -E 'RESEND|EMAIL|FROM' /opt/safarizetu-ops-engine/.env"),
    ("Health", "curl -s http://localhost:3000/health"),
    ("Email Preview", "curl -s -X POST http://localhost:3000/api/emails/preview -H 'Content-Type: application/json' -d '{\"template\":\"enquiry-acknowledgement\",\"data\":{\"touristName\":\"Test User\",\"touristEmail\":\"simonmvhuni@gmail.com\",\"listingName\":\"The Hide Safari Camp\",\"destination\":\"Hwange\",\"message\":\"I would like to book a safari\",\"reference\":\"TEST-001\"}}' 2>&1 | head -c 500"),
]

for label, cmd in commands:
    stdin, stdout, stderr = ssh.exec_command(cmd)
    time.sleep(5)
    out = stdout.read().decode('ascii', errors='replace')
    err = stderr.read().decode('ascii', errors='replace')
    print(f"[{label}]")
    if out.strip():
        print(f"  {out[:500]}")
    if err.strip():
        print(f"  ERR: {err[:200]}")
    print()

ssh.close()
