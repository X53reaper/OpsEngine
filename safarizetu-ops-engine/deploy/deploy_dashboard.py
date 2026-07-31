"""Deploy dashboard: upload source, build inside Docker container, restart."""
import paramiko
import os
import sys

HOST = "192.168.18.50"
USER = "root"
PASS = "123456789"
DASHBOARD_DIR = os.path.join(os.path.dirname(__file__), "..", "dashboard")
REMOTE_TMP = "/tmp/dashboard_upload"


def main():
    print(f"Deploying dashboard from {DASHBOARD_DIR}...")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASS)

    # 1. Create remote temp dir
    client.exec_command(f"rm -rf {REMOTE_TMP} && mkdir -p {REMOTE_TMP}")
    import time; time.sleep(1)

    # 2. Upload all dashboard files recursively
    sftp = client.open_sftp()
    uploaded = 0
    for root, dirs, files in os.walk(DASHBOARD_DIR):
        # skip node_modules
        if "node_modules" in root:
            continue
        rel = os.path.relpath(root, DASHBOARD_DIR)
        remote_dir = f"{REMOTE_TMP}/{rel}".replace("\\", "/") if rel != "." else REMOTE_TMP
        # create dirs on server (one by one)
        parts = remote_dir.split("/")
        for i in range(len(parts)):
            partial = "/".join(parts[:i+1])
            try:
                sftp.stat(partial)
            except IOError:
                client.exec_command(f"mkdir -p {partial}")
        for fname in files:
            local_path = os.path.join(root, fname)
            remote_path = f"{remote_dir}/{fname}".replace("\\", "/")
            sftp.put(local_path, remote_path)
            uploaded += 1
    sftp.close()
    print(f"Uploaded {uploaded} files")

    # 3. Upload source into dashboard container
    _, stdout, _ = client.exec_command(f"docker cp {REMOTE_TMP}/. ops_dashboard:/app/")
    print(f"docker cp: {stdout.read().decode('utf-8', errors='replace').strip()}")

    # 4. Build inside container
    print("Building dashboard inside container...")
    _, stdout, stderr = client.exec_command(
        "docker exec ops_dashboard sh -c 'cd /app && npm run build 2>&1'",
        timeout=300
    )
    output = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    # Check for success
    if "Compiled successfully" in output or "Creating an optimized production build" in output:
        print("Build: SUCCESS")
    else:
        print(f"Build output (last 500 chars):\n{output[-500:]}")
        if err:
            print(f"Build stderr:\n{err[-500:]}")

    # 5. Restart dashboard
    client.exec_command("docker restart ops_dashboard")
    import time; time.sleep(5)

    # 6. Verify
    _, stdout, _ = client.exec_command("docker inspect ops_dashboard --format='{{.State.Status}}'")
    status = stdout.read().decode().strip()
    print(f"Dashboard status: {status}")

    client.close()
    print("Dashboard deployment complete")


if __name__ == "__main__":
    main()
