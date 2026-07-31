#!/usr/bin/env python3
"""Find .env file on remote server"""
import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('192.168.18.50', 22, 'root', '123456789')

# Find .env files
stdin, stdout, stderr = client.exec_command('find /opt/safarizetu-ops -name ".env" -o -name "*.env" 2>/dev/null')
print("ENV files found:")
for line in stdout:
    print(" ", line.strip())

# Check for .env in infrastructure/
stdin, stdout, stderr = client.exec_command('ls -la /opt/safarizetu-ops/infrastructure/ 2>&1')
print("\nInfrastructure dir:")
for line in stdout:
    print(" ", line.strip())

# Check docker-compose dir structure
stdin, stdout, stderr = client.exec_command('ls -la /opt/safarizetu-ops/ 2>&1')
print("\nProject root:")
for line in stdout:
    print(" ", line.strip())

client.close()
