import { wrapEmail, sectionHeader, bodyText, keyValue, divider, infoCard, PALETTES } from '../email-templates'

export function sentimentReportEmail(data: {
  period: string
  overallSentiment: string
  averageScore: number
  totalMentions: number
  positivePct: string
  negativePct: string
  topConcern: string
  topPraise: string
}): string {
  const colors = PALETTES.midnight

  const content = `
    ${sectionHeader('Weekly Sentiment Report', data.period, colors)}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      ${keyValue('Overall Sentiment', data.overallSentiment, colors)}
      ${keyValue('Average Score', `${data.averageScore}/10`, colors)}
      ${keyValue('Total Mentions', `${data.totalMentions}`, colors)}
    </table>
    ${divider(colors)}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      ${keyValue('Positive', data.positivePct, colors)}
      ${keyValue('Negative', data.negativePct, colors)}
    </table>
    ${divider(colors)}
    ${infoCard(`Top Praise: ${data.topPraise}`, colors)}
    ${infoCard(`Top Concern: ${data.topConcern}`, colors)}
  `

  return wrapEmail(content, {
    preheader: `Sentiment report: ${data.overallSentiment} — ${data.totalMentions} mentions analyzed`,
    palette: 'midnight'
  })
}
