import { wrapEmail, sectionHeader, bodyText, infoCard, keyValue, PALETTES } from '../email-templates'

export function securityAlertEmail(data: {
  threatLevel: string
  summary: string
  affectedSystems: string[]
  recommendedActions: string[]
  timestamp: string
}): string {
  const colors = PALETTES.midnight
  const systemsList = data.affectedSystems.join(', ')

  const content = `
    ${sectionHeader('Security Alert', `${data.threatLevel.toUpperCase()} Threat`, colors)}
    ${bodyText(`A security event was detected at ${data.timestamp}.`, colors)}
    ${infoCard(data.summary, colors)}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      ${keyValue('Threat Level', data.threatLevel.toUpperCase(), colors)}
      ${keyValue('Affected Systems', systemsList, colors)}
    </table>
    ${bodyText('Recommended actions:', colors)}
    ${data.recommendedActions.map(a => bodyText(`• ${a}`, colors)).join('')}
  `

  return wrapEmail(content, {
    preheader: `Security Alert: ${data.threatLevel.toUpperCase()} — ${data.summary}`,
    palette: 'midnight'
  })
}
