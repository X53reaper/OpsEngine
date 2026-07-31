// Script to test ALL Safari Zetu email templates with proper footer
// Location: test-email-templates-all.js

const fs = require('fs');
const path = require('path');

function loadEnv(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        process.env[match[1]] = (match[2] || '').replace(/['"]/g, '').trim();
      }
    }
  } catch {}
}

loadEnv(path.join(__dirname, 'safarizetu-ops-engine', '.env'));

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
const RESEND_FROM_NAME = process.env.RESEND_FROM_NAME;
const EMAIL = 'sirmarshalmuvhuni@gmail.com';

// Shared styling
const GREEN = '#2D4231';
const GOLD = '#B37038';
const BG = '#F5F2E9';

function wrapHtml(content, title) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Safari Zetu</title>
</head>
<body style="margin:0;padding:0;background-color:${BG};font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG};padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background-color:${GREEN};padding:32px 40px;border-radius:12px 12px 0 0;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border:1.2px solid #ffffff;border-radius:50%;width:40px;height:40px;text-align:center;vertical-align:middle;">
                    <span style="font-family:'Playfair Display',Georgia,serif;font-size:18px;font-weight:400;color:#ffffff;line-height:40px;display:block;">S</span>
                  </td>
                  <td style="padding-left:14px;">
                    <span style="font-family:'Playfair Display',Georgia,serif;font-size:16px;font-weight:400;color:#ffffff;letter-spacing:0.2em;text-transform:uppercase;">Safari Zetu</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="background-color:#ffffff;padding:48px 40px;border-radius:0 0 12px 12px;">
              ${content}
            </td>
          </tr>
        </table>
        <!-- Footer -->
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="padding:32px 0 0 0;text-align:center;">
              <p style="font-size:13px;color:#737972;margin:0 0 8px 0;font-family:'Manrope',sans-serif;">Safari Zetu — Zimbabwe's Premium Safari Marketplace</p>
              <p style="font-size:13px;color:#737972;margin:0 0 8px 0;font-family:'Manrope',sans-serif;">
                <a href="https://safarizetu.com" style="color:${GOLD};text-decoration:none;">safarizetu.com</a>
                &nbsp;|&nbsp;
                <a href="mailto:support@safarizetu.com" style="color:${GOLD};text-decoration:none;">support@safarizetu.com</a>
              </p>
              <p style="font-size:12px;color:#a8c3af;margin:16px 0 0 0;font-family:'Manrope',sans-serif;">Centcom Technologies Pvt Ltd &middot; Registered in Zimbabwe</p>
              <p style="font-size:12px;color:#a8c3af;margin:8px 0 0 0;font-family:'Manrope',sans-serif;">
                You are receiving this email because you have an account with Safari Zetu.<br>
                <a href="#" style="color:#a8c3af;">Unsubscribe from non-essential emails</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function header(title, subtitle) {
  return `<div style="margin-bottom:32px;">
<h1 style="font-family:'Playfair Display',Georgia,serif;font-style:italic;font-weight:400;font-size:28px;color:${GREEN};margin:0 0 8px 0;">${title}</h1>
<p style="font-family:'Manrope',sans-serif;font-size:13px;font-weight:600;color:${GOLD};text-transform:uppercase;letter-spacing:0.1em;margin:0 0 32px 0;">${subtitle}</p>
</div>`;
}

function p(text) {
  return `<p style="font-family:'Manrope',sans-serif;font-size:16px;line-height:1.7;color:#262626;margin:0 0 24px 0;">${text}</p>`;
}

function btn(text, url) {
  return `<table cellpadding="0" cellspacing="0" style="margin:32px 0;">
<tr><td style="background-color:${GREEN};border-radius:8px;">
<a href="${url}" style="display:inline-block;padding:16px 36px;font-family:'Manrope',sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.02em;border-radius:8px;">${text}</a>
</td></tr></table>`;
}

function keyValueRow(key, val) {
  return `<tr><td style="padding:8px 0;border-bottom:1px solid rgba(168,195,175,0.2);">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:12px;font-weight:600;color:#737972;text-transform:uppercase;letter-spacing:0.08em;width:40%;padding:8px 0;font-family:'Manrope',sans-serif;">${key}</td>
<td style="font-size:15px;color:#262626;width:60%;padding:8px 0;font-family:'Manrope',sans-serif;">${val}</td>
</tr></table></td></tr>`;
}

function infoBox(text) {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2E9;border-left:3px solid ${GOLD};margin:24px 0;border-radius:0 8px 8px 0;">
<tr><td style="padding:20px 24px;">
<p style="font-family:'Manrope',sans-serif;font-size:15px;color:#262626;line-height:1.7;margin:0;">${text}</p>
</td></tr></table>`;
}

function divider() {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0;"><tr><td style="border-top:1px solid rgba(168,195,175,0.2);"></td></tr></table>`;
}

function tableRow(cells, bg) {
  return `<tr style="border-bottom:1px solid rgba(168,195,175,0.2);">
${cells.map((c,i) => `<td style="padding:12px 16px;font-family:'Manrope',sans-serif;font-size:14px;color:#262626;${i===cells.length-1?'text-align:right':''}">${c}</td>`).join('')}
</tr>`;
}

function tableHead(cells) {
  return `<tr style="background-color:${GREEN};">
${cells.map(c => `<th style="padding:12px 16px;text-align:left;font-family:'Manrope',sans-serif;font-size:11px;color:#ffffff;text-transform:uppercase;letter-spacing:1px;font-weight:600;">${c}</th>`).join('')}
</tr>`;
}

const templates = [
  {
    name: '1. Enquiry Acknowledgement',
    subject: 'Safari Zetu - Thank You for Your Enquiry',
    html: wrapHtml(`
      ${header('Thank You for Your Enquiry', "We're on it")}
      ${p('Dear Marshal Muvhuni,')}
      ${p("We've received your enquiry about <strong>Hwange National Park</strong> and our team is already working on finding the perfect safari experience for you.")}
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
        ${keyValueRow('Enquiry Reference', '#SZ-2026-001234')}
        ${keyValueRow('Destination', 'Hwange National Park')}
        ${keyValueRow('Travel Dates', '15-22 July 2026')}
        ${keyValueRow('Group Size', '4 travelers')}
      </table>
      ${p('Our safari specialists will review your requirements and get back to you within 24 hours with personalized recommendations.')}
      ${btn('View Your Enquiry', 'https://safarizetu.com/enquiry/SZ-2026-001234')}
    `, 'Thank You for Your Enquiry')
  },
  {
    name: '2. Booking Confirmation',
    subject: 'Safari Zetu - Your Safari Booking is Confirmed!',
    html: wrapHtml(`
      ${header('Booking Confirmed', 'Your African adventure awaits')}
      ${p('Dear Marshal Muvhuni,')}
      ${p('Great news! Your safari booking has been confirmed. Here are your booking details:')}
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:24px 0;border-radius:8px;overflow:hidden;">
        ${tableHead(['Detail', 'Information'])}
        ${tableRow(['Booking Reference', '#BKG-2026-005678'])}
        ${tableRow(['Safari', 'Hwange Luxury Lodge Safari'])}
        ${tableRow(['Operator', 'Zimbabwe Safari Adventures'])}
        ${tableRow(['Travel Dates', '15-22 July 2026'])}
        ${tableRow(['Group Size', '4 travelers'])}
      </table>
      ${divider()}
      ${infoBox('<strong>Total: $4,800</strong> | <strong>Deposit Paid: $1,200</strong> | <strong>Balance Due: $3,600</strong>')}
      ${p('Please save this confirmation email. You can manage your booking and access all details through your dashboard.')}
      ${btn('Manage Your Booking', 'https://safarizetu.com/booking/BKG-2026-005678')}
    `, 'Booking Confirmed')
  },
  {
    name: '3. Welcome (Tourist)',
    subject: 'Safari Zetu - Welcome to Your Safari Journey!',
    html: wrapHtml(`
      ${header('Welcome to Safari Zetu', 'Your African adventure starts here')}
      ${p('Dear Marshal Muvhuni,')}
      ${p('Welcome to Safari Zetu — your gateway to authentic African safari experiences. Browse our curated collection of wildlife encounters, cultural immersions, and adventure tours across Zimbabwe.')}
      <ul style="font-family:'Manrope',sans-serif;font-size:16px;line-height:1.7;color:#262626;margin:0 0 24px 0;padding-left:20px;">
        <li style="margin-bottom:8px;">Browse and book from 1,199+ verified safari operators</li>
        <li style="margin-bottom:8px;">Get personalized recommendations based on your preferences</li>
        <li style="margin-bottom:8px;">Manage all your bookings in one place</li>
        <li style="margin-bottom:8px;">Access exclusive deals and early-bird offers</li>
      </ul>
      ${btn('Explore Safaris', 'https://safarizetu.com/explore')}
    `, 'Welcome to Safari Zetu')
  },
  {
    name: '4. Welcome (Operator)',
    subject: 'Safari Zetu - Your Business is Live!',
    html: wrapHtml(`
      ${header('Your Business is Live!', 'Welcome to Safari Zetu')}
      ${p('Dear Zimbabwe Safari Adventures,')}
      ${p('Congratulations! Your safari business is now live on Safari Zetu. Tourists from around the world can now discover and book your experiences.')}
      ${infoBox('Next steps: Complete your profile, upload photos, and set your availability to start receiving bookings.')}
      ${btn('Go to Dashboard', 'https://safarizetu.com/dashboard')}
    `, 'Your Business is Live!')
  },
  {
    name: '5. Onboarding Reminder',
    subject: 'Safari Zetu - Complete Your Profile',
    html: wrapHtml(`
      ${header('Complete Your Profile', '65% complete')}
      ${p('Dear Marshal Muvhuni,')}
      ${p('Your profile is <strong>65% complete</strong>. Finish setting up to unlock all features and start receiving bookings.')}
      ${infoBox('Complete your profile to appear higher in search results and attract more travelers.')}
      ${btn('Complete Profile', 'https://safarizetu.com/profile/edit')}
    `, 'Complete Your Profile')
  },
  {
    name: '6. Invoice',
    subject: 'Safari Zetu - Your Invoice is Ready',
    html: wrapHtml(`
      ${header('Invoice', 'Payment Details')}
      ${p('Dear Marshal Muvhuni,')}
      ${p('Please find your invoice for the Hwange Luxury Lodge Safari below:')}
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:24px 0;border-radius:8px;overflow:hidden;">
        ${tableHead(['Item', 'Amount'])}
        ${tableRow(['Hwange Luxury Lodge Safari (4 travelers)', '$4,800'])}
        ${tableRow(['Deposit Paid', '-$1,200'])}
        <tr style="background-color:#F5F2E9;">
          <td style="padding:12px 16px;font-family:'Manrope',sans-serif;font-size:16px;font-weight:600;">Balance Due</td>
          <td style="padding:12px 16px;font-family:'Manrope',sans-serif;font-size:16px;font-weight:600;text-align:right;">$3,600</td>
        </tr>
      </table>
      ${p('Please save this invoice for your records.')}
      ${btn('Pay Now', 'https://safarizetu.com/invoice/BKG-2026-005678')}
    `, 'Invoice')
  },
  {
    name: '7. Revenue Report',
    subject: 'Safari Zetu - Your Weekly Revenue Report',
    html: wrapHtml(`
      ${header('Weekly Revenue Report', '9 - 15 June 2026')}
      ${p('Hello Zimbabwe Safari Adventures,')}
      ${p("Here's your revenue performance summary for 9 - 15 June 2026.")}
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:24px 0;border-radius:8px;overflow:hidden;">
        ${tableHead(['Metric', 'Value'])}
        ${tableRow(['Total Revenue', '$12,400'])}
        ${tableRow(['Bookings', '8'])}
        ${tableRow(['Average Booking', '$1,550'])}
        ${tableRow(['Top Safari', 'Hwange Luxury Lodge'])}
        ${tableRow(['Conversion Rate', '34%'])}
      </table>
      ${divider()}
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
        ${keyValueRow('Commission Owed', '$1,240')}
      </table>
      ${p('Keep up the great work! Your safari experiences are making a difference for travelers from around the world.')}
      ${btn('View Full Report', 'https://safarizetu.com/reports/revenue')}
    `, 'Weekly Revenue Report')
  },
  {
    name: '8. Operator Scorecard',
    subject: 'Safari Zetu - Your Operator Scorecard',
    html: wrapHtml(`
      ${header('Operator Scorecard', 'June 2026')}
      ${p('Hello Zimbabwe Safari Adventures,')}
      ${p('Your overall performance score for June 2026 is <strong>87/100</strong>.')}
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:24px 0;border-radius:8px;overflow:hidden;">
        ${tableHead(['Metric', 'Score', 'Trend'])}
        ${tableRow(['Customer Satisfaction', '92/100', '+5%'])}
        ${tableRow(['Response Time', '88/100', '+3%'])}
        ${tableRow(['Booking Completion', '85/100', '-2%'])}
        ${tableRow(['Photo Quality', '90/100', '+8%'])}
      </table>
      ${divider()}
      ${infoBox('<strong>Top Strength:</strong> Exceptional customer satisfaction ratings')}
      ${infoBox('<strong>Area for Improvement:</strong> Faster response times to enquiries')}
      ${p('Keep up the great work! Login to your dashboard for detailed analytics.')}
      ${btn('View Dashboard', 'https://safarizetu.com/dashboard')}
    `, 'Operator Scorecard')
  },
  {
    name: '9. Security Alert',
    subject: 'Safari Zetu - Security Alert on Your Account',
    html: wrapHtml(`
      ${header('Security Alert', 'Action required')}
      ${p('Dear Marshal Muvhuni,')}
      ${p('We detected a sign-in to your account from a new device. If this was you, no action is needed.')}
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FEF3C7;border-left:3px solid #F59E0B;margin:24px 0;border-radius:0 8px 8px 0;">
        <tr><td style="padding:20px 24px;">
          <p style="font-family:'Manrope',sans-serif;font-size:15px;color:#262626;margin:0;"><strong>Sign-in Details:</strong><br>Location: Harare, Zimbabwe<br>Device: Chrome on Windows<br>Time: Just now</p>
        </td></tr>
      </table>
      ${p("If you didn't make this sign-in, please change your password immediately.")}
      <table cellpadding="0" cellspacing="0" style="margin:32px 0;">
        <tr><td style="background-color:#DC2626;border-radius:8px;">
          <a href="https://safarizetu.com/security" style="display:inline-block;padding:16px 36px;font-family:'Manrope',sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Secure My Account</a>
        </td></tr>
      </table>
      ${p('If you have any concerns, please contact our support team at support@safarizetu.com.')}
    `, 'Security Alert')
  },
  {
    name: '10. Inventory Alert',
    subject: 'Safari Zetu - Inventory Alert',
    html: wrapHtml(`
      ${header('Inventory Alert', '2 Critical Items')}
      ${p('Attention: <strong>2 items</strong> are critically low and <strong>3 items</strong> are running low.')}
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:24px 0;border-radius:8px;overflow:hidden;">
        ${tableHead(['Item', 'Available', 'Status'])}
        ${tableRow(['Hwange Lodge (15 Jul)', '1', 'Critical'])}
        ${tableRow(['Mana Pools Camp (20 Jul)', '2', 'Critical'])}
      </table>
      ${infoBox('Action required: Update availability or adjust pricing for affected items.')}
      ${btn('Update Inventory', 'https://safarizetu.com/inventory')}
    `, 'Inventory Alert')
  },
  {
    name: '11. Content Calendar',
    subject: 'Safari Zetu - Your Weekly Content Calendar',
    html: wrapHtml(`
      ${header('Weekly Content Calendar', '16 - 22 June 2026')}
      ${p('Dear Marshal Muvhuni,')}
      ${p("Here's your content calendar for this week. Plan your posts to maximize engagement with your audience.")}
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:24px 0;border-radius:8px;overflow:hidden;">
        ${tableHead(['Day', 'Platform', 'Content'])}
        ${tableRow(['Monday', 'Instagram', '🌅 Morning game drive photo'])}
        ${tableRow(['Tuesday', 'TikTok', '🎬 Wildlife encounter reel'])}
        ${tableRow(['Wednesday', 'Facebook', '📋 Safari tips carousel'])}
        ${tableRow(['Thursday', 'Instagram', '🦁 Meet your guide post'])}
        ${tableRow(['Friday', 'All Platforms', '🌍 Weekend adventure CTA'])}
      </table>
      ${p('Consistent posting helps build your audience and drive more bookings.')}
      ${btn('View Full Calendar', 'https://safarizetu.com/content-calendar')}
    `, 'Content Calendar')
  },
  {
    name: '12. Sentiment Report',
    subject: 'Safari Zetu - Your Weekly Sentiment Report',
    html: wrapHtml(`
      ${header('Weekly Sentiment Report', '9 - 15 June 2026')}
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
        ${keyValueRow('Overall Sentiment', 'Positive')}
        ${keyValueRow('Average Score', '8.4/10')}
        ${keyValueRow('Total Mentions', '247')}
      </table>
      ${divider()}
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
        ${keyValueRow('Positive', '78%')}
        ${keyValueRow('Negative', '12%')}
      </table>
      ${divider()}
      ${infoBox('<strong>Top Praise:</strong> "Incredible wildlife sightings and professional guides"')}
      ${infoBox('<strong>Top Concern:</strong> "Some lodges have slow Wi-Fi"')}
      ${p('Monitor your sentiment to improve customer satisfaction and attract more bookings.')}
      ${btn('View Detailed Report', 'https://safarizetu.com/reports/sentiment')}
    `, 'Sentiment Report')
  },
  {
    name: '13. Partnership Agreement',
    subject: 'Safari Zetu - Partnership Agreement',
    html: wrapHtml(`
      ${header('Partnership Agreement', 'Safari Zetu × Zimbabwe Safari Adventures')}
      ${p('Dear Zimbabwe Safari Adventures,')}
      ${p('Please review the partnership agreement below. Once signed, you will receive access to the operator dashboard and can start receiving bookings.')}
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
        ${keyValueRow('Agreement ID', 'AGR-2026-001')}
        ${keyValueRow('Start Date', '1 July 2026')}
        ${keyValueRow('Commission Rate', '12%')}
      </table>
      ${divider()}
      ${p('<strong>Key Terms:</strong>')}
      <ul style="font-family:'Manrope',sans-serif;font-size:16px;line-height:1.7;color:#262626;margin:0 0 24px 0;padding-left:20px;">
        <li style="margin-bottom:8px;">Commission of 12% on all bookings</li>
        <li style="margin-bottom:8px;">30-day payment cycle</li>
        <li style="margin-bottom:8px;">Quality standards must be maintained</li>
        <li style="margin-bottom:8px;">30-day notice for termination</li>
      </ul>
      ${btn('Review & Sign Agreement', 'https://safarizetu.com/partnership/AGR-2026-001')}
    `, 'Partnership Agreement')
  }
];

async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return null;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
      to: [to],
      subject: subject,
      html: html
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend error: ${response.status} - ${error}`);
  }

  return await response.json();
}

async function sendAllTemplates() {
  console.log('Sending ALL Safari Zetu email templates (with proper footer) to:', EMAIL);
  console.log('================================================================\n');

  let successCount = 0;
  let failCount = 0;

  for (const template of templates) {
    try {
      console.log(`Sending: ${template.name}...`);
      const result = await sendEmail(EMAIL, template.subject, template.html);
      if (result && result.id) {
        console.log(`  ✅ Sent successfully (ID: ${result.id})`);
        successCount++;
      } else {
        console.log(`  ⚠️  Sent but no ID returned`);
        successCount++;
      }
    } catch (error) {
      console.log(`  ❌ Failed: ${error.message}`);
      failCount++;
    }
    // Delay between sends to avoid rate limits
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n================================================');
  console.log(`Results: ${successCount} sent, ${failCount} failed`);
  console.log(`Total templates: ${templates.length}`);
  console.log('\nCheck your inbox at:', EMAIL);
  console.log('\nEach email now includes the full Safari Zetu footer:');
  console.log('  - Company name & tagline');
  console.log('  - Website link');
  console.log('  - Support email');
  console.log('  - Company registration');
  console.log('  - Unsubscribe link');
}

sendAllTemplates().catch(console.error);
