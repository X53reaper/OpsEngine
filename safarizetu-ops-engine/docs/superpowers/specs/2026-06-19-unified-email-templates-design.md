# Safari Zetu Unified Email Template System

**Date:** 2026-06-19
**Status:** Draft

## Problem

The ops engine has 26+ email templates with inconsistent styling:
- 17 templates are completely unstyled (raw `<h2>`, `<ul>`, `<table border="1">`)
- Only 2 templates use the brand color `#2c5530`
- 6 templates are LLM-generated with unpredictable styling
- No template system exists — everything is inline TypeScript strings

The user wants ALL emails (transactional, marketing, reports) to match the design language of the "Welcome to the Journal" email:
- Dark green header with Safari Zetu logo
- Warm beige/cream background
- Serif typography (Georgia/Playfair Display)
- Gold/amber accent color (`#c9a84c`)
- Elegant, minimal design
- Consistent footer with company info

## Solution

Create a **unified email template system** with:
1. **Base template wrapper** — header, footer, background, typography
2. **Content blocks** — reusable patterns for tables, lists, CTAs, alerts
3. **Theme variants** — transactional, marketing, report, alert
4. **Helper functions** — `wrapEmail()`, `tableBlock()`, `ctaButton()`, etc.
5. **LLM prompt updates** — inject styling guidelines into AI-generated emails

## Design

### Color Palette — Two Variants

#### Palette 1: Safari Heritage (Primary — Warm/Cream)
Used for: Enquiry emails, booking confirmations, newsletters, operator communications
```
Primary Green:    #172c1c (dark forest — header, footer)
Secondary Green:  #2c5530 (safari green — accents, links)
Gold Accent:      #c9a84c (warm gold — subtitles, highlights)
Background:       #f5f1eb (warm cream — email body)
Card Background:  #ffffff (white — content cards)
Text Primary:     #1a1a1a (near-black — body text)
Text Secondary:   #6b5f52 (warm gray — subtitles, captions)
Border:           #e2d9cf (warm beige — dividers, table borders)
```

#### Palette 2: Safari Midnight (Secondary — Dark/Luxury)
Used for: Revenue reports, pricing alerts, operator scorecards, premium communications
```
Primary Dark:     #1C1917 (premium black — header, footer)
Secondary Dark:   #44403C (charcoal — secondary elements)
Gold Accent:      #A16207 (rich amber — highlights, CTAs)
Background:       #FAFAF9 (off-white — email body)
Card Background:  #FFFFFF (white — content cards)
Text Primary:     #0C0A09 (near-black — body text)
Text Secondary:   #64748B (slate gray — subtitles, captions)
Border:           #D6D3D1 (warm gray — dividers, table borders)
Accent Glow:      #FDE68A (light gold — success states)
```

#### When to Use Each
| Email Type | Palette | Reason |
|------------|---------|--------|
| Enquiry Acknowledgement | Heritage | Warm, welcoming |
| Booking Confirmation | Heritage | Trust, comfort |
| Operator Activation | Heritage | Supportive, friendly |
| Invoice/Billing | Midnight | Professional, serious |
| Revenue Reports | Midnight | Data-focused, premium |
| Pricing Alerts | Midnight | Urgency, importance |
| Operator Scorecards | Midnight | Performance, prestige |
| Weekly Newsletter | Heritage | Engaging, personal |
| Security Alerts | Midnight | Serious, urgent |

### Typography
```
Headings:   Georgia, 'Times New Roman', serif
Body:       Georgia, 'Times New Roman', serif
Accent:     Arial, Helvetica, sans-serif (for small labels, caps)
```

### Base Template Structure
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f5f1eb;font-family:Georgia,'Times New Roman',serif;">
  <!-- Header -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#172c1c;">
    <tr>
      <td style="padding:24px 40px;">
        <!-- Logo + Brand -->
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:40px;height:40px;border-radius:50%;border:1.5px solid #ffffff;text-align:center;vertical-align:middle;">
              <span style="color:#ffffff;font-family:Georgia,serif;font-size:20px;">S</span>
            </td>
            <td style="padding-left:12px;">
              <span style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;letter-spacing:3px;text-transform:uppercase;font-weight:500;">SAFARI ZETU</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Content Area -->
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" align="center" style="background-color:#ffffff;border-radius:4px;">
          <tr>
            <td style="padding:48px 48px 32px 48px;">
              <!-- Email Content Here -->
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Footer -->
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding:32px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" align="center">
          <tr>
            <td style="text-align:center;padding-bottom:16px;">
              <span style="font-family:Georgia,serif;font-size:16px;color:#172c1c;font-weight:600;">Safari Zetu</span>
              <span style="color:#6b5f52;font-size:12px;"> — Zimbabwe's Premium Safari Marketplace</span>
            </td>
          </tr>
          <tr>
            <td style="text-align:center;padding-bottom:8px;">
              <a href="https://safarizetu.com" style="color:#c9a84c;font-size:12px;text-decoration:none;">safarizetu.com</a>
              <span style="color:#6b5f52;font-size:12px;"> | </span>
              <a href="mailto:support@safarizetu.com" style="color:#c9a84c;font-size:12px;text-decoration:none;">support@safarizetu.com</a>
            </td>
          </tr>
          <tr>
            <td style="text-align:center;padding-top:16px;border-top:1px solid #e2d9cf;">
              <p style="color:#6b5f52;font-size:10px;margin:0;">Safari Zetu Pvt Ltd — Registered in Zimbabwe</p>
              <p style="color:#6b5f52;font-size:10px;margin:8px 0 0 0;">
                <a href="{{unsubscribe_url}}" style="color:#c9a84c;text-decoration:none;">Unsubscribe from non-essential emails</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

### Content Block Patterns

#### Section Header
```html
<div style="margin-bottom:32px;">
  <h1 style="font-family:Georgia,serif;font-size:28px;color:#172c1c;font-weight:400;margin:0 0 8px 0;">{{title}}</h1>
  <div style="width:40px;height:2px;background-color:#c9a84c;margin-bottom:8px;"></div>
  <p style="font-family:Arial,sans-serif;font-size:11px;color:#c9a84c;text-transform:uppercase;letter-spacing:2px;margin:0;font-weight:600;">{{subtitle}}</p>
</div>
```

#### Body Text
```html
<p style="font-family:Georgia,serif;font-size:16px;line-height:1.7;color:#1a1a1a;margin:0 0 16px 0;">{{text}}</p>
```

#### Data Table
```html
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:24px 0;">
  <thead>
    <tr style="background-color:#172c1c;">
      {{#each headers}}
      <th style="padding:12px 16px;text-align:left;font-family:Arial,sans-serif;font-size:11px;color:#ffffff;text-transform:uppercase;letter-spacing:1px;font-weight:600;border-bottom:2px solid #c9a84c;">{{this}}</th>
      {{/each}}
    </tr>
  </thead>
  <tbody>
    {{#each rows}}
    <tr style="border-bottom:1px solid #e2d9cf;">
      {{#each this}}
      <td style="padding:12px 16px;font-family:Georgia,serif;font-size:14px;color:#1a1a1a;">{{this}}</td>
      {{/each}}
    </tr>
    {{/each}}
  </tbody>
</table>
```

#### CTA Button
```html
<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>
    <td style="background-color:#c9a84c;border-radius:4px;">
      <a href="{{url}}" style="display:inline-block;padding:14px 32px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#172c1c;text-decoration:none;">{{text}}</a>
    </td>
  </tr>
</table>
```

#### Info Card
```html
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f1eb;border-left:3px solid #c9a84c;margin:24px 0;">
  <tr>
    <td style="padding:20px 24px;">
      <p style="font-family:Georgia,serif;font-size:14px;color:#1a1a1a;line-height:1.6;margin:0;">{{text}}</p>
    </td>
  </tr>
</table>
```

#### Divider
```html
<table width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0;">
  <tr>
    <td style="border-top:1px solid #e2d9cf;"></td>
  </tr>
</table>
```

### Helper Functions (TypeScript)

```typescript
// src/services/email-templates.ts

export type EmailPalette = 'heritage' | 'midnight'

export const PALETTES = {
  heritage: {
    primaryGreen: '#172c1c',
    secondaryGreen: '#2c5530',
    goldAccent: '#c9a84c',
    background: '#f5f1eb',
    cardBackground: '#ffffff',
    textPrimary: '#1a1a1a',
    textSecondary: '#6b5f52',
    border: '#e2d9cf',
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

export const EMAIL_COLORS = PALETTES.heritage // default

export const EMAIL_FONTS = {
  heading: "Georgia, 'Times New Roman', serif",
  body: "Georgia, 'Times New Roman', serif",
  accent: "Arial, Helvetica, sans-serif",
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
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>` : ''}
</head>
<body style="margin:0;padding:0;background-color:${colors.background};font-family:${EMAIL_FONTS.body};">
  ${emailHeader(colors)}
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" align="center" style="background-color:${colors.cardBackground};border-radius:4px;">
          <tr>
            <td style="padding:48px 48px 32px 48px;">
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

export function emailHeader(colors = EMAIL_COLORS): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background-color:${colors.primaryGreen};">
  <tr>
    <td style="padding:24px 40px;">
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:40px;height:40px;border-radius:50%;border:1.5px solid #ffffff;text-align:center;vertical-align:middle;">
            <span style="color:#ffffff;font-family:Georgia,serif;font-size:20px;">S</span>
          </td>
          <td style="padding-left:12px;">
            <span style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;letter-spacing:3px;text-transform:uppercase;font-weight:500;">SAFARI ZETU</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
}

export function emailFooter(unsubscribeUrl: string = '#', colors = EMAIL_COLORS): string {
  return `<table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td style="padding:32px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" align="center">
        <tr>
          <td style="text-align:center;padding-bottom:16px;">
            <span style="font-family:Georgia,serif;font-size:16px;color:${colors.primaryGreen};font-weight:600;">Safari Zetu</span>
            <span style="color:${colors.textSecondary};font-size:12px;"> — Zimbabwe's Premium Safari Marketplace</span>
          </td>
        </tr>
        <tr>
          <td style="text-align:center;padding-bottom:8px;">
            <a href="https://safarizetu.com" style="color:${colors.goldAccent};font-size:12px;text-decoration:none;">safarizetu.com</a>
            <span style="color:${colors.textSecondary};font-size:12px;"> | </span>
            <a href="mailto:support@safarizetu.com" style="color:${colors.goldAccent};font-size:12px;text-decoration:none;">support@safarizetu.com</a>
          </td>
        </tr>
        <tr>
          <td style="text-align:center;padding-top:16px;border-top:1px solid ${colors.border};">
            <p style="color:${colors.textSecondary};font-size:10px;margin:0;">Safari Zetu Pvt Ltd — Registered in Zimbabwe</p>
            <p style="color:${colors.textSecondary};font-size:10px;margin:8px 0 0 0;">
              <a href="${unsubscribeUrl}" style="color:${colors.goldAccent};text-decoration:none;">Unsubscribe from non-essential emails</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
}

export function sectionHeader(title: string, subtitle?: string, colors = EMAIL_COLORS): string {
  return `<div style="margin-bottom:32px;">
  <h1 style="font-family:${EMAIL_FONTS.heading};font-size:28px;color:${colors.primaryGreen};font-weight:400;margin:0 0 8px 0;">${title}</h1>
  <div style="width:40px;height:2px;background-color:${colors.goldAccent};margin-bottom:8px;"></div>
  ${subtitle ? `<p style="font-family:${EMAIL_FONTS.accent};font-size:11px;color:${colors.goldAccent};text-transform:uppercase;letter-spacing:2px;margin:0;font-weight:600;">${subtitle}</p>` : ''}
</div>`
}

export function bodyText(text: string, colors = EMAIL_COLORS): string {
  return `<p style="font-family:${EMAIL_FONTS.body};font-size:16px;line-height:1.7;color:${colors.textPrimary};margin:0 0 16px 0;">${text}</p>`
}

export function dataTable(headers: string[], rows: string[][], colors = EMAIL_COLORS): string {
  const headerRow = headers.map(h => 
    `<th style="padding:12px 16px;text-align:left;font-family:${EMAIL_FONTS.accent};font-size:11px;color:#ffffff;text-transform:uppercase;letter-spacing:1px;font-weight:600;border-bottom:2px solid ${colors.goldAccent};">${h}</th>`
  ).join('')
  
  const bodyRows = rows.map(row => {
    const cells = row.map(cell => 
      `<td style="padding:12px 16px;font-family:${EMAIL_FONTS.body};font-size:14px;color:${colors.textPrimary};">${cell}</td>`
    ).join('')
    return `<tr style="border-bottom:1px solid ${colors.border};">${cells}</tr>`
  }).join('')
  
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:24px 0;">
  <thead>
    <tr style="background-color:${colors.primaryGreen};">${headerRow}</tr>
  </thead>
  <tbody>${bodyRows}</tbody>
</table>`
}

export function ctaButton(text: string, url: string, colors = EMAIL_COLORS): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>
    <td style="background-color:${colors.goldAccent};border-radius:4px;">
      <a href="${url}" style="display:inline-block;padding:14px 32px;font-family:${EMAIL_FONTS.accent};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${colors.primaryGreen};text-decoration:none;">${text}</a>
    </td>
  </tr>
</table>`
}

export function infoCard(text: string, colors = EMAIL_COLORS): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background-color:${colors.background};border-left:3px solid ${colors.goldAccent};margin:24px 0;">
  <tr>
    <td style="padding:20px 24px;">
      <p style="font-family:${EMAIL_FONTS.body};font-size:14px;color:${colors.textPrimary};line-height:1.6;margin:0;">${text}</p>
    </td>
  </tr>
</table>`
}

export function divider(colors = EMAIL_COLORS): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0;">
  <tr>
    <td style="border-top:1px solid ${colors.border};"></td>
  </tr>
</table>`
}

export function keyValue(key: string, value: string, colors = EMAIL_COLORS): string {
  return `<div style="margin-bottom:12px;">
  <span style="font-family:${EMAIL_FONTS.accent};font-size:11px;color:${colors.textSecondary};text-transform:uppercase;letter-spacing:1px;">${key}</span>
  <p style="font-family:${EMAIL_FONTS.body};font-size:16px;color:${colors.textPrimary};margin:4px 0 0 0;">${value}</p>
</div>`
}
```

### Email Type Templates

All emails will use `wrapEmail()` with different content blocks:

1. **Enquiry Acknowledgement** — sectionHeader + bodyText + keyValues + ctaButton
2. **Booking Confirmation** — sectionHeader + dataTable + infoCard + ctaButton
3. **Operator Activation** — sectionHeader + bodyText + progressIndicator + ctaButton
4. **Invoice** — sectionHeader + dataTable + keyValue + divider + keyValue
5. **Weekly Report** — sectionHeader + dataTable + bodyText
6. **Security Alert** — sectionHeader + infoCard(alert) + bodyText
7. **Newsletter** — sectionHeader + bodyText + ctaButton
8. **Review Request** — sectionHeader + bodyText + ctaButton

### LLM Prompt Updates

For AI-generated emails, the prompts will be updated to include styling guidelines:

```
STYLE GUIDELINES (CRITICAL):
- Output ONLY the inner HTML content (no <html>, <head>, <body> tags)
- Use ONLY these inline styles:
  - Font: font-family:Georgia,serif
  - Headings: color:#172c1c; font-size:28px; font-weight:400
  - Body: color:#1a1a1a; font-size:16px; line-height:1.7
  - Accent: color:#c9a84c; font-size:11px; text-transform:uppercase; letter-spacing:2px
  - Links: color:#c9a84c; text-decoration:none
- Do NOT use CSS classes, <style> blocks, or external stylesheets
- Keep HTML simple and email-client compatible
- Maximum 300 words
```

**Midnight Palette Variant** (for reports/alerts):
```
- Headings: color:#1C1917 (premium black)
- Body: color:#0C0A09
- Accent: color:#A16207 (rich amber)
- Links: color:#A16207
- Table headers: background-color:#1C1917
- Dividers: border-color:#D6D3D1
```

## Implementation Plan

1. Create `src/services/email-templates.ts` with all helper functions
2. Update each agent to use the template helpers
3. Update LLM prompts to include styling guidelines
4. Test with Resend to verify rendering
5. Update the 6 AI-generated email prompts

## Files to Modify

- `src/services/email-templates.ts` (NEW)
- `src/agents/division1-growth.ts` — enquiry acknowledgement, operator activation
- `src/agents/booking-bot.ts` — booking confirmation
- `src/agents/billing-agent.ts` — invoice
- `src/agents/revenue-analytics.ts` — weekly revenue report
- `src/agents/dynamic-pricing.ts` — daily pricing report
- `src/agents/chatbot-trainer.ts` — training report
- `src/agents/revenue-splitter.ts` — partner payout
- `src/agents/operator-scorer.ts` — operator scorecard
- `src/agents/social-content.ts` — content calendar
- `src/agents/sentiment-tracker.ts` — weekly sentiment report
- `src/agents/inventory-manager.ts` — inventory alert
- `src/agents/sustainability-tracker.ts` — sustainability report
- `src/agents/market-researcher.ts` — market expansion report
- `src/agents/security-monitor.ts` — security alert
- `src/agents/onboarding-flow.ts` — onboarding emails
- `src/agents/contract-generator.ts` — contract email wrapper
- `src/scheduler/mailing-cron.ts` — newsletter, re-engagement, operator digest
- `src/agents/prompts/index.ts` — LLM prompt styling guidelines
