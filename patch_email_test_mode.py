import paramiko
import time
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='ascii', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789')

# Read the compiled JS file from the container
print("=" * 60)
print("STEP 1: Read current compiled sendEmail function")
print("=" * 60)

cmd1 = "docker exec ops_engine cat /app/dist/services/ai-agent.service.js"
stdin1, stdout1, stderr1 = ssh.exec_command(cmd1)
time.sleep(8)
js_content = stdout1.read().decode('ascii', errors='replace')

# Find the sendEmail function
idx = js_content.find('async function sendEmail')
if idx == -1:
    idx = js_content.find('exports.sendEmail')
print(f"sendEmail found at position: {idx}")

# Extract the current sendEmail function
end_idx = js_content.find('\nasync function callGemini', idx)
if end_idx == -1:
    end_idx = js_content.find('\n// GEMINI FALLBACK', idx)
if end_idx == -1:
    end_idx = idx + 2000

current_func = js_content[idx:end_idx]
print(f"Current function length: {len(current_func)} chars")
print("Current function (first 500 chars):")
print(current_func[:500])

# Create the new sendEmail function with test mode
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

# Replace in the JS content
new_js = js_content[:idx] + new_func + js_content[end_idx:]

# Write to server
sftp = ssh.open_sftp()
with sftp.open('/tmp/ai-agent.service.js', 'w') as f:
    f.write(new_js)
sftp.close()
time.sleep(2)

# Copy to container
cmd2 = "docker cp /tmp/ai-agent.service.js ops_engine:/app/dist/services/ai-agent.service.js"
stdin2, stdout2, stderr2 = ssh.exec_command(cmd2)
time.sleep(5)
print("\nPatched compiled JS in container")

# Verify the patch
cmd3 = "docker exec ops_engine grep -c 'EMAIL_TEST_MODE' /app/dist/services/ai-agent.service.js"
stdin3, stdout3, stderr3 = ssh.exec_command(cmd3)
time.sleep(5)
count = stdout3.read().decode('ascii', errors='replace').strip()
print(f"EMAIL_TEST_MODE references in patched JS: {count}")

# Restart container to pick up the new JS
print("\n" + "=" * 60)
print("STEP 2: Restart container to pick up patched JS")
print("=" * 60)

cmd4 = "docker restart ops_engine"
stdin4, stdout4, stderr4 = ssh.exec_command(cmd4)
time.sleep(15)

# Wait for health
cmd5 = "curl -s http://localhost:3000/health"
stdin5, stdout5, stderr5 = ssh.exec_command(cmd5)
time.sleep(5)
print(stdout5.read().decode('ascii', errors='replace'))

ssh.close()
