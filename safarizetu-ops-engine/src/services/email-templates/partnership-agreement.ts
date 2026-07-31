import { wrapEmail, sectionHeader, bodyText, keyValue, divider, PALETTES } from '../email-templates'

export function partnershipAgreementEmail(data: {
  partnerName: string
  agreementId: string
  startDate: string
  commissionRate: string
  terms: string[]
  signingUrl: string
}): string {
  const colors = PALETTES.midnight

  const content = `
    ${sectionHeader('Partnership Agreement', `Safari Zetu × ${data.partnerName}`, colors)}
    ${bodyText(`Dear ${data.partnerName},`, colors)}
    ${bodyText('Please review the partnership agreement below. Once signed, you will receive access to the operator dashboard.', colors)}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      ${keyValue('Agreement ID', data.agreementId, colors)}
      ${keyValue('Start Date', data.startDate, colors)}
      ${keyValue('Commission Rate', data.commissionRate, colors)}
    </table>
    ${divider(colors)}
    ${bodyText('Key Terms:', colors)}
    ${data.terms.map(t => bodyText(`• ${t}`, colors)).join('')}
  `

  return wrapEmail(content, {
    preheader: `Partnership Agreement — Safari Zetu × ${data.partnerName}`,
    palette: 'midnight'
  })
}
