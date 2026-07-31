export type EmailPalette = 'heritage' | 'midnight'

export interface EmailColors {
  primaryGreen: string
  secondaryGreen: string
  goldAccent: string
  background: string
  cardBackground: string
  textPrimary: string
  textSecondary: string
  border: string
}

export const PALETTES: Record<EmailPalette, EmailColors> = {
  heritage: {
    primaryGreen: '#2D4231',
    secondaryGreen: '#4e6451',
    goldAccent: '#B37038',
    background: '#F5F2E9',
    cardBackground: '#ffffff',
    textPrimary: '#262626',
    textSecondary: '#737972',
    border: 'rgba(168,195,175,0.2)',
  },
  midnight: {
    primaryGreen: '#1C1917',
    secondaryGreen: '#44403C',
    goldAccent: '#A16207',
    background: '#FAFAF9',
    cardBackground: '#ffffff',
    textPrimary: '#0C0A09',
    textSecondary: '#64748B',
    border: '#D6D3D1',
  }
}

export const EMAIL_COLORS = PALETTES.heritage

export const EMAIL_FONTS = {
  heading: "'Playfair Display', Georgia, 'Times New Roman', serif",
  body: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  accent: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}

export function wrapEmail(content: string, options?: {
  preheader?: string
  unsubscribeUrl?: string
  palette?: EmailPalette
}): string {
  const preheader = options?.preheader || ''
  const unsubUrl = options?.unsubscribeUrl || '#'
  const colors = PALETTES[options?.palette || 'heritage']
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Safari Zetu</title>
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>` : ''}
</head>
<body style="margin:0;padding:0;background-color:${colors.background};font-family:${EMAIL_FONTS.body};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${colors.background};padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          ${emailHeader(colors)}
          <tr>
            <td style="background-color:${colors.cardBackground};padding:48px 40px;border-radius:0 0 12px 12px;">
              ${content}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  ${emailFooter(unsubUrl, colors)}
</body>
</html>`
}

export function emailHeader(colors: EmailColors = EMAIL_COLORS): string {
  return `<tr>
    <td style="background-color:${colors.primaryGreen};padding:32px 40px;border-radius:12px 12px 0 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
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
      </table>
    </td>
  </tr>`
}

export function emailFooter(unsubscribeUrl: string = '#', colors: EmailColors = EMAIL_COLORS): string {
  return `<table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td style="padding:32px 0 0 0;text-align:center;">
      <p style="font-size:13px;color:#737972;margin:0 0 8px 0;font-family:${EMAIL_FONTS.body};">Safari Zetu — Zimbabwe's Premium Safari Marketplace</p>
      <p style="font-size:13px;color:#737972;margin:0 0 8px 0;font-family:${EMAIL_FONTS.body};">
        <a href="https://safarizetu.com" style="color:${colors.goldAccent};text-decoration:none;">safarizetu.com</a>
        &nbsp;|&nbsp;
        <a href="mailto:support@safarizetu.com" style="color:${colors.goldAccent};text-decoration:none;">support@safarizetu.com</a>
      </p>
      <p style="font-size:12px;color:#a8c3af;margin:16px 0 0 0;font-family:${EMAIL_FONTS.body};">
        Centcom Technologies Pvt Ltd &middot; Registered in Zimbabwe
      </p>
      <p style="font-size:12px;color:#a8c3af;margin:8px 0 0 0;font-family:${EMAIL_FONTS.body};">
        You are receiving this email because you have an account with Safari Zetu.<br />
        <a href="${unsubscribeUrl}" style="color:#a8c3af;">Unsubscribe from non-essential emails</a>
      </p>
    </td>
  </tr>
</table>`
}

export function sectionHeader(title: string, subtitle?: string, colors: EmailColors = EMAIL_COLORS): string {
  return `<div style="margin-bottom:32px;">
  <h1 style="font-family:${EMAIL_FONTS.heading};font-style:italic;font-weight:400;font-size:28px;color:${colors.primaryGreen};margin:0 0 8px 0;">${title}</h1>
  ${subtitle ? `<p style="font-family:${EMAIL_FONTS.accent};font-size:13px;font-weight:600;color:${colors.goldAccent};text-transform:uppercase;letter-spacing:0.1em;margin:0 0 32px 0;">${subtitle}</p>` : '<div style="width:40px;height:2px;background-color:' + colors.goldAccent + ';margin-bottom:8px;"></div>'}
</div>`
}

export function bodyText(text: string, colors: EmailColors = EMAIL_COLORS): string {
  return `<p style="font-family:${EMAIL_FONTS.body};font-size:16px;line-height:1.7;color:${colors.textPrimary};margin:0 0 24px 0;">${text}</p>`
}

export function dataTable(headers: string[], rows: string[][], colors: EmailColors = EMAIL_COLORS): string {
  const headerRow = headers.map(h => 
    `<th style="padding:12px 16px;text-align:left;font-family:${EMAIL_FONTS.accent};font-size:11px;color:#ffffff;text-transform:uppercase;letter-spacing:1px;font-weight:600;border-bottom:2px solid ${colors.goldAccent};">${h}</th>`
  ).join('')
  
  const bodyRows = rows.map(row => {
    const cells = row.map(cell => 
      `<td style="padding:12px 16px;font-family:${EMAIL_FONTS.body};font-size:14px;color:${colors.textPrimary};">${cell}</td>`
    ).join('')
    return `<tr style="border-bottom:1px solid ${colors.border};">${cells}</tr>`
  }).join('')
  
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:24px 0;border-radius:8px;overflow:hidden;">
  <thead>
    <tr style="background-color:${colors.primaryGreen};">${headerRow}</tr>
  </thead>
  <tbody>${bodyRows}</tbody>
</table>`
}

export function ctaButton(text: string, url: string, colors: EmailColors = EMAIL_COLORS): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:32px 0;">
  <tr>
    <td style="background-color:${colors.primaryGreen};border-radius:8px;padding:0;">
      <a href="${url}" style="display:inline-block;padding:16px 36px;font-family:${EMAIL_FONTS.accent};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.02em;border-radius:8px;">${text}</a>
    </td>
  </tr>
</table>`
}

export function infoCard(text: string, colors: EmailColors = EMAIL_COLORS): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background-color:${colors.background};border-left:3px solid ${colors.goldAccent};margin:24px 0;border-radius:0 8px 8px 0;">
  <tr>
    <td style="padding:20px 24px;">
      <p style="font-family:${EMAIL_FONTS.body};font-size:15px;color:${colors.textPrimary};line-height:1.7;margin:0;">${text}</p>
    </td>
  </tr>
</table>`
}

export function divider(colors: EmailColors = EMAIL_COLORS): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0;">
  <tr>
    <td style="border-top:1px solid ${colors.border};"></td>
  </tr>
</table>`
}

export function keyValue(key: string, value: string, colors: EmailColors = EMAIL_COLORS): string {
  return `<tr>
    <td style="padding:8px 0;border-bottom:1px solid ${colors.border};">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:12px;font-weight:600;color:${colors.textSecondary};text-transform:uppercase;letter-spacing:0.08em;width:40%;padding:8px 0;font-family:${EMAIL_FONTS.accent};">${key}</td>
          <td style="font-size:15px;color:${colors.textPrimary};width:};width:60%;padding:8px 0;font-family:${EMAIL_FONTS.body};">${value}</td>
        </tr>
      </table>
    </td>
  </tr>`
}

// Re-export template functions
export { enquiryAcknowledgementEmail } from './email-templates/enquiry-acknowledgement'
export { bookingConfirmationEmail } from './email-templates/booking-confirmation'
export { revenueReportEmail } from './email-templates/revenue-report'
export { invoiceEmail } from './email-templates/invoice'
