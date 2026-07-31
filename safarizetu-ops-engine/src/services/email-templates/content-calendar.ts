import { wrapEmail, sectionHeader, bodyText, dataTable, PALETTES } from '../email-templates'

export function contentCalendarEmail(data: {
  month: string
  entries: { platform: string; topic: string; scheduledDate: string; status: string }[]
  totalCount: number
}): string {
  const colors = PALETTES.heritage
  const rows = data.entries.map(e => [e.platform, e.topic, e.scheduledDate, e.status])

  const content = `
    ${sectionHeader('Content Calendar', data.month, colors)}
    ${bodyText(`${data.totalCount} pieces of content scheduled for ${data.month}.`, colors)}
    ${dataTable(['Platform', 'Topic', 'Date', 'Status'], rows, colors)}
  `

  return wrapEmail(content, {
    preheader: `${data.totalCount} content pieces scheduled for ${data.month}`,
    palette: 'heritage'
  })
}
