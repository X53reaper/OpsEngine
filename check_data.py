import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789')

db_url = "postgresql://postgres:yaIcpiFUcjqGMBxVdtcVMKRNRXxAxjWK@yamanote.proxy.rlwy.net:44936/railway?sslmode=require"

# Write SQL files to server
sftp = ssh.open_sftp()

# Check destinations
with sftp.open('/root/check_destinations.sql', 'w') as f:
    f.write('SELECT "id", "name", "isActive" FROM "Destination" ORDER BY "name";')

# Check operators count
with sftp.open('/root/check_operators.sql', 'w') as f:
    f.write('SELECT COUNT(*) as cnt FROM "Operator";')

# Check listings count
with sftp.open('/root/check_listings.sql', 'w') as f:
    f.write('SELECT COUNT(*) as cnt FROM "Listing";')

# Check activities count
with sftp.open('/root/check_activities.sql', 'w') as f:
    f.write('SELECT COUNT(*) as cnt FROM "Activity";')

# Check settings
with sftp.open('/root/check_settings.sql', 'w') as f:
    f.write('SELECT * FROM "Setting";')

# Check all table counts
with sftp.open('/root/check_all_counts.sql', 'w') as f:
    f.write("""SELECT 'Destination' as tbl, COUNT(*) as cnt FROM "Destination"
UNION ALL SELECT 'Operator', COUNT(*) FROM "Operator"
UNION ALL SELECT 'Listing', COUNT(*) FROM "Listing"
UNION ALL SELECT 'Activity', COUNT(*) FROM "Activity"
UNION ALL SELECT 'User', COUNT(*) FROM "User"
UNION ALL SELECT 'Booking', COUNT(*) FROM "Booking"
UNION ALL SELECT 'Review', COUNT(*) FROM "Review"
UNION ALL SELECT 'Setting', COUNT(*) FROM "Setting"
UNION ALL SELECT 'Enquiry', COUNT(*) FROM "Enquiry"
ORDER BY tbl;""")

sftp.close()

# Run checks
files = [
    ('/root/check_destinations.sql', 'DESTINATIONS'),
    ('/root/check_all_counts.sql', 'ALL COUNTS'),
    ('/root/check_settings.sql', 'SETTINGS'),
]

for sql_file, label in files:
    cmd = f'docker run --rm -v {sql_file}:/tmp/check.sql:ro postgres:16 psql "{db_url}" -f /tmp/check.sql'
    stdin, stdout, stderr = ssh.exec_command(cmd)
    time.sleep(10)
    print(f"\n{label}:")
    print(stdout.read().decode('ascii', errors='replace'))
    err = stderr.read().decode('ascii', errors='replace')
    if err and 'NOTICE' not in err:
        print("STDERR:", err)

ssh.close()
