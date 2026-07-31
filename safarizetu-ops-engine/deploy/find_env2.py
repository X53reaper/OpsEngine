#!/usr/bin/env python3
"""Find actual project dir name"""
import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.18.50', 22, 'root', '123456789')

# Get exact directory listing
stdin, stdout, stderr = client.exec_command('ls -1 /opt/ 2>&1')
dirs = [l.strip() for l in stdout if l.strip()]
print("Dirs in /opt/:")
for d in dirs:
    print(f"  [{d}]")

# Check the non-standard dir
for d in dirs:
    if 'safari' in d.lower():
        stdin, stdout, stderr = client.exec_command(f'ls -la /opt/{d}/ 2>&1')
        print(f"\n/opt/{d}/:")
        for line in stdout:
            print(" ", line.strip())
        stdin, stdout, stderr = client.exec_command(f'cat /opt/{d}/.env 2>&1 | head -3')
        print(f"\n.env:")
        for line in stdout:
            print(" ", line.strip())

client.close()
