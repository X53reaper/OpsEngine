import { wrapEmail, sectionHeader, bodyText, dataTable, infoCard, PALETTES } from '../email-templates'

export function inventoryAlertEmail(data: {
  criticalCount: number
  lowCount: number
  criticalItems: { name: string; available: number; status: string }[]
  dashboardUrl: string
}): string {
  const colors = PALETTES.midnight
  const rows = data.criticalItems.map(i => [i.name, `${i.available}`, i.status])

  const content = `
    ${sectionHeader('Inventory Alert', `${data.criticalCount} Critical Items`, colors)}
    ${bodyText(`Attention: ${data.criticalCount} items are critically low and ${data.lowCount} items are running low.`, colors)}
    ${dataTable(['Item', 'Available', 'Status'], rows, colors)}
    ${infoCard('Action required: Update availability or adjust pricing for affected items.', colors)}
  `

  return wrapEmail(content, {
    preheader: `${data.criticalCount} critical inventory items need attention`,
    palette: 'midnight'
  })
}
