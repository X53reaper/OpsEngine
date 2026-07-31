import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd):
    _, o, _ = c.exec_command(cmd, timeout=30)
    return o.read().decode("utf-8", errors="replace").strip()

# Fix competitor_content table - add competitor column that the code expects
print("=== ADDING MISSING COLUMNS ===")
out = run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c 'ALTER TABLE competitor_content ADD COLUMN IF NOT EXISTS competitor VARCHAR(255);'")
print(out)

out = run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c 'ALTER TABLE competitor_content ADD COLUMN IF NOT EXISTS content_image_url VARCHAR(500);'")
print(out)

# Verify
print("\n=== VERIFY SCHEMA ===")
out = run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c '\\d competitor_content'")
print(out)

c.close()