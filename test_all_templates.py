import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.18.50', username='root', password='123456789', timeout=10)

# Test booking confirmation
print('Testing booking-confirmation template...')
payload = '{"template":"booking-confirmation","data":{"touristName":"Sarah","bookingId":"BK-123","safariName":"Hwange National Park Safari","operatorName":"Wilderness Safaris","travelDates":"July 2026","partySize":4,"totalAmount":"$5,200","depositPaid":"$1,000","balanceDue":"$4,200"}}'
cmd = f"curl -s -X POST http://localhost:3000/api/emails/preview -H 'Content-Type: application/json' -d '{payload}'"
stdin, stdout, stderr = ssh.exec_command(cmd)
output = stdout.read().decode()
print(f'  Length: {len(output)} chars')
print(f'  Preview: {output[:300]}...')
print()

# Test revenue report (midnight palette)
print('Testing revenue-report template (midnight palette)...')
payload2 = '{"template":"revenue-report","data":{"operatorName":"Wilderness Safaris","reportPeriod":"Week 24, 2026","totalRevenue":"$18,500","bookingsCount":12,"averageBookingValue":"$1,542","topSafari":"Hwange Explorer","conversionRate":"4.1%","commissionOwed":"$2,775"}}'
cmd2 = f"curl -s -X POST http://localhost:3000/api/emails/preview -H 'Content-Type: application/json' -d '{payload2}'"
stdin, stdout, stderr = ssh.exec_command(cmd2)
output2 = stdout.read().decode()
print(f'  Length: {len(output2)} chars')
print(f'  Preview: {output2[:300]}...')

ssh.close()
