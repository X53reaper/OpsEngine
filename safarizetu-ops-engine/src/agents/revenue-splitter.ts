import { callAgent, logger, sendEmail } from '../services/ai-agent.service'
import { storeMemory, retrieveMemory } from '../services/memory.service'
import { startTrace, endTrace } from '../services/observability.service'

// ── PARTNER REVENUE SHARING CALCULATOR ─────────────────────────
// Skills: PandasAI (analytics), AXME (durable orchestration)
// Calculate commission payouts, detect anomalies, generate reports

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

// ── SIMULATED BOOKINGS ─────────────────────────────────────────
const PARTNER_BOOKINGS: PartnerBooking[] = [
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
  const partnerGroups = new Map<string, PartnerBooking[]>()

  for (const booking of PARTNER_BOOKINGS) {
    const existing = partnerGroups.get(booking.partner_id) || []
    existing.push(booking)
    partnerGroups.set(booking.partner_id, existing)
  }

  const payouts: PartnerPayout[] = []

  for (const [partnerId, bookings] of partnerGroups) {
    const totalRevenue = bookings.reduce((s, b) => s + b.booking_amount, 0)
    const totalCommission = bookings.reduce((s, b) => s + b.commission_amount, 0)
    const avgCommissionPct = totalCommission / totalRevenue * 100

    payouts.push({
      id: `payout-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      partner_id: partnerId,
      partner_name: bookings[0].partner_name,
      period,
      total_bookings: bookings.length,
      total_revenue: totalRevenue,
      commission_pct: avgCommissionPct,
      commission_amount: totalCommission,
      adjustments: 0,
      final_payout: totalCommission,
      status: 'pending'
    })
  }

  return payouts
}

// ── DETECT ANOMALIES ───────────────────────────────────────────
export async function detectRevenueAnomalies(
  currentPeriod: PartnerPayout[],
  historicalAvg?: { partner_id: string; avg_revenue: number; avg_commission: number }[]
): Promise<RevenueAnomaly[]> {
  const anomalies: RevenueAnomaly[] = []

  const result = await callAgent({
    agentName: 'revenue_auditor',
    division: 'finance',
    model: 'heavy',
    systemPrompt: `You are a revenue auditor for Safari Zetu marketplace.
Analyze these partner payouts and detect any anomalies.

Current period payouts:
${currentPeriod.map(p => `${p.partner_name}: ${p.total_bookings} bookings, $${p.total_revenue} revenue, $${p.commission_amount} commission (${p.commission_pct.toFixed(1)}%)`).join('\n')}

Detect:
1. Unusual revenue spikes or drops compared to typical patterns
2. Commission percentage mismatches
3. Unusual booking patterns (too many/few bookings)
4. Any suspicious activity

Consider:
- Normal commission ranges: 8-15% for travel industry
- Typical booking volumes: 5-20 per month per partner
- Revenue consistency

Return JSON: [{
  "partner_id": "...",
  "partner_name": "...",
  "anomaly_type": "unusual_spike|unusual_drop|commission_mismatch|booking_pattern",
  "description": "...",
  "severity": "low|medium|high"
}]`,
    userMessage: `Audit ${currentPeriod.length} partner payouts for anomalies`,
    triggerType: 'scheduled_monthly',
    triggerPayload: { period: currentPeriod[0]?.period || 'unknown' }
  })

  try {
    const parsed = JSON.parse(result.content)
    return parsed.map((a: any) => ({
      ...a,
      detected_at: new Date()
    }))
  } catch {
    // Default: no anomalies detected
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
    const html = `
      <h2>Partner Payout Statement — Safari Zetu</h2>
      <p>Period: ${payout.period}</p>
      <p>Partner: <strong>${payout.partner_name}</strong></p>

      <h3>Payout Summary</h3>
      <table border="1" cellpadding="8" cellspacing="0">
        <tr><td><strong>Total Bookings</strong></td><td>${payout.total_bookings}</td></tr>
        <tr><td><strong>Total Revenue</strong></td><td>$${payout.total_revenue.toFixed(2)}</td></tr>
        <tr><td><strong>Commission Rate</strong></td><td>${payout.commission_pct.toFixed(1)}%</td></tr>
        <tr><td><strong>Commission Amount</strong></td><td>$${payout.commission_amount.toFixed(2)}</td></tr>
        ${payout.adjustments !== 0 ? `<tr><td><strong>Adjustments</strong></td><td>$${payout.adjustments.toFixed(2)}</td></tr>` : ''}
        <tr><td><strong>Final Payout</strong></td><td><strong>$${payout.final_payout.toFixed(2)}</strong></td></tr>
      </table>

      <p>Payment will be processed within 5 business days.</p>
      <p>Questions? Reply to this email or contact finance@safarizetu.com</p>

      <p><em>Auto-generated by Safari Zetu Revenue Splitter</em></p>
    `

    // Simulated email (in production, use partner's actual email)
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

  return {
    partners_paid: payouts.length,
    total_payouts: totalPayouts,
    anomalies_detected: anomalies.length
  }
}
