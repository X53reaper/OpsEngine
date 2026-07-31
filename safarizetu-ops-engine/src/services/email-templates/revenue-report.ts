import { wrapEmail, sectionHeader, bodyText, dataTable, keyValue, divider, PALETTES } from '../email-templates'

export function revenueReportEmail(data: {
  operatorName: string
  reportPeriod: string
  totalRevenue: string
  bookingsCount: number
  averageBookingValue: string
  topSafari: string
  conversionRate: string
  commissionOwed: string
}): string {
  const colors = PALETTES.midnight

  const content = `
    ${sectionHeader('Weekly Revenue Report', data.reportPeriod, colors)}
    ${bodyText(`Hello ${data.operatorName},`)}
    ${bodyText(`Here's your revenue performance summary for ${data.reportPeriod}.`)}
    ${dataTable(
      ['Metric', 'Value'],
      [
        ['Total Revenue', data.totalRevenue],
        ['Bookings', `${data.bookingsCount}`],
        ['Average Booking', data.averageBookingValue],
        ['Top Safari', data.topSafari],
        ['Conversion Rate', data.conversionRate],
      ],
      colors
    )}
    ${divider(colors)}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      ${keyValue('Commission Owed', data.commissionOwed, colors)}
    </table>
    ${bodyText('Keep up the great work! Your safari experiences are making a difference for travelers from around the world.', colors)}
  `

  return wrapEmail(content, {
    preheader: `Your revenue report for ${data.reportPeriod} is ready.`,
    palette: 'midnight'
  })
}
