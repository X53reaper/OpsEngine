import { wrapEmail, sectionHeader, bodyText, dataTable, infoCard, ctaButton, divider, PALETTES } from '../email-templates'

export function bookingConfirmationEmail(data: {
  touristName: string
  bookingId: string
  safariName: string
  operatorName: string
  travelDates: string
  partySize: number
  totalAmount: string
  depositPaid: string
  balanceDue: string
  bookingUrl: string
}): string {
  const content = `
    ${sectionHeader('Booking Confirmed', 'Your African adventure awaits')}
    ${bodyText(`Dear ${data.touristName},`)}
    ${bodyText(`Great news! Your safari booking has been confirmed. Here are your booking details:`)}
    ${dataTable(
      ['Detail', 'Information'],
      [
        ['Booking Reference', `#${data.bookingId}`],
        ['Safari', data.safariName],
        ['Operator', data.operatorName],
        ['Travel Dates', data.travelDates],
        ['Group Size', `${data.partySize} travelers`],
      ]
    )}
    ${divider()}
    ${infoCard(`Total: ${data.totalAmount} | Deposit Paid: ${data.depositPaid} | Balance Due: ${data.balanceDue}`)}
    ${bodyText('Please save this confirmation email. You can manage your booking and access all details through your dashboard.')}
    ${ctaButton('Manage Your Booking', data.bookingUrl)}
  `
  
  return wrapEmail(content, {
    preheader: `Your safari booking to ${data.safariName} has been confirmed!`,
    palette: 'heritage'
  })
}
