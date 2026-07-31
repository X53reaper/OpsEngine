import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("192.168.18.50", username="root", password="123456789")

def run(cmd, timeout=30):
    _, o, _ = c.exec_command(cmd, timeout=timeout)
    return o.read().decode("utf-8", errors="replace").strip()

resend_key = run("grep '^RESEND_API_KEY=' /opt/safarizetu-ops-engine/.env | cut -d= -f2-")
from_email = run("grep '^RESEND_FROM_EMAIL=' /opt/safarizetu-ops-engine/.env | cut -d= -f2-")
from_name = run("grep '^RESEND_FROM_NAME=' /opt/safarizetu-ops-engine/.env | cut -d= -f2-")

print("=== RESEND FROM CONTAINER (NODE.JS) ===")

# Test with node.js from container
result = run(f"""docker exec ops_engine node -e "
const key='{resend_key}';
const from='{from_name} <{from_email}>';
fetch('https://api.resend.com/emails',{{
  method:'POST',
  headers:{{'Authorization':'Bearer '+key,'Content-Type':'application/json'}},
  body:JSON.stringify({{from,to:['sirmarshalmuvhuni@gmail.com'],subject:'Test from container',html:'<p>Test</p>'}})
}}).then(r=>r.json()).then(d=>{{console.log('SUCCESS:',JSON.stringify(d));process.exit(0)}}).catch(e=>{{console.error('ERROR:',e.message);process.exit(1)}})
" 2>&1""")
print(f"  {result}")

# Test with onboarding domain
result = run(f"""docker exec ops_engine node -e "
const key='{resend_key}';
fetch('https://api.resend.com/emails',{{
  method:'POST',
  headers:{{'Authorization':'Bearer '+key,'Content-Type':'application/json'}},
  body:JSON.stringify({{from:'onboarding@resend.dev',to:['sirmarshalmuvhuni@gmail.com'],subject:'Test from container',html:'<p>Test</p>'}})
}}).then(r=>r.json()).then(d=>{{console.log('SUCCESS:',JSON.stringify(d));process.exit(0)}}).catch(e=>{{console.error('ERROR:',e.message);process.exit(1)}})
" 2>&1""")
print(f"  {result}")

# Check if the sendEmail function works
print("\n=== TEST SENDEMAIL FUNCTION ===")
result = run("""docker exec ops_engine node -e "
const {sendEmail}=require('./dist/services/ai-agent.service.js');
sendEmail('sirmarshalmuvhuni@gmail.com','Test','<p>Test</p>').then(r=>console.log('ID:',r)).catch(e=>console.error('ERROR:',e.message))
" 2>&1""")
print(f"  {result}")

c.close()