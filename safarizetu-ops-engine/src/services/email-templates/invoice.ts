import { wrapEmail, sectionHeader, bodyText, dataTable, keyValue, divider, PALETTES } from '../email-templates'

export function invoiceEmail(data: {
  recipientName: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  lineItems: { description: string; amount: string }[]
  subtotal: string
  commission: string
  total: string
  paymentUrl: string
}): string {
  const colors = PALETTES.midnight
  const rows = data.lineItems.map(item => [item.description, item.amount])

  const content = `
    ${sectionHeader('Invoice', `#${data.invoiceNumber}`, colors)}
    ${bodyText(`Dear ${data.recipientName},`, colors)}
    ${bodyText('Please find your invoice details below.', colors)}
    ${dataTable(['Description', 'Amount'], rows, colors)}
    ${divider(colors)}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      ${keyValue('Subtotal', data.subtotal, colors)}
      ${keyValue('Commission (15%)', data.commission, colors)}
      ${keyValue('Total Due', data.total, colors)}
      ${keyValue('Due Date', data.dueDate, colors)}
    </table>
  `

  return wrapEmail(content, {
    preheader: `Invoice #${data.invoiceNumber} — Total: ${data.total}`,
    palette: 'midnight'
  })
}
