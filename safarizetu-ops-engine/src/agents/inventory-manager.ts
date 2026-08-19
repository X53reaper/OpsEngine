import { callAgent, pool, isDbConnected, logger, sendEmail } from '../services/ai-agent.service'
import { startTrace, endTrace } from '../services/observability.service'
import { wrapEmail, sectionHeader, bodyText } from '../services/email-templates'

// ── INVENTORY MANAGEMENT AGENT ─────────────────────────────────
// Queries PostgreSQL inventory_items, inventory_availability, inventory_alerts tables

interface InventoryItem {
  id: string
  item_type: 'lodge' | 'vehicle' | 'equipment' | 'guide' | 'activity'
  name: string
  description?: string
  location: string
  capacity: number
  status: 'available' | 'booked' | 'maintenance' | 'retired'
  daily_rate?: number
  operating_cost?: number
}

interface AvailabilitySlot {
  item_id: string
  date: string
  available_count: number
  booked_count: number
  blocked: boolean
}

interface InventoryAlert {
  item_id: string
  item_name: string
  alert_type: 'shortage' | 'overbooking' | 'maintenance_due' | 'low_stock' | 'price_change'
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
}

// ── MOCK DATA ──────────────────────────────────────────────────
const MOCK_INVENTORY: InventoryItem[] = [
  { id: 'lodge-1', item_type: 'lodge', name: 'Victoria Falls Lodge', location: 'Victoria Falls', capacity: 20, status: 'available', daily_rate: 350 },
  { id: 'lodge-2', item_type: 'lodge', name: 'Hwange Safari Camp', location: 'Hwange', capacity: 12, status: 'available', daily_rate: 280 },
  { id: 'lodge-3', item_type: 'lodge', name: 'Mana Pools Retreat', location: 'Mana Pools', capacity: 8, status: 'available', daily_rate: 400 },
  { id: 'vehicle-1', item_type: 'vehicle', name: 'Safari Land Cruiser #1', location: 'Victoria Falls', capacity: 7, status: 'available', daily_rate: 150 },
  { id: 'vehicle-2', item_type: 'vehicle', name: 'Safari Land Cruiser #2', location: 'Hwange', capacity: 7, status: 'available', daily_rate: 150 },
  { id: 'vehicle-3', item_type: 'vehicle', name: 'Minibus Transfer', location: 'Victoria Falls', capacity: 14, status: 'available', daily_rate: 100 },
  { id: 'guide-1', item_type: 'guide', name: 'Tendai Moyo', location: 'Victoria Falls', capacity: 1, status: 'available', daily_rate: 80 },
  { id: 'guide-2', item_type: 'guide', name: 'Chipo Ndlovu', location: 'Hwange', capacity: 1, status: 'available', daily_rate: 80 },
  { id: 'equip-1', item_type: 'equipment', name: 'Binoculars Set (10)', location: 'Victoria Falls', capacity: 10, status: 'available', daily_rate: 15 },
  { id: 'equip-2', item_type: 'equipment', name: 'Camera Lens Kit', location: 'Victoria Falls', capacity: 5, status: 'available', daily_rate: 25 },
]

// ── CHECK AVAILABILITY ─────────────────────────────────────────
export async function checkAvailability(
  itemType?: string,
  date?: string,
  location?: string
): Promise<AvailabilitySlot[]> {
  let items: InventoryItem[] = []

  if (isDbConnected()) {
    try {
      let query = 'SELECT * FROM inventory_items'
      const conditions: string[] = []
      const params: any[] = []

      if (itemType) { params.push(itemType); conditions.push(`item_type = $${params.length}`) }
      if (location) { params.push(`%${location}%`); conditions.push(`location ILIKE $${params.length}`) }

      if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ')
      query += ' ORDER BY created_at DESC'

      const { rows } = await pool.query(query, params)
      items = rows.map((r: any) => ({
        id: r.id, item_type: r.item_type, name: r.name, description: r.description,
        location: r.location, capacity: Number(r.capacity), status: r.status,
        daily_rate: r.daily_rate ? Number(r.daily_rate) : undefined,
        operating_cost: r.operating_cost ? Number(r.operating_cost) : undefined
      }))
    } catch (error: any) {
      logger.error(`Failed to query inventory items: ${error.message}`)
    }
  }

  if (items.length === 0) items = MOCK_INVENTORY
  if (itemType) items = items.filter(i => i.item_type === itemType)
  if (location) items = items.filter(i => i.location.toLowerCase().includes(location.toLowerCase()))

  const targetDate = date || new Date().toISOString().split('T')[0]

  const slots: AvailabilitySlot[] = []

  if (isDbConnected() && items.length > 0) {
    try {
      const itemIds = items.map(i => i.id)
      const { rows: availRows } = await pool.query(
        `SELECT * FROM inventory_availability WHERE item_id = ANY($1) AND date = $2`,
        [itemIds, targetDate]
      )

      const availMap = new Map<string, any>()
      for (const row of availRows) availMap.set(row.item_id, row)

      for (const item of items) {
        const avail = availMap.get(item.id)
        if (avail) {
          slots.push({
            item_id: item.id, date: targetDate,
            available_count: Number(avail.available_count),
            booked_count: Number(avail.booked_count),
            blocked: avail.blocked
          })
        } else {
          slots.push({
            item_id: item.id, date: targetDate,
            available_count: item.status === 'available' ? item.capacity : 0,
            booked_count: item.status === 'booked' ? item.capacity : 0,
            blocked: item.status === 'maintenance'
          })
        }
      }
      return slots
    } catch (error: any) {
      logger.error(`Failed to query availability: ${error.message}`)
    }
  }

  // Fallback for mock mode
  for (const item of items) {
    slots.push({
      item_id: item.id, date: targetDate,
      available_count: item.status === 'available' ? item.capacity : 0,
      booked_count: item.status === 'booked' ? item.capacity : 0,
      blocked: item.status === 'maintenance'
    })
  }
  return slots
}

// ── DETECT SHORTAGES ───────────────────────────────────────────
export async function detectShortages(
  checkDate: string,
  location?: string
): Promise<InventoryAlert[]> {
  const slots = await checkAvailability(undefined, checkDate, location)
  const allItems = MOCK_INVENTORY // needed for item lookup
  const alerts: InventoryAlert[] = []

  for (const slot of slots) {
    // Try to find item from DB or mock
    let item: InventoryItem | undefined

    if (isDbConnected()) {
      try {
        const { rows } = await pool.query(`SELECT * FROM inventory_items WHERE id = $1`, [slot.item_id])
        if (rows.length > 0) {
          item = { id: rows[0].id, item_type: rows[0].item_type, name: rows[0].name, location: rows[0].location, capacity: Number(rows[0].capacity), status: rows[0].status }
        }
      } catch { /* fall through */ }
    }
    if (!item) item = allItems.find(i => i.id === slot.item_id)
    if (!item) continue

    if (slot.available_count <= 2 && slot.available_count > 0) {
      alerts.push({
        item_id: slot.item_id, item_name: item.name, alert_type: 'shortage',
        message: `Only ${slot.available_count} ${item.item_type}(s) available at ${item.location} on ${checkDate}`,
        severity: slot.available_count === 1 ? 'high' : 'medium'
      })
    }
    if (slot.booked_count > item.capacity) {
      alerts.push({
        item_id: slot.item_id, item_name: item.name, alert_type: 'overbooking',
        message: `${item.name} is overbooked: ${slot.booked_count}/${item.capacity} capacity`,
        severity: 'critical'
      })
    }
  }

  // Persist alerts to DB
  if (isDbConnected() && alerts.length > 0) {
    try {
      for (const alert of alerts) {
        await pool.query(
          `INSERT INTO inventory_alerts (item_id, alert_type, message, severity)
           VALUES ($1, $2, $3, $4)`,
          [alert.item_id, alert.alert_type, alert.message, alert.severity]
        )
      }
    } catch (error: any) {
      logger.error(`Failed to persist inventory alerts: ${error.message}`)
    }
  }

  return alerts
}

// ── PREDICT DEMAND ─────────────────────────────────────────────
export async function predictDemand(
  safariType: string,
  daysAhead: number = 30
): Promise<{
  predicted_bookings: number
  peak_dates: string[]
  recommended_inventory: number
  confidence: number
}> {
  const result = await callAgent({
    agentName: 'demand_predictor',
    division: 'operations',
    model: 'heavy',
    systemPrompt: `You are a demand prediction agent for Safari Zetu.
Predict booking demand for the next ${daysAhead} days for: ${safariType}

Consider seasonality (peak: Jun-Oct, shoulder: Mar-May, low: Nov-Feb), day of week patterns, holiday periods, and historical trends (assume 15% YoY growth).

Return JSON: {
  "predicted_bookings": number, "peak_dates": ["date1"], "recommended_inventory": number, "confidence": number
}`,
    userMessage: `Predict demand for ${safariType} over next ${daysAhead} days`,
    triggerType: 'scheduled_weekly',
    triggerPayload: { safari_type: safariType, days_ahead: daysAhead }
  })

  try {
    return JSON.parse(result.content)
  } catch {
    return { predicted_bookings: 15, peak_dates: [], recommended_inventory: 4, confidence: 65 }
  }
}

// ── GENERATE INVENTORY REPORT ───────────────────────────────────
export async function generateInventoryReport(): Promise<string> {
  const slots = await checkAvailability()
  const alerts = await detectShortages(new Date().toISOString().split('T')[0])

  let items: InventoryItem[] = MOCK_INVENTORY
  if (isDbConnected()) {
    try {
      const { rows } = await pool.query(`SELECT * FROM inventory_items ORDER BY item_type, name`)
      items = rows.map((r: any) => ({
        id: r.id, item_type: r.item_type, name: r.name, description: r.description,
        location: r.location, capacity: Number(r.capacity), status: r.status,
        daily_rate: r.daily_rate ? Number(r.daily_rate) : undefined
      }))
    } catch { /* use mock */ }
  }

  const byType = new Map<string, InventoryItem[]>()
  for (const item of items) {
    const existing = byType.get(item.item_type) || []
    existing.push(item)
    byType.set(item.item_type, existing)
  }

  let report = `📊 Inventory Report — ${new Date().toLocaleDateString()}\n\n`
  for (const [type, typeItems] of byType) {
    const available = typeItems.filter(i => i.status === 'available').length
    const booked = typeItems.filter(i => i.status === 'booked').length
    const maintenance = typeItems.filter(i => i.status === 'maintenance').length
    report += `${type.toUpperCase()} (${typeItems.length} total)\n`
    report += `  Available: ${available} | Booked: ${booked} | Maintenance: ${maintenance}\n`
    for (const item of typeItems) {
      report += `  • ${item.name} @ ${item.location}: ${item.status} (${item.capacity} capacity)\n`
    }
    report += '\n'
  }
  if (alerts.length > 0) {
    report += `⚠️ ALERTS (${alerts.length})\n`
    for (const alert of alerts) {
      report += `  [${alert.severity.toUpperCase()}] ${alert.item_name}: ${alert.message}\n`
    }
  }
  return report
}

// ── SEND INVENTORY ALERTS ──────────────────────────────────────
export async function sendInventoryAlerts(alerts: InventoryAlert[]): Promise<void> {
  if (alerts.length === 0) return
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' || a.severity === 'high')
  if (criticalAlerts.length === 0) return

  const html = wrapEmail(
    sectionHeader('Inventory Alerts', 'Safari Zetu') + `
    <p>Generated: ${new Date().toLocaleString()}</p>
    <h3>Critical/High Priority Alerts</h3>
    <ul>${criticalAlerts.map(a => `<li><strong>[${a.severity.toUpperCase()}]</strong> ${a.item_name}<br>${a.message}</li>`).join('')}</ul>
    <p><em>Auto-generated by Safari Zetu Inventory Agent</em></p>`,
    { palette: 'midnight' }
  )

  const opsEmail = process.env.OPS_EMAIL || 'ops@safarizetu.com'
  await sendEmail(opsEmail, `Inventory Alert — ${criticalAlerts.length} Critical Items`, html)
  logger.info(`Inventory alerts sent: ${criticalAlerts.length} critical`)
}

// ── DAILY INVENTORY CHECK ──────────────────────────────────────
export async function runDailyInventoryCheck(): Promise<{
  items_checked: number
  shortages: number
  alerts: number
}> {
  const traceId = startTrace('daily_inventory', 'mimo-v2.5-free')
  const slots = await checkAvailability()
  const alerts = await detectShortages(new Date().toISOString().split('T')[0])

  if (alerts.length > 0) await sendInventoryAlerts(alerts)

  endTrace(traceId, { input_tokens: 0, output_tokens: 0, cost_usd: 0, latency_ms: 0, status: 'success' })
  logger.info(`Inventory check: ${slots.length} items, ${alerts.length} alerts`)

  return {
    items_checked: slots.length,
    shortages: alerts.filter(a => a.alert_type === 'shortage').length,
    alerts: alerts.length
  }
}
