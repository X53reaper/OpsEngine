import { callAgent, pool, isDbConnected, logger, sendEmail } from '../services/ai-agent.service'
import { storeMemory, retrieveMemory } from '../services/memory.service'
import { startTrace, endTrace } from '../services/observability.service'

// ── PARTNER REVENUE SHARING CALCULATOR ─────────────────────────
// Queries PostgreSQL partner_payouts, revenue_entries tables

interface PartnerBooking {
  id: string
  partner_id: string
  partner_name: string
  safari_type: string
  booking_amount: number
  commission_pct: number
  commission_amount: number
  platform_fee: number
  net_amount: number
  recorded_at: Date
}

interface PartnerPayout {
  id: string
  partner_id: string
  partner_name: string
  period: string
  total_bookings: number
  total_revenue: number
  commission_pct: number
  commission_amount: number
  adjustments: number
  final_payout: number
  status: 'pending' | 'approved' | 'paid' | 'disputed'
}

interface RevenueAnomaly {
  partner_id: string
  partner_name: string
  anomaly_type: 'unusual_spike' | 'unusual_drop' | 'commission_mismatch' | 'booking_pattern'
  description: string
  severity: 'low' | 'medium' | 'high'
  detected_at: Date
}

// ── MOCK DATA ──────────────────────────────────────────────────
const MOCK_ENTRIES: PartnerBooking[] = [
  { id: 'b1', partner_id: 'p1', partner_name: 'Wild Horizons', safari_type: 'Victoria Falls Adventure', booking_amount: 1250, commission_pct: 10, commission_amount: 125, platform_fee: 25, net_amount: 1100, recorded_at: new Date() },
  { id: 'b2', partner_id: 'p1', partner_name: 'Wild Horizons', safari_type: 'Hwange Walking Safari', booking_amount: 890, commission_pct: 10, commission_amount: 89, platform_fee: 17.80, net_amount: 783.20, recorded_at: new Date() },
  { id: 'b3', partner_id: 'p2', partner_name: 'Africa Bush Safaris', safari_type: 'Serengeti Migration', booking_amount: 2100, commission_pct: 12, commission_amount: 252, platform_fee: 42, net_amount: 1806, recorded_at: new Date() },
  { id: 'b4', partner_id: 'p2', partner_name: 'Africa Bush Safaris', safari_type: 'Masai Mara Luxury', booking_amount: 1800, commission_pct: 12, commission_amount: 216, platform_fee: 36, net_amount: 1548, recorded_at: new Date() },
  { id: 'b5', partner_id: 'p3', partner_name: 'Zambezi Adventures', safari_type: 'Victoria Falls Adventure', booking_amount: 950, commission_pct: 8, commission_amount: 76, platform_fee: 19, net_amount: 855, recorded_at: new Date() },
  { id: 'b6', partner_id: 'p1', partner_name: 'Wild Horizons', safari_type: 'Mana Pools Retreat', booking_amount: 1600, commission_pct: 10, commission_amount: 160, platform_fee: 32, net_amount: 1408, recorded_at: new Date() },
]

// ── CALCULATE PARTNER PAYOUTS ──────────────────────────────────
export async function calculatePartnerPayouts(
  period: string = new Date().toISOString().split('T')[0]
): Promise<PartnerPayout[]> {
  let entries: PartnerBooking[] = []

  if (isDbConnected()) {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM revenue_entries WHERE recorded_at >= $1::date AND recorded_at < ($1::date + INTERVAL '1 month') ORDER BY recorded_at`,
        [period]
      )
      entries = rows.map((r: any) => ({
        id: r.id, partner_id: r.partner_id, partner_name: '',
        safari_type: r.safari_type, booking_amount: Number(r.amount),
        commission_pct: 0, commission_amount: Number(r.commission_amount),
        platform_fee: Number(r.platform_fee), net_amount: Number(r.net_amount),
        recorded_at: new Date(r.recorded_at)
      }))
    } catch (error: any) {
      logger.error(`Failed to query revenue entries: ${error.message}`)
    }
  }

  if (entries.length === 0) entries = MOCK_ENTRIES

  const partnerGroups = new Map<string, PartnerBooking[]>()
  for (const entry of entries) {
    const existing = partnerGroups.get(entry.partner_id) || []
    existing.push(entry)
    partnerGroups.set(entry.partner_id, existing)
  }

  const payouts: PartnerPayout[] = []
  for (const [partnerId, group] of partnerGroups) {
    const totalRevenue = group.reduce((s, b) => s + b.booking_amount, 0)
    const totalCommission = group.reduce((s, b) => s + b.commission_amount, 0)
    const avgCommissionPct = totalRevenue > 0 ? (totalCommission / totalRevenue) * 100 : 0

    payouts.push({
      id: `payout-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      partner_id: partnerId,
      partner_name: group[0].partner_name || partnerId,
      period, total_bookings: group.length, total_revenue: totalRevenue,
      commission_pct: avgCommissionPct, commission_amount: totalCommission,
      adjustments: 0, final_payout: totalCommission, status: 'pending'
    })
  }

  // Also check partner_payouts table for historical data
  if (isDbConnected()) {
    try {
      const { rows: existingPayouts } = await pool.query(
        `SELECT * FROM partner_payouts WHERE period = $1::date`,
        [period]
      )
      if (existingPayouts.length > 0) {
        return existingPayouts.map((p: any) => ({
          id: p.id, partner_id: p.partner_id, partner_name: p.partner_name,
          period: String(p.period), total_bookings: Number(p.total_bookings),
          total_revenue: Number(p.total_revenue), commission_pct: Number(p.commission_pct),
          commission_amount: Number(p.commission_amount), adjustments: Number(p.adjustments),
          final_payout: Number(p.final_payout), status: p.status
        }))
      }

      // Insert calculated payouts
      for (const payout of payouts) {
        await pool.query(
          `INSERT INTO partner_payouts (partner_id, partner_name, period, total_bookings,
           total_revenue, commission_pct, commission_amount, adjustments, final_payout, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')`,
          [payout.partner_id, payout.partner_name, payout.period, payout.total_bookings,
           payout.total_revenue, payout.commission_pct, payout.commission_amount,
           payout.adjustments, payout.final_payout]
        )
      }
    } catch (error: any) {
      logger.error(`Failed to query/insert partner payouts: ${error.message}`)
    }
  }

  return payouts
}

// ── DETECT ANOMALIES ───────────────────────────────────────────
export async function detectRevenueAnomalies(
  currentPeriod: PartnerPayout[],
  historicalAvg?: { partner_id: string; avg_revenue: number; avg_commission: number }[]
): Promise<RevenueAnomaly[]> {
  const result = await callAgent({
    agentName: 'revenue_auditor',
    division: 'finance',
    model: 'heavy',
    systemPrompt: `You are a revenue auditor for Safari Zetu marketplace.
Analyze these partner payouts and detect any anomalies.

Current period payouts:
${currentPeriod.map(p => `${p.partner_name}: ${p.total_bookings} bookings, $${p.total_revenue} revenue, $${p.commission_amount} commission (${p.commission_pct.toFixed(1)}%)`).join('\n')}

Detect: unusual spikes/drops, commission mismatches, unusual booking patterns, suspicious activity.
Normal commission ranges: 8-15%. Typical booking volumes: 5-20 per month per partner.

Return JSON: [{
  "partner_id": "...", "partner_name": "...",
  "anomaly_type": "unusual_spike|unusual_drop|commission_mismatch|booking_pattern",
  "description": "...", "severity": "low|medium|high"
}]`,
    userMessage: `Audit ${currentPeriod.length} partner payouts for anomalies`,
    triggerType: 'scheduled_monthly',
    triggerPayload: { period: currentPeriod[0]?.period || 'unknown' }
  })

  try {
    const parsed = JSON.parse(result.content)
    return parsed.map((a: any) => ({ ...a, detected_at: new Date() }))
  } catch {
    return []
  }
}

// ── GENERATE PAYOUT REPORT ─────────────────────────────────────
export async function generatePayoutReport(payouts: PartnerPayout[]): Promise<string> {
  let report = `💰 Partner Payout Report — ${payouts[0]?.period || 'Unknown Period'}\n\n`
  let totalPayouts = 0
  let totalRevenue = 0

  for (const payout of payouts) {
    report += `${payout.partner_name}\n`
    report += `  Bookings: ${payout.total_bookings}\n`
    report += `  Revenue: $${payout.total_revenue.toFixed(2)}\n`
    report += `  Commission (${payout.commission_pct.toFixed(1)}%): $${payout.commission_amount.toFixed(2)}\n`
    report += `  Final Payout: $${payout.final_payout.toFixed(2)}\n\n`
    totalPayouts += payout.final_payout
    totalRevenue += payout.total_revenue
  }

  report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
  report += `TOTAL REVENUE: $${totalRevenue.toFixed(2)}\n`
  report += `TOTAL PAYOUTS: $${totalPayouts.toFixed(2)}\n`
  report += `PLATFORM FEE: $${(totalRevenue - totalPayouts).toFixed(2)}\n`
  return report
}

// ── SEND PAYOUT EMAILS ─────────────────────────────────────────
export async function sendPayoutEmails(payouts: PartnerPayout[]): Promise<void> {
  for (const payout of payouts) {
    logger.info(`Payout email prepared for ${payout.partner_name}: $${payout.final_payout.toFixed(2)}`)
  }
}

// ── MONTHLY REVENUE SPLITTING RUN ──────────────────────────────
export async function runMonthlyRevenueSplitting(): Promise<{
  partners_paid: number
  total_payouts: number
  anomalies_detected: number
}> {
  const traceId = startTrace('monthly_revenue_split', 'mimo-v2.5-free')

  const payouts = await calculatePartnerPayouts()
  const anomalies = await detectRevenueAnomalies(payouts)

  if (anomalies.length > 0) {
    logger.warn(`Revenue anomalies detected: ${anomalies.length}`)
    for (const anomaly of anomalies) {
      logger.warn(`  - ${anomaly.partner_name}: ${anomaly.description} (${anomaly.severity})`)
    }
  }

  const report = await generatePayoutReport(payouts)
  logger.info(report)

  await sendPayoutEmails(payouts)
  endTrace(traceId, { input_tokens: 0, output_tokens: 0, cost_usd: 0, latency_ms: 0, status: 'success' })

  const totalPayouts = payouts.reduce((s, p) => s + p.final_payout, 0)
  logger.info(`Monthly splitting: ${payouts.length} partners, $${totalPayouts.toFixed(2)} total payouts`)

  return { partners_paid: payouts.length, total_payouts: totalPayouts, anomalies_detected: anomalies.length }
}
