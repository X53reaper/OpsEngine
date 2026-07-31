// Script to test all Safari Zetu email templates
// Location: test-email-templates.js

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

// Sample data for templates
const sampleData = {
  touristName: 'Marshal Muvhuni',
  enquiryId: 'SZ-2026-001234',
  destination: 'Hwange National Park',
  travelDates: '15-22 July 2026',
  partySize: 4,
  enquiryUrl: 'https://safarizetu.com/enquiry/SZ-2026-001234',
  bookingId: 'BKG-2026-005678',
  safariName: 'Hwange Luxury Lodge Safari',
  operatorName: 'Zimbabwe Safari Adventures',
  totalAmount: '$4,800',
  depositPaid: '$1,200',
  balanceDue: '$3,600',
  bookingUrl: 'https://safarizetu.com/booking/BKG-2026-005678',
  email: 'sirmarshalmuvhuni@gmail.com'
};

// Email templates with their HTML content
const templates = [
  {
    name: '1. Enquiry Acknowledgement',
    subject: 'Safari Zetu - Thank You for Your Enquiry',
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F5F2E9;font-family:'Manrope',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2E9;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="background-color:#2D4231;padding:32px 40px;border-radius:12px 12px 0 0;">
<table cellpadding="0" cellspacing="0"><tr>
<td style="border:1.2px solid #fff;border-radius:50%;width:40px;height:40px;text-align:center;vertical-align:middle;">
<span style="font-family:'Playfair Display',serif;font-size:18px;color:#fff;line-height:40px;">S</span></td>
<td style="padding-left:14px;"><span style="font-family:'Playfair Display',serif;font-size:16px;color:#fff;letter-spacing:0.2em;text-transform:uppercase;">Safari Zetu</span></td>
</tr></table>
</td></tr>
<tr><td style="background-color:#fff;padding:48px 40px;border-radius:0 0 12px 12px;">
<div style="margin-bottom:32px;">
<h1 style="font-family:'Playfair Display',serif;font-style:italic;font-weight:400;font-size:28px;color:#2D4231;margin:0 0 8px 0;">Thank You for Your Enquiry</h1>
<p style="font-family:'Manrope',sans-serif;font-size:13px;font-weight:600;color:#B37038;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 32px 0;">We're on it</p>
</div>
<p style="font-family:'Manrope',sans-serif;font-size:16px;line-height:1.7;color:#262626;margin:0 0 24px 0;">Dear ${sampleData.touristName},</p>
<p style="font-family:'Manrope',sans-serif;font-size:16px;line-height:1.7;color:#262626;margin:0 0 24px 0;">We've received your enquiry about ${sampleData.destination} and our team is already working on finding the perfect safari experience for you.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
<tr><td style="padding:8px 0;border-bottom:1px solid rgba(168,195,175,0.2);">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:12px;font-weight:600;color:#737972;text-transform:uppercase;width:40%;">Enquiry Reference</td>
<td style="font-size:15px;color:#262626;width:60%;">#${sampleData.enquiryId}</td>
</tr></table>
</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid rgba(168,195,175,0.2);">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:12px;font-weight:600;color:#737972;text-transform:uppercase;width:40%;">Destination</td>
<td style="font-size:15px;color:#262626;width:60%;">${sampleData.destination}</td>
</tr></table>
</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid rgba(168,195,175,0.2);">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:12px;font-weight:600;color:#737972;text-transform:uppercase;width:40%;">Travel Dates</td>
<td style="font-size:15px;color:#262626;width:60%;">${sampleData.travelDates}</td>
</tr></table>
</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid rgba(168,195,175,0.2);">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:12px;font-weight:600;color:#737972;text-transform:uppercase;width:40%;">Group Size</td>
<td style="font-size:15px;color:#262626;width:60%;">${sampleData.partySize} travelers</td>
</tr></table>
</td></tr>
</table>
<p style="font-family:'Manrope',sans-serif;font-size:16px;line-height:1.7;color:#262626;margin:0 0 24px 0;">Our safari specialists will review your requirements and get back to you within 24 hours with personalized recommendations.</p>
<table cellpadding="0" cellspacing="0" style="margin:32px 0;">
<tr><td style="background-color:#2D4231;border-radius:8px;">
<a href="${sampleData.enquiryUrl}" style="display:inline-block;padding:16px 36px;font-family:'Manrope',sans-serif;font-size:15px;font-weight:600;color:#fff;text-decoration:none;border-radius:8px;">View Your Enquiry</a>
</td></tr></table>
</td></tr></table>
<p style="font-size:13px;color:#737972;text-align:center;margin:32px 0 8px 0;">Safari Zetu — Zimbabwe's Premium Safari Marketplace</p>
<p style="font-size:13px;color:#737972;text-align:center;margin:0 0 8px 0;">
<a href="https://safarizetu.com" style="color:#B37038;text-decoration:none;">safarizetu.com</a>
</p>
</td></tr></table>
</body></html>`
  },
  {
    name: '2. Booking Confirmation',
    subject: 'Safari Zetu - Your Safari Booking is Confirmed!',
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F5F2E9;font-family:'Manrope',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2E9;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="background-color:#2D4231;padding:32px 40px;border-radius:12px 12px 0 0;">
<table cellpadding="0" cellspacing="0"><tr>
<td style="border:1.2px solid #fff;border-radius:50%;width:40px;height:40px;text-align:center;">
<span style="font-family:'Playfair Display',serif;font-size:18px;color:#fff;line-height:40px;">S</span></td>
<td style="padding-left:14px;"><span style="font-family:'Playfair Display',serif;font-size:16px;color:#fff;letter-spacing:0.2em;text-transform:uppercase;">Safari Zetu</span></td>
</tr></table>
</td></tr>
<tr><td style="background-color:#fff;padding:48px 40px;border-radius:0 0 12px 12px;">
<div style="margin-bottom:32px;">
<h1 style="font-family:'Playfair Display',serif;font-style:italic;font-size:28px;color:#2D4231;margin:0 0 8px 0;">Booking Confirmed</h1>
<p style="font-size:13px;font-weight:600;color:#B37038;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 32px 0;">Your African adventure awaits</p>
</div>
<p style="font-size:16px;line-height:1.7;color:#262626;margin:0 0 24px 0;">Dear ${sampleData.touristName},</p>
<p style="font-size:16px;line-height:1.7;color:#262626;margin:0 0 24px 0;">Great news! Your safari booking has been confirmed. Here are your booking details:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:24px 0;border-radius:8px;overflow:hidden;">
<thead><tr style="background-color:#2D4231;">
<th style="padding:12px 16px;text-align:left;font-size:11px;color:#fff;text-transform:uppercase;letter-spacing:1px;">Detail</th>
<th style="padding:12px 16px;text-align:left;font-size:11px;color:#fff;text-transform:uppercase;letter-spacing:1px;">Information</th>
</tr></thead>
<tbody>
<tr style="border-bottom:1px solid rgba(168,195,175,0.2);">
<td style="padding:12px 16px;font-size:14px;">Booking Reference</td>
<td style="padding:12px 16px;font-size:14px;">#${sampleData.bookingId}</td>
</tr>
<tr style="border-bottom:1px solid rgba(168,195,175,0.2);">
<td style="padding:12px 16px;font-size:14px;">Safari</td>
<td style="padding:12px 16px;font-size:14px;">${sampleData.safariName}</td>
</tr>
<tr style="border-bottom:1px solid rgba(168,195,175,0.2);">
<td style="padding:12px 16px;font-size:14px;">Operator</td>
<td style="padding:12px 16px;font-size:14px;">${sampleData.operatorName}</td>
</tr>
<tr style="border-bottom:1px solid rgba(168,195,175,0.2);">
<td style="padding:12px 16px;font-size:14px;">Travel Dates</td>
<td style="padding:12px 16px;font-size:14px;">${sampleData.travelDates}</td>
</tr>
<tr>
<td style="padding:12px 16px;font-size:14px;">Group Size</td>
<td style="padding:12px 16px;font-size:14px;">${sampleData.partySize} travelers</td>
</tr>
</tbody></table>
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2E9;border-left:3px solid #B37038;margin:24px 0;border-radius:0 8px 8px 0;">
<tr><td style="padding:20px 24px;">
<p style="font-size:15px;color:#262626;line-height:1.7;margin:0;"><strong>Total: ${sampleData.totalAmount}</strong> | <strong>Deposit Paid: ${sampleData.depositPaid}</strong> | <strong>Balance Due: ${sampleData.balanceDue}</strong></p>
</td></tr></table>
<p style="font-size:16px;line-height:1.7;color:#262626;margin:0 0 24px 0;">Please save this confirmation email. You can manage your booking through your dashboard.</p>
<table cellpadding="0" cellspacing="0" style="margin:32px 0;">
<tr><td style="background-color:#2D4231;border-radius:8px;">
<a href="${sampleData.bookingUrl}" style="display:inline-block;padding:16px 36px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;border-radius:8px;">Manage Your Booking</a>
</td></tr></table>
</td></tr></table>
</td></tr></table>
</body></html>`
  },
  {
    name: '3. Welcome Email',
    subject: 'Safari Zetu - Welcome to Your Safari Journey!',
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F5F2E9;font-family:'Manrope',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2E9;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="background-color:#2D4231;padding:32px 40px;border-radius:12px 12px 0 0;">
<table cellpadding="0" cellspacing="0"><tr>
<td style="border:1.2px solid #fff;border-radius:50%;width:40px;height:40px;text-align:center;">
<span style="font-family:'Playfair Display',serif;font-size:18px;color:#fff;line-height:40px;">S</span></td>
<td style="padding-left:14px;"><span style="font-family:'Playfair Display',serif;font-size:16px;color:#fff;letter-spacing:0.2em;text-transform:uppercase;">Safari Zetu</span></td>
</tr></table>
</td></tr>
<tr><td style="background-color:#fff;padding:48px 40px;border-radius:0 0 12px 12px;">
<div style="margin-bottom:32px;">
<h1 style="font-family:'Playfair Display',serif;font-style:italic;font-size:28px;color:#2D4231;margin:0 0 8px 0;">Welcome to Safari Zetu</h1>
<p style="font-size:13px;font-weight:600;color:#B37038;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 32px 0;">Your African adventure begins</p>
</div>
<p style="font-size:16px;line-height:1.7;color:#262626;margin:0 0 24px 0;">Dear ${sampleData.touristName},</p>
<p style="font-size:16px;line-height:1.7;color:#262626;margin:0 0 24px 0;">Welcome to Safari Zetu! You've just joined Zimbabwe's premium safari marketplace, where unforgettable African adventures await.</p>
<p style="font-size:16px;line-height:1.7;color:#262626;margin:0 0 24px 0;">Here's what you can do with your account:</p>
<ul style="font-size:16px;line-height:1.7;color:#262626;margin:0 0 24px 0;padding-left:20px;">
<li style="margin-bottom:8px;">Browse and book from 1,199+ verified safari operators</li>
<li style="margin-bottom:8px;">Get personalized recommendations based on your preferences</li>
<li style="margin-bottom:8px;">Manage all your bookings in one place</li>
<li style="margin-bottom:8px;">Access exclusive deals and early-bird offers</li>
</ul>
<table cellpadding="0" cellspacing="0" style="margin:32px 0;">
<tr><td style="background-color:#2D4231;border-radius:8px;">
<a href="https://safarizetu.com/explore" style="display:inline-block;padding:16px 36px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;border-radius:8px;">Explore Safaris</a>
</td></tr></table>
</td></tr></table>
</td></tr></table>
</body></html>`
  },
  {
    name: '4. Invoice Email',
    subject: 'Safari Zetu - Your Invoice is Ready',
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F5F2E9;font-family:'Manrope',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2E9;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="background-color:#2D4231;padding:32px 40px;border-radius:12px 12px 0 0;">
<table cellpadding="0" cellspacing="0"><tr>
<td style="border:1.2px solid #fff;border-radius:50%;width:40px;height:40px;text-align:center;">
<span style="font-family:'Playfair Display',serif;font-size:18px;color:#fff;line-height:40px;">S</span></td>
<td style="padding-left:14px;"><span style="font-family:'Playfair Display',serif;font-size:16px;color:#fff;letter-spacing:0.2em;text-transform:uppercase;">Safari Zetu</span></td>
</tr></table>
</td></tr>
<tr><td style="background-color:#fff;padding:48px 40px;border-radius:0 0 12px 12px;">
<div style="margin-bottom:32px;">
<h1 style="font-family:'Playfair Display',serif;font-style:italic;font-size:28px;color:#2D4231;margin:0 0 8px 0;">Invoice</h1>
<p style="font-size:13px;font-weight:600;color:#B37038;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 32px 0;">Payment Details</p>
</div>
<p style="font-size:16px;line-height:1.7;color:#262626;margin:0 0 24px 0;">Dear ${sampleData.touristName},</p>
<p style="font-size:16px;line-height:1.7;color:#262626;margin:0 0 24px 0;">Please find your invoice for the ${sampleData.safariName} below:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:24px 0;">
<thead><tr style="background-color:#2D4231;">
<th style="padding:12px 16px;text-align:left;font-size:11px;color:#fff;text-transform:uppercase;">Item</th>
<th style="padding:12px 16px;text-align:right;font-size:11px;color:#fff;text-transform:uppercase;">Amount</th>
</tr></thead>
<tbody>
<tr style="border-bottom:1px solid rgba(168,195,175,0.2);">
<td style="padding:12px 16px;font-size:14px;">${sampleData.safariName} (${sampleData.partySize} travelers)</td>
<td style="padding:12px 16px;font-size:14px;text-align:right;">${sampleData.totalAmount}</td>
</tr>
<tr style="border-bottom:1px solid rgba(168,195,175,0.2);">
<td style="padding:12px 16px;font-size:14px;">Deposit Paid</td>
<td style="padding:12px 16px;font-size:14px;text-align:right;color:#2D4231;">-${sampleData.depositPaid}</td>
</tr>
<tr style="background-color:#F5F2E9;">
<td style="padding:12px 16px;font-size:16px;font-weight:600;">Balance Due</td>
<td style="padding:12px 16px;font-size:16px;font-weight:600;text-align:right;">${sampleData.balanceDue}</td>
</tr>
</tbody></table>
<table cellpadding="0" cellspacing="0" style="margin:32px 0;">
<tr><td style="background-color:#2D4231;border-radius:8px;">
<a href="https://safarizetu.com/invoice/${sampleData.bookingId}" style="display:inline-block;padding:16px 36px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;border-radius:8px;">Pay Now</a>
</td></tr></table>
</td></tr></table>
</td></tr></table>
</body></html>`
  },
  {
    name: '5. Security Alert',
    subject: 'Safari Zetu - Security Alert on Your Account',
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F5F2E9;font-family:'Manrope',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2E9;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="background-color:#2D4231;padding:32px 40px;border-radius:12px 12px 0 0;">
<table cellpadding="0" cellspacing="0"><tr>
<td style="border:1.2px solid #fff;border-radius:50%;width:40px;height:40px;text-align:center;">
<span style="font-family:'Playfair Display',serif;font-size:18px;color:#fff;line-height:40px;">S</span></td>
<td style="padding-left:14px;"><span style="font-family:'Playfair Display',serif;font-size:16px;color:#fff;letter-spacing:0.2em;text-transform:uppercase;">Safari Zetu</span></td>
</tr></table>
</td></tr>
<tr><td style="background-color:#fff;padding:48px 40px;border-radius:0 0 12px 12px;">
<div style="margin-bottom:32px;">
<h1 style="font-family:'Playfair Display',serif;font-style:italic;font-size:28px;color:#2D4231;margin:0 0 8px 0;">Security Alert</h1>
<p style="font-size:13px;font-weight:600;color:#B37038;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 32px 0;">Action required</p>
</div>
<p style="font-size:16px;line-height:1.7;color:#262626;margin:0 0 24px 0;">Dear ${sampleData.touristName},</p>
<p style="font-size:16px;line-height:1.7;color:#262626;margin:0 0 24px 0;">We detected a sign-in to your account from a new device. If this was you, no action is needed.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FEF3C7;border-left:3px solid #F59E0B;margin:24px 0;border-radius:0 8px 8px 0;">
<tr><td style="padding:20px 24px;">
<p style="font-size:15px;color:#262626;margin:0;"><strong>Sign-in Details:</strong><br>Location: Harare, Zimbabwe<br>Device: Chrome on Windows<br>Time: Just now</p>
</td></tr></table>
<p style="font-size:16px;line-height:1.7;color:#262626;margin:0 0 24px 0;">If you didn't make this sign-in, please change your password immediately.</p>
<table cellpadding="0" cellspacing="0" style="margin:32px 0;">
<tr><td style="background-color:#DC2626;border-radius:8px;">
<a href="https://safarizetu.com/security" style="display:inline-block;padding:16px 36px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;border-radius:8px;">Secure My Account</a>
</td></tr></table>
</td></tr></table>
</td></tr></table>
</body></html>`
  },
  {
    name: '6. Content Calendar',
    subject: 'Safari Zetu - Your Weekly Content Calendar',
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F5F2E9;font-family:'Manrope',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2E9;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="background-color:#2D4231;padding:32px 40px;border-radius:12px 12px 0 0;">
<table cellpadding="0" cellspacing="0"><tr>
<td style="border:1.2px solid #fff;border-radius:50%;width:40px;height:40px;text-align:center;">
<span style="font-family:'Playfair Display',serif;font-size:18px;color:#fff;line-height:40px;">S</span></td>
<td style="padding-left:14px;"><span style="font-family:'Playfair Display',serif;font-size:16px;color:#fff;letter-spacing:0.2em;text-transform:uppercase;">Safari Zetu</span></td>
</tr></table>
</td></tr>
<tr><td style="background-color:#fff;padding:48px 40px;border-radius:0 0 12px 12px;">
<div style="margin-bottom:32px;">
<h1 style="font-family:'Playfair Display',serif;font-style:italic;font-size:28px;color:#2D4231;margin:0 0 8px 0;">Weekly Content Calendar</h1>
<p style="font-size:13px;font-weight:600;color:#B37038;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 32px 0;">Plan your safari content</p>
</div>
<p style="font-size:16px;line-height:1.7;color:#262626;margin:0 0 24px 0;">Dear ${sampleData.touristName},</p>
<p style="font-size:16px;line-height:1.7;color:#262626;margin:0 0 24px 0;">Here's your content calendar for this week:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:24px 0;">
<tr style="background-color:#2D4231;">
<th style="padding:12px 16px;text-align:left;font-size:11px;color:#fff;text-transform:uppercase;">Day</th>
<th style="padding:12px 16px;text-align:left;font-size:11px;color:#fff;text-transform:uppercase;">Platform</th>
<th style="padding:12px 16px;text-align:left;font-size:11px;color:#fff;text-transform:uppercase;">Content</th>
</tr>
<tr style="border-bottom:1px solid rgba(168,195,175,0.2);">
<td style="padding:12px 16px;font-size:14px;">Monday</td>
<td style="padding:12px 16px;font-size:14px;">Instagram</td>
<td style="padding:12px 16px;font-size:14px;">🌅 Morning game drive photo</td>
</tr>
<tr style="border-bottom:1px solid rgba(168,195,175,0.2);">
<td style="padding:12px 16px;font-size:14px;">Wednesday</td>
<td style="padding:12px 16px;font-size:14px;">TikTok</td>
<td style="padding:12px 16px;font-size:14px;">🎬 Wildlife encounter reel</td>
</tr>
<tr>
<td style="padding:12px 16px;font-size:14px;">Friday</td>
<td style="padding:12px 16px;font-size:14px;">All Platforms</td>
<td style="padding:12px 16px;font-size:14px;">📋 Safari tips carousel</td>
</tr>
</table>
<table cellpadding="0" cellspacing="0" style="margin:32px 0;">
<tr><td style="background-color:#2D4231;border-radius:8px;">
<a href="https://safarizetu.com/content-calendar" style="display:inline-block;padding:16px 36px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;border-radius:8px;">View Full Calendar</a>
</td></tr></table>
</td></tr></table>
</td></tr></table>
</body></html>`
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
  console.log('Sending all Safari Zetu email templates to:', sampleData.email);
  console.log('================================================\n');

  let successCount = 0;
  let failCount = 0;

  for (const template of templates) {
    try {
      console.log(`Sending: ${template.name}...`);
      const result = await sendEmail(sampleData.email, template.subject, template.html);
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
    // Small delay between sends
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n================================================');
  console.log(`Results: ${successCount} sent, ${failCount} failed`);
  console.log(`Total templates: ${templates.length}`);
  console.log('\nCheck your inbox at:', sampleData.email);
}

sendAllTemplates().catch(console.error);
