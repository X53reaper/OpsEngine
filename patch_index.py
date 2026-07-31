import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

container_id = 'ops_engine'

# Step 1: Stop container
print('Step 1: Stopping container...')
ssh.exec_command(f'docker stop {container_id}')
time.sleep(3)

# Step 2: Extract index.js
print('\nStep 2: Extracting index.js...')
ssh.exec_command(f'docker cp {container_id}:/app/dist/index.js /tmp/index.js')
time.sleep(1)

# Read the index.js
stdin, stdout, stderr = ssh.exec_command('cat /tmp/index.js')
content = stdout.read().decode('utf-8', errors='replace')

# Find where to insert the email preview endpoint - before the default 404 handler
# Look for "Default 404" or the last route handler
insert_marker = '// Default 404'
if insert_marker in content:
    print(f'  Found insert marker at position {content.index(insert_marker)}')
else:
    # Try alternate markers
    for marker in ['res.writeHead(404', 'Not found', 'Default']:
        idx = content.rfind(marker)
        if idx > 0:
            print(f'  Found alternate marker "{marker}" at position {idx}')
            insert_marker = marker
            break

# The email preview endpoint code
email_preview_code = """
    // POST /api/emails/preview - Preview email templates
    if (req.url === '/api/emails/preview' && req.method === 'POST') {
      try {
        const { template, data, palette } = await parseBody()
        let html = ''
        
        if (template === 'enquiry-acknowledgement') {
          const { enquiryAcknowledgementEmail } = require('./services/email-template-helpers')
          html = enquiryAcknowledgementEmail({
            touristName: (data && data.touristName) || 'John',
            enquiryId: (data && data.enquiryId) || 'ENQ-001',
            destination: (data && data.destination) || 'Victoria Falls',
            travelDates: (data && data.travelDates) || 'March 2026',
            partySize: (data && data.partySize) || 2,
            enquiryUrl: (data && data.enquiryUrl) || 'https://safarizetu.com/enquiry/test'
          })
        } else if (template === 'booking-confirmation') {
          const { bookingConfirmationEmail } = require('./services/email-template-helpers')
          html = bookingConfirmationEmail({
            touristName: (data && data.touristName) || 'John',
            bookingId: (data && data.bookingId) || 'BK-001',
            safariName: (data && data.safariName) || 'Victoria Falls Adventure',
            operatorName: (data && data.operatorName) || 'Safari Experts',
            travelDates: (data && data.travelDates) || 'March 2026',
            partySize: (data && data.partySize) || 2,
            totalAmount: (data && data.totalAmount) || '$2,500',
            depositPaid: (data && data.depositPaid) || '$500',
            balanceDue: (data && data.balanceDue) || '$2,000',
            bookingUrl: (data && data.bookingUrl) || 'https://safarizetu.com/bookings/test'
          })
        } else if (template === 'revenue-report') {
          const { revenueReportEmail } = require('./services/email-template-helpers')
          html = revenueReportEmail({
            operatorName: (data && data.operatorName) || 'Safari Experts',
            reportPeriod: (data && data.reportPeriod) || 'Week 24, 2026',
            totalRevenue: (data && data.totalRevenue) || '$12,500',
            bookingsCount: (data && data.bookingsCount) || 8,
            averageBookingValue: (data && data.averageBookingValue) || '$1,562',
            topSafari: (data && data.topSafari) || 'Victoria Falls Adventure',
            conversionRate: (data && data.conversionRate) || '3.2%',
            commissionOwed: (data && data.commissionOwed) || '$1,875'
          })
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Unknown template. Available: enquiry-acknowledgement, booking-confirmation, revenue-report' }))
          return
        }
        
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(html)
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    """

# Insert before the 404 handler
content = content.replace(insert_marker, email_preview_code + insert_marker)
print(f'  Inserted email preview endpoint')

# Step 3: Write modified index.js back
print('\nStep 3: Writing modified index.js...')
with open(r'C:\Users\marsm\AppData\Local\Temp\index_patched.js', 'w', encoding='utf-8') as f:
    f.write(content)

# Upload to server
sftp = ssh.open_sftp()
sftp.put(r'C:\Users\marsm\AppData\Local\Temp\index_patched.js', '/tmp/index_patched.js')
sftp.close()

# Copy into container
stdin, stdout, stderr = ssh.exec_command(f'docker cp /tmp/index_patched.js {container_id}:/app/dist/index.js')
err = stderr.read().decode()
print(f'  Copy: {"OK" if not err else err.strip()[:200]}')

# Step 4: Also copy email-template-helpers.js
print('\nStep 4: Copying email-template-helpers.js...')
stdin, stdout, stderr = ssh.exec_command(f'docker cp /opt/safarizetu-ops-engine/dist_from_src/services/email-template-helpers.js {container_id}:/app/dist/services/email-template-helpers.js')
err = stderr.read().decode()
print(f'  email-template-helpers.js: {"OK" if not err else err.strip()[:200]}')

# Copy email-templates directory
stdin, stdout, stderr = ssh.exec_command(f'docker cp /opt/safarizetu-ops-engine/dist_from_src/services/email-templates {container_id}:/app/dist/services/email-templates')
err = stderr.read().decode()
print(f'  email-templates/: {"OK" if not err else err.strip()[:200]}')

# Step 5: Restart container
print('\nStep 5: Restarting container...')
ssh.exec_command(f'docker start {container_id}')
time.sleep(10)

# Step 6: Check health
stdin, stdout, stderr = ssh.exec_command('curl -s http://localhost:3000/health')
health = stdout.read().decode().strip()
print(f'\n  Health: {health}')

if 'ok' in health:
    # Step 7: Test email preview
    print('\nStep 7: Testing email preview...')
    payload = '{"template":"enquiry-acknowledgement","data":{"touristName":"John","enquiryId":"ENQ-001","destination":"Victoria Falls"}}'
    cmd = f"curl -s -X POST http://localhost:3000/api/emails/preview -H 'Content-Type: application/json' -d '{payload}'"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    output = stdout.read().decode()
    if 'error' in output.lower() or 'Not found' in output or len(output) < 100:
        print(f'  Response: {output[:500]}')
    else:
        print(f'  SUCCESS! Email HTML length: {len(output)} chars')
        print(f'  Preview: {output[:500]}')
else:
    print('\nContainer not healthy. Checking logs...')
    stdin, stdout, stderr = ssh.exec_command(f'docker logs {container_id} --tail 10 2>&1')
    print(stdout.read().decode())

ssh.close()
