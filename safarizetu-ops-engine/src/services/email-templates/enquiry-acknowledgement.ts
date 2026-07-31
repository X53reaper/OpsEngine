import { wrapEmail, sectionHeader, bodyText, keyValue, ctaButton, PALETTES } from '../email-templates'

export function enquiryAcknowledgementEmail(data: {
  touristName: string
  enquiryId: string
  destination: string
  travelDates: string
  partySize: number
  enquiryUrl: string
}): string {
  const content = `
    ${sectionHeader('Thank You for Your Enquiry', 'We\'re on it')}
    ${bodyText(`Dear ${data.touristName},`)}
    ${bodyText(`We've received your enquiry about ${data.destination} and our team is already working on finding the perfect safari experience for you.`)}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      ${keyValue('Enquiry Reference', `#${data.enquiryId}`)}
      ${keyValue('Destination', data.destination)}
      ${keyValue('Travel Dates', data.travelDates)}
      ${keyValue('Group Size', `${data.partySize} travelers`)}
    </table>
    ${bodyText('Our safari specialists will review your requirements and get back to you within 24 hours with personalized recommendations.')}
    ${ctaButton('View Your Enquiry', data.enquiryUrl)}
  `
  
  return wrapEmail(content, {
    preheader: `We've received your enquiry about ${data.destination} and our team is on it.`,
    palette: 'heritage'
  })
}
