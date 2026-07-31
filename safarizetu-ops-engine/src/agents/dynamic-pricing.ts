import { callAgent, logger, sendEmail } from '../services/ai-agent.service'
import { storeMemory, retrieveMemory } from '../services/memory.service'
import { queryCollection, upsertDocuments } from '../services/chroma.service'
import { startTrace, endTrace } from '../services/observability.service'
import { wrapEmail, sectionHeader, bodyText } from '../services/email-templates'

// ── DYNAMIC PRICING AGENT ──────────────────────────────────────
// Skills: PandasAI (analytics), GPT-Researcher (market research), Browser-Use (monitoring)
// Monitors competitor pricing, demand signals, seasonality
// Generates pricing recommendations per safari type

interface PricingData {
  safari_type: string
  competitor_name: string
  competitor_price: number
  our_price: number
  currency: string
  demand_index: number
  season: 'peak' | 'shoulder' | 'low'
  occupancy_rate: number
}

interface PricingRecommendation {
  safari_type: string
  current_price: number
  recommended_price: number
  change_pct: number
  reasoning: string
  urgency: 'low' | 'medium' | 'high'
  competitor_comparison: string
  demand_outlook: string
}

interface PricingAlert {
  safari_type: string
  alert_type: 'price_drop' | 'price_increase' | 'demand_spike' | 'demand_drop' | 'competitor_change'
  message: string
  recommended_action: string
  urgency: 'low' | 'medium' | 'high' | 'critical'
}

// ── SAFARI TYPES TO MONITOR ────────────────────────────────────
const SAFARI_TYPES = [
  'Victoria Falls Adventure',
  'Serengeti Migration Safari',
  'Kruger National Park Self-Drive',
  'Masai Mara Luxury Lodge',
  'Okavango Delta Mokoro',
  'Hwange Walking Safari',
  'Zimbabwe Cultural Tour',
  'Gorilla Trekking Rwanda',
  'Namibia Desert Safari',
  'Madagascar Wildlife Expedition'
]

// ── COMPETITOR SITES (Simulated) ───────────────────────────────
const COMPETITOR_SITES = [
  { name: 'SafariBookings', url: 'https://www.safaribookings.com' },
  { name: 'G Adventures', url: 'https://www.gadventures.com' },
  { name: 'Intrepid Travel', url: 'https://www.intrepidtravel.com' },
  { name: 'Abercrombie & Kent', url: 'https://www.abercrombiekent.com' },
  { name: 'Wilderness Safaris', url: 'https://www.wilderness-safaris.com' },
]

// ── MONITOR COMPETITOR PRICES ──────────────────────────────────
export async function monitorCompetitorPrices(): Promise<PricingData[]> {
  const results: PricingData[] = []

  for (const safariType of SAFARI_TYPES.slice(0, 3)) { // Limit to 3 for free tier
    const result = await callAgent({
      agentName: 'price_researcher',
      division: 'operations',
      model: 'light',
      systemPrompt: `You are a market research agent for Safari Zetu.
Research competitor pricing for: ${safariType}

For each competitor, provide:
- competitor_name: Name of the competitor
- competitor_price: Their price in USD for a similar experience
- demand_index: 0-100 demand level for this safari type
- season: current season (peak, shoulder, low)
- occupancy_rate: estimated occupancy 0-1

Generate data for 3-5 competitors. Return JSON array:
[{"competitor_name": "...", "competitor_price": 0, "demand_index": 0, "season": "peak", "occupancy_rate": 0}]

Return ONLY valid JSON array.`,
      userMessage: `Research competitor prices for ${safariType} safari experiences in Africa.`,
      triggerType: 'scheduled_daily',
      triggerPayload: { safari_type: safariType }
    })

    try {
      const parsed = JSON.parse(result.content)
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          results.push({
            safari_type: safariType,
            competitor_name: item.competitor_name || 'Unknown',
            competitor_price: item.competitor_price || 0,
            our_price: 0, // Will be filled from our catalog
            currency: 'USD',
            demand_index: item.demand_index || 50,
            season: item.season || 'shoulder',
            occupancy_rate: item.occupancy_rate || 0.5
          })
        }
      }
    } catch (e) {
      logger.warn(`Failed to parse pricing for ${safariType}: ${e}`)
    }
  }

  // Store in Chroma for trend analysis
  await upsertDocuments('pricing-history', results.map((r, i) => ({
    id: `price-${Date.now()}-${i}`,
    text: `${r.safari_type} at ${r.competitor_name}: $${r.competitor_price} (demand: ${r.demand_index}, season: ${r.season})`,
    metadata: { safari_type: r.safari_type, competitor: r.competitor_name, price: r.competitor_price }
  })))

  logger.info(`Monitored ${results.length} competitor prices`)
  return results
}

// ── GENERATE PRICING RECOMMENDATIONS ───────────────────────────
export async function generatePricingRecommendations(
  pricingData: PricingData[]
): Promise<PricingRecommendation[]> {
  const recommendations: PricingRecommendation[] = []

  // Group by safari type
  const byType = new Map<string, PricingData[]>()
  for (const p of pricingData) {
    const existing = byType.get(p.safari_type) || []
    existing.push(p)
    byType.set(p.safari_type, existing)
  }

  for (const [safariType, data] of byType) {
    const avgCompetitorPrice = data.reduce((s, d) => s + d.competitor_price, 0) / data.length
    const avgDemand = data.reduce((s, d) => s + d.demand_index, 0) / data.length
    const season = data[0]?.season || 'shoulder'

    const result = await callAgent({
      agentName: 'pricing_advisor',
      division: 'operations',
      model: 'heavy',
      systemPrompt: `You are a dynamic pricing advisor for Safari Zetu, a safari marketplace.

Analyze this pricing data and recommend an optimal price:

Safari Type: ${safariType}
Average Competitor Price: $${avgCompetitorPrice.toFixed(2)}
Current Demand Index: ${avgDemand.toFixed(0)}/100
Season: ${season}
Competitor prices: ${data.map(d => `${d.competitor_name}: $${d.competitor_price}`).join(', ')}

Pricing strategy:
- Peak season: price 10-20% above competitors (premium positioning)
- Shoulder season: price at or slightly below competitors
- Low season: price 15-25% below competitors (drive volume)
- High demand: increase price 5-15%
- Low demand: offer promotions

Return JSON: {
  "recommended_price": number,
  "change_pct": number (percent change from current),
  "reasoning": "explanation",
  "urgency": "low|medium|high",
  "competitor_comparison": "how we compare",
  "demand_outlook": "predicted demand trend"
}`,
      userMessage: `Recommend pricing for ${safariType} based on competitor analysis.`,
      triggerType: 'scheduled_daily',
      triggerPayload: { safari_type: safariType }
    })

    try {
      const parsed = JSON.parse(result.content)
      recommendations.push({
        safari_type: safariType,
        current_price: data[0]?.our_price || 0,
        recommended_price: parsed.recommended_price || 0,
        change_pct: parsed.change_pct || 0,
        reasoning: parsed.reasoning || '',
        urgency: parsed.urgency || 'medium',
        competitor_comparison: parsed.competitor_comparison || '',
        demand_outlook: parsed.demand_outlook || ''
      })
    } catch {
      recommendations.push({
        safari_type: safariType,
        current_price: data[0]?.our_price || 0,
        recommended_price: avgCompetitorPrice * 1.1,
        change_pct: 0,
        reasoning: result.content,
        urgency: 'medium',
        competitor_comparison: `Average competitor: $${avgCompetitorPrice.toFixed(2)}`,
        demand_outlook: `Demand index: ${avgDemand.toFixed(0)}/100`
      })
    }
  }

  return recommendations
}

// ── GENERATE PRICING ALERTS ────────────────────────────────────
export function generatePricingAlerts(recommendations: PricingRecommendation[]): PricingAlert[] {
  const alerts: PricingAlert[] = []

  for (const rec of recommendations) {
    if (Math.abs(rec.change_pct) > 15) {
      alerts.push({
        safari_type: rec.safari_type,
        alert_type: rec.change_pct > 0 ? 'price_increase' : 'price_drop',
        message: `${rec.safari_type}: Recommended ${rec.change_pct > 0 ? 'increase' : 'decrease'} of ${Math.abs(rec.change_pct).toFixed(1)}%`,
        recommended_action: rec.reasoning,
        urgency: rec.urgency
      })
    }

    if (rec.demand_outlook.toLowerCase().includes('spike') || rec.demand_outlook.toLowerCase().includes('surge')) {
      alerts.push({
        safari_type: rec.safari_type,
        alert_type: 'demand_spike',
        message: `Demand spike detected for ${rec.safari_type}`,
        recommended_action: 'Consider increasing price by 10-15%',
        urgency: 'high'
      })
    }
  }

  return alerts
}

// ── SEND PRICING REPORT ────────────────────────────────────────
export async function sendPricingReport(
  recommendations: PricingRecommendation[],
  alerts: PricingAlert[]
): Promise<void> {
  const reportHtml = wrapEmail(
    sectionHeader('Daily Pricing Report', 'Safari Zetu') +
    `
    <p>Generated: ${new Date().toISOString()}</p>

    <h3>📊 Pricing Recommendations</h3>
    <table border="1" cellpadding="8" cellspacing="0">
      <tr>
        <th>Safari Type</th>
        <th>Current</th>
        <th>Recommended</th>
        <th>Change</th>
        <th>Urgency</th>
      </tr>
      ${recommendations.map(r => `
        <tr>
          <td>${r.safari_type}</td>
          <td>$${r.current_price.toFixed(2)}</td>
          <td>$${r.recommended_price.toFixed(2)}</td>
          <td>${r.change_pct > 0 ? '+' : ''}${r.change_pct.toFixed(1)}%</td>
          <td>${r.urgency}</td>
        </tr>
      `).join('')}
    </table>

    ${alerts.length > 0 ? `
      <h3>⚠️ Alerts</h3>
      <ul>
        ${alerts.map(a => `<li><strong>${a.safari_type}</strong>: ${a.message}</li>`).join('')}
      </ul>
    ` : '<p>No critical alerts.</p>'}

    <h3>💡 Demand Outlook</h3>
    ${recommendations.map(r => `
      <p><strong>${r.safari_type}</strong>: ${r.demand_outlook}</p>
    `).join('')}`,
    { palette: 'midnight' }
  )

  const founderEmail = process.env.FOUNDER_EMAIL || 'founder@safarizetu.com'
  await sendEmail(founderEmail, `Daily Pricing Report — ${new Date().toLocaleDateString()}`, reportHtml)
  logger.info('Pricing report sent to founder')
}

// ── DAILY PRICING RUN ──────────────────────────────────────────
export async function runDailyPricing(): Promise<{
  competitors_monitored: number
  recommendations: number
  alerts: number
}> {
  const traceId = startTrace('daily_pricing', 'mimo-v2.5-free')

  const pricingData = await monitorCompetitorPrices()
  const recommendations = await generatePricingRecommendations(pricingData)
  const alerts = generatePricingAlerts(recommendations)

  if (recommendations.length > 0) {
    await sendPricingReport(recommendations, alerts)
  }

  endTrace(traceId, { input_tokens: 0, output_tokens: 0, cost_usd: 0, latency_ms: 0, status: 'success' })

  logger.info(`Daily pricing: ${pricingData.length} competitors, ${recommendations.length} recommendations, ${alerts.length} alerts`)
  return {
    competitors_monitored: pricingData.length,
    recommendations: recommendations.length,
    alerts: alerts.length
  }
}
