import { wrapEmail, sectionHeader, bodyText, dataTable, keyValue, divider, infoCard, PALETTES } from '../email-templates'

export function operatorScorecardEmail(data: {
  operatorName: string
  period: string
  overallScore: number
  metrics: { name: string; score: number; trend: string }[]
  topStrength: string
  improvementArea: string
  dashboardUrl: string
}): string {
  const colors = PALETTES.midnight
  const rows = data.metrics.map(m => [m.name, `${m.score}/100`, m.trend])

  const content = `
    ${sectionHeader('Operator Scorecard', data.period, colors)}
    ${bodyText(`Hello ${data.operatorName},`)}
    ${bodyText(`Your overall performance score for ${data.period} is **${data.overallScore}/100**.`, colors)}
    ${dataTable(['Metric', 'Score', 'Trend'], rows, colors)}
    ${divider(colors)}
    ${infoCard(`Top Strength: ${data.topStrength}`, colors)}
    ${infoCard(`Area for Improvement: ${data.improvementArea}`, colors)}
    ${bodyText('Keep up the great work! Login to your dashboard for detailed analytics.', colors)}
  `

  return wrapEmail(content, {
    preheader: `Your operator scorecard for ${data.period} is ready — Score: ${data.overallScore}/100`,
    palette: 'midnight'
  })
}
