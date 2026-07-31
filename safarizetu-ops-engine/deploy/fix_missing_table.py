import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd):
    _, o, _ = c.exec_command(cmd, timeout=30)
    return o.read().decode("utf-8", errors="replace").strip()

# 1. Create missing competitor_content table
print("=== CREATING competitor_content TABLE ===")
sql = """
CREATE TABLE IF NOT EXISTS competitor_content (
    id SERIAL PRIMARY KEY,
    competitor_handle VARCHAR(255) NOT NULL,
    platform VARCHAR(50) DEFAULT 'instagram',
    content_type VARCHAR(50) DEFAULT 'post',
    content_text TEXT,
    content_url VARCHAR(500),
    engagement_likes INTEGER DEFAULT 0,
    engagement_comments INTEGER DEFAULT 0,
    engagement_shares INTEGER DEFAULT 0,
    scraped_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competitor_content_handle ON competitor_content(competitor_handle);
CREATE INDEX IF NOT EXISTS idx_competitor_content_scraped ON competitor_content(scraped_at);
"""
out = run(f"docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c \"{sql}\"")
print(out)

# 2. Verify table exists
print("\n=== VERIFY TABLE ===")
out = run("docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c \"SELECT COUNT(*) FROM competitor_content;\"")
print(out)

# 3. Check the enquiry_check error more carefully - what does fetchFromSafariZetu actually do?
print("\n=== ENQUIRY CHECK - DETAILED ERROR ===")
out = run("docker logs ops_engine --since 5m 2>&1 | grep -A 5 'Enquiry check failed'")
print(out)

# 4. Test the scan endpoint directly with a single competitor
print("\n=== TEST SINGLE COMPETITOR SCRAPE ===")
import subprocess
result = subprocess.run(
    ["curl", "-s", "-w", "\\nHTTP:%{http_code}", 
     "-X", "POST", "http://192.168.18.50:3000/api/competitors/scrape/@wildernesssafaris"],
    capture_output=True, text=True, timeout=60
)
print(f"  Response: {result.stdout[:400]}")

c.close()
