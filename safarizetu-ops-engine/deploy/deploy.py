#!/usr/bin/env python3
"""Deploy updated ops-engine code to 192.168.18.50 via SSH/SCP using paramiko"""

import io
import os
import tarfile
import paramiko
import time

HOST = "192.168.18.50"
PORT = 22
USER = "root"
PASSWORD = "123456789"

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REMOTE_DIR = "/opt/safarizetu-ops"
COMPOSE_FILE = os.path.join(PROJECT_DIR, "infrastructure", "docker-compose.yml")
REMOTE_COMPOSE = os.path.join(REMOTE_DIR, "infrastructure", "docker-compose.yml")


def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, PORT, USER, PASSWORD)
    print(f"Connected to {HOST}")

    # 1. Update docker-compose.yml
    sftp = client.open_sftp()
    sftp.put(COMPOSE_FILE, REMOTE_COMPOSE)
    print("docker-compose.yml updated")

    # 2. Install langfuse package in running container
    _, stdout, stderr = client.exec_command(
        "docker exec ops_engine npm install langfuse --no-save 2>&1"
    )
    exit_status = stdout.channel.recv_exit_status()
    output = stdout.read().decode()
    error = stderr.read().decode()
    if exit_status != 0:
        print(f"npm install warning (exit {exit_status}): {error[-300:]}")
    else:
        print(f"langfuse installed in container: {output[-200:]}")

    # 3. Create tar of dist/ and copy into container
    dist_dir = os.path.join(PROJECT_DIR, "dist")
    if not os.path.isdir(dist_dir):
        print("ERROR: dist/ not found. Run 'npm run build' first.")
        client.close()
        return

    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        tar.add(dist_dir, arcname="dist")
    buf.seek(0)

    # Upload tar to remote
    remote_tar = "/tmp/ops-dist.tar.gz"
    sftp.putfo(buf, remote_tar)
    print(f"dist/ uploaded ({buf.tell()} bytes)")

    # Extract into container
    _, stdout, stderr = client.exec_command(
        "docker cp /tmp/ops-dist.tar.gz ops_engine:/tmp/ && "
        "docker exec ops_engine tar xzf /tmp/ops-dist.tar.gz -C /app && "
        "docker exec ops_engine rm /tmp/ops-dist.tar.gz && "
        "rm /tmp/ops-dist.tar.gz 2>&1"
    )
    exit_status = stdout.channel.recv_exit_status()
    output = stdout.read().decode()
    error = stderr.read().decode()
    if exit_status != 0:
        print(f"tar extract error: {error[-300:]}")
        client.close()
        return
    print("dist/ extracted into container")

    # 4. Restart the container
    _, stdout, stderr = client.exec_command("docker restart ops_engine 2>&1")
    exit_status = stdout.channel.recv_exit_status()
    output = stdout.read().decode()
    error = stderr.read().decode()
    if exit_status != 0:
        print(f"restart error: {error}")
        client.close()
        return
    print(f"Container restarted: {output.strip()}")

    # 5. Wait for health check
    time.sleep(3)
    _, stdout, stderr = client.exec_command(
        "docker inspect ops_engine --format='{{.State.Health.Status}}' 2>&1"
    )
    health = stdout.read().decode().strip()
    print(f"Health status: {health}")

    # 6. Test langfuse initialization
    _, stdout, stderr = client.exec_command(
        "docker logs ops_engine --tail 20 2>&1 | grep -i langfuse || echo '(no langfuse log lines)'"
    )
    logs = stdout.read().decode('utf-8', errors='replace').strip()
    print(f"Langfuse logs: {logs[:500]}")

    sftp.close()
    client.close()
    print("Deployment complete")


if __name__ == "__main__":
    main()
