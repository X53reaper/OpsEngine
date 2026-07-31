import paramiko
import time
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='ascii', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789')

# Read the compiled division1-growth.js
print("1. Reading compiled division1-growth.js...")
cmd1 = "docker exec ops_engine cat /app/dist/agents/division1-growth.js"
stdin1, stdout1, stderr1 = ssh.exec_command(cmd1)
time.sleep(8)
js_content = stdout1.read().decode('ascii', errors='replace')

# Find the acknowledgeEnquiry function and fix the field mapping
# The issue is: enquiry.tourist?.email -> should also check enquiry.email
old_patterns = [
    ("enquiry.tourist?.name || 'there'", "(enquiry.tourist?.name || enquiry.name || enquiry.customer_name || 'there')"),
    ("enquiry.tourist?.email", "(enquiry.tourist?.email || enquiry.email || enquiry.customer_email)"),
    ("enquiry.travelDates", "(enquiry.travelDates || enquiry.travel_dates || 'Flexible dates')"),
    ("enquiry.groupSize", "(enquiry.groupSize || enquiry.guests || 1)"),
]

new_js = js_content
for old, new in old_patterns:
    count = new_js.count(old)
    if count > 0:
        new_js = new_js.replace(old, new)
        print(f"   Replaced {count}x: {old[:40]}...")

# Write patched JS to server
sftp = ssh.open_sftp()
with sftp.open('/tmp/division1-growth.js', 'w') as f:
    f.write(new_js)
sftp.close()
time.sleep(2)

# Copy to container
print("2. Copying patched JS to container...")
cmd2 = "docker cp /tmp/division1-growth.js ops_engine:/app/dist/agents/division1-growth.js"
stdin2, stdout2, stderr2 = ssh.exec_command(cmd2)
time.sleep(5)

# Verify the patch
print("3. Verifying patch...")
cmd3 = "docker exec ops_engine grep -c 'enquiry.email' /app/dist/agents/division1-growth.js"
stdin3, stdout3, stderr3 = ssh.exec_command(cmd3)
time.sleep(5)
count = stdout3.read().decode('ascii', errors='replace').strip()
print(f"   enquiry.email references: {count}")

# Also patch the ai-agent.service.js for test mode
print("4. Patching ai-agent.service.js for test mode...")
cmd4 = "docker exec ops_engine cat /app/dist/services/ai-agent.service.js"
stdin4, stdout4, stderr4 = ssh.exec_command(cmd4)
time.sleep(8)
service_js = stdout4.read().decode('ascii', errors='replace')

# Check if test mode is already there
if 'EMAIL_TEST_MODE' in service_js:
    print("   Test mode already patched!")
else:
    # Find sendEmail function and add test mode
    idx = service_js.find('async function sendEmail')
    if idx == -1:
        idx = service_js.find('exports.sendEmail')
    
    # Find the end of the function
    end_idx = service_js.find('\nasync function callGemini', idx)
    if end_idx == -1:
        end_idx = service_js.find('\n// GEMINI FALLBACK', idx)
    
    current_func = service_js[idx:end_idx]
    
    # Replace with test mode version
    new_func = """async function sendEmail(to, subject, html) {
  // Email test mode: route all emails to test address
  const testMode = process.env.EMAIL_TEST_MODE === 'true';
  const testOverride = process.env.EMAIL_TEST_OVERRIDE || process.env.TEST_EMAIL || 'sirmarshalmuvhuni@gmail.com';
  
  let actualTo = to;
  let actualSubject = subject;
  let actualHtml = html;
  
  if (testMode && to !== testOverride) {
    actualTo = testOverride;
    actualSubject = `[TEST - intended for: ${to}] ${subject}`;
    actualHtml = `<div style="background:#fef3c7;border:1px solid #f59e0b;padding:12px;margin-bottom:20px;font-family:sans-serif;font-size:14px;">
      <strong>TEST MODE</strong> — This email was originally intended for: <strong>${to}</strong>
    </div>${html}`;
    logger.info(`Email test mode: routing to ${testOverride} (original: ${to})`);
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `${process.env.RESEND_FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`,
      to: [actualTo],
      subject: actualSubject,
      html: actualHtml
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'unknown');
    throw new Error(`Resend error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  return data.id;
}"""
    
    service_js = service_js[:idx] + new_func + service_js[end_idx:]
    
    sftp2 = ssh.open_sftp()
    with sftp2.open('/tmp/ai-agent.service.js', 'w') as f:
        f.write(service_js)
    sftp2.close()
    time.sleep(2)
    
    cmd5 = "docker cp /tmp/ai-agent.service.js ops_engine:/app/dist/services/ai-agent.service.js"
    stdin5, stdout5, stderr5 = ssh.exec_command(cmd5)
    time.sleep(5)
    print("   Patched!")

# Restart container
print("5. Restarting container...")
cmd6 = "docker restart ops_engine"
stdin6, stdout6, stderr6 = ssh.exec_command(cmd6)
time.sleep(15)

# Wait for health
cmd7 = "curl -s http://localhost:3000/health"
stdin7, stdout7, stderr7 = ssh.exec_command(cmd7)
time.sleep(5)
print(stdout7.read().decode('ascii', errors='replace'))

ssh.close()
