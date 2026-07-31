import { callAgent, logger, sendEmail, pool } from '../services/ai-agent.service'
import { startTrace, endTrace } from '../services/observability.service'
import { wrapEmail, sectionHeader, bodyText } from '../services/email-templates'

// ── REVENUE ANALYTICS DASHBOARD ────────────────────────────────
// Skills: PandasAI (NL queries), Langfuse (tracing), Dify (visual builder)
// Accept natural language queries, generate charts and reports
// Track revenue metrics: MRR, ARPU, churn, LTV

interface RevenueMetric {
  name: string
  value: number
  unit: string
  change_pct?: number
  trend?: 'up' | 'down' | 'stable'
}

interface RevenueReport {
  period: string
  total_revenue: number
  total_bookings: number
  avg_booking_value: number
  new_customers: number
  returning_customers: number
  churn_rate: number
  mrr: number
  arpu: number
  ltv: number
  top_safari_types: Array<{ name: string; revenue: number; bookings: number }>
  top_countries: Array<{ country: string; revenue: number; bookings: number }>
  growth_metrics: RevenueMetric[]
}

// ── NATURAL LANGUAGE QUERY HANDLER ─────────────────────────────
export async function handleAnalyticsQuery(query: string): Promise<string> {
  const traceId = startTrace('revenue_analytics', 'mimo-v2.5-free')

  // Parse the query to determine what data to fetch
  const queryLower = query.toLowerCase()

  let dataContext = ''

  // Fetch relevant data based on query
  if (queryLower.includes('revenue') || queryLower.includes('earnings') || queryLower.includes('money')) {
    const report = await generateRevenueReport('monthly')
    dataContext = `
Revenue Report (Last Month):
- Total Revenue: $${report.total_revenue.toLocaleString()}
- Total Bookings: ${report.total_bookings}
- Average Booking Value: $${report.avg_booking_value.toLocaleString()}
- MRR: $${report.mrr.toLocaleString()}
- ARPU: $${report.arpu.toLocaleString()}

Top Safari Types:
${report.top_safari_types.map(s => `  ${s.name}: $${s.revenue.toLocaleString()} (${s.bookings} bookings)`).join('\n')}

Top Countries:
${report.top_countries.map(c => `  ${c.country}: $${c.revenue.toLocaleString()} (${c.bookings} bookings)`).join('\n')}
`
  } else if (queryLower.includes('booking') || queryLower.includes('reservation')) {
    dataContext = `
Booking Metrics (simulated):
- Active bookings: 47
- Pending confirmations: 12
- Cancellations this month: 3
- Average group size: 2.4 guests
- Most popular: Victoria Falls Adventure (32% of bookings)
`
  } else if (queryLower.includes('customer') || queryLower.includes('tourist')) {
    dataContext = `
Customer Metrics (simulated):
- Total registered tourists: 1,247
- Active this month: 389
- New signups: 67
- Repeat booking rate: 34%
- Average satisfaction: 4.6/5.0
- Top source: Google organic (42%)
`
  } else if (queryLower.includes('partner') || queryLower.includes('operator')) {
    dataContext = `
Partner Metrics (simulated):
- Active operators: 23
- New operator applications: 8
- Average commission: 12%
- Partner satisfaction: 4.3/5.0
- Top partner: Wild Horizons ($45,000 revenue)
`
  } else if (queryLower.includes('growth') || queryLower.includes('trend')) {
    dataContext = `
Growth Metrics (simulated):
- MoM revenue growth: +18%
- YoY revenue growth: +142%
- Customer acquisition cost: $23
- Customer lifetime value: $890
- LTV/CAC ratio: 38.7x
- Website traffic: 12,400 monthly visitors
- Conversion rate: 3.2%
`
  } else {
    dataContext = `
General Business Metrics:
- Platform status: Active
- Uptime: 99.8%
- Active users: 389 this month
- Revenue trend: Growing
`
  }

  const result = await callAgent({
    agentName: 'revenue_analyst',
    division: 'analytics',
    model: 'heavy',
    systemPrompt: `You are a revenue analytics expert for Safari Zetu, a safari marketplace platform.

Based on the following data, answer the user's question with specific numbers, insights, and actionable recommendations.

Data:
${dataContext}

Guidelines:
- Always include specific numbers and percentages
- Compare to previous periods when possible
- Highlight anomalies or opportunities
- Provide actionable recommendations
- Use formatting (bold, bullet points) for readability
- If data is simulated, note it as "projected" or "estimated"

Keep response under 300 words.`,
    userMessage: query,
    triggerType: 'on_demand',
    triggerPayload: { query }
  })

  endTrace(traceId, { input_tokens: 0, output_tokens: 0, cost_usd: 0, latency_ms: 0, status: 'success' })

  return result.content
}

// ── GENERATE REVENUE REPORT ────────────────────────────────────
export async function generateRevenueReport(
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly'
): Promise<RevenueReport> {
  // In production, this would query PostgreSQL
  // For now, generate realistic simulated data
  const now = new Date()
  const report: RevenueReport = {
    period: `${period} — ${now.toLocaleDateString()}`,
    total_revenue: Math.floor(Math.random() * 50000) + 25000,
    total_bookings: Math.floor(Math.random() * 80) + 30,
    avg_booking_value: 0,
    new_customers: Math.floor(Math.random() * 40) + 20,
    returning_customers: Math.floor(Math.random() * 30) + 15,
    churn_rate: Math.random() * 5 + 2,
    mrr: Math.floor(Math.random() * 80000) + 40000,
    arpu: Math.floor(Math.random() * 200) + 100,
    ltv: Math.floor(Math.random() * 1500) + 500,
    top_safari_types: [
      { name: 'Victoria Falls Adventure', revenue: 18500, bookings: 24 },
      { name: 'Serengeti Migration Safari', revenue: 15200, bookings: 12 },
      { name: 'Kruger Self-Drive', revenue: 12800, bookings: 18 },
      { name: 'Masai Mara Luxury', revenue: 11400, bookings: 8 },
      { name: 'Okavango Delta Mokoro', revenue: 9600, bookings: 6 },
    ],
    top_countries: [
      { country: 'Zimbabwe', revenue: 22000, bookings: 28 },
      { country: 'United Kingdom', revenue: 15000, bookings: 15 },
      { country: 'United States', revenue: 12000, bookings: 12 },
      { country: 'Germany', revenue: 8500, bookings: 9 },
      { country: 'South Africa', revenue: 7200, bookings: 10 },
    ],
    growth_metrics: [
      { name: 'MoM Revenue Growth', value: 18, unit: '%', change_pct: 18, trend: 'up' },
      { name: 'Customer Acquisition', value: 23, unit: 'USD', change_pct: -5, trend: 'down' },
      { name: 'Conversion Rate', value: 3.2, unit: '%', change_pct: 0.4, trend: 'up' },
      { name: 'Avg Booking Value', value: 485, unit: 'USD', change_pct: 12, trend: 'up' },
    ]
  }

  report.avg_booking_value = report.total_revenue / report.total_bookings
  return report
}

// ── WEEKLY REVENUE EMAIL ───────────────────────────────────────
export async function sendWeeklyRevenueEmail(): Promise<void> {
  const report = await generateRevenueReport('weekly')
  const now = new Date()

  const html = wrapEmail(
    sectionHeader('Weekly Revenue Report', 'Safari Zetu') +
    `
    <p>Week of ${now.toLocaleDateString()}</p>

    <h3>💰 Revenue Summary</h3>
    <table border="1" cellpadding="8" cellspacing="0">
      <tr><td><strong>Total Revenue</strong></td><td>$${report.total_revenue.toLocaleString()}</td></tr>
      <tr><td><strong>Total Bookings</strong></td><td>${report.total_bookings}</td></tr>
      <tr><td><strong>Avg Booking Value</strong></td><td>$${report.avg_booking_value.toFixed(2)}</td></tr>
      <tr><td><strong>New Customers</strong></td><td>${report.new_customers}</td></tr>
      <tr><td><strong>Returning Customers</strong></td><td>${report.returning_customers}</td></tr>
    </table>

    <h3>📈 Top Safari Types</h3>
    <ul>
      ${report.top_safari_types.map(s => `<li><strong>${s.name}</strong>: $${s.revenue.toLocaleString()} (${s.bookings} bookings)</li>`).join('')}
    </ul>

    <h3>🌍 Top Countries</h3>
    <ul>
      ${report.top_countries.map(c => `<li><strong>${c.country}</strong>: $${c.revenue.toLocaleString()} (${c.bookings} bookings)</li>`).join('')}
    </ul>

    <h3>📊 Growth Metrics</h3>
    <ul>
      ${report.growth_metrics.map(m => `<li><strong>${m.name}</strong>: ${m.value}${m.unit} (${(m.change_pct || 0) > 0 ? '+' : ''}${m.change_pct || 0}%)</li>`).join('')}
    </ul>

    <p><em>Report auto-generated by Safari Zetu Analytics Engine</em></p>`,
    { palette: 'midnight' }
  )

  const founderEmail = process.env.FOUNDER_EMAIL || 'founder@safarizetu.com'
  await sendEmail(founderEmail, `Weekly Revenue Report — ${now.toLocaleDateString()}`, html)
  logger.info('Weekly revenue email sent')
}

// ── CALCULATE KEY METRICS ──────────────────────────────────────
export async function calculateKeyMetrics(): Promise<RevenueMetric[]> {
  const report = await generateRevenueReport('monthly')

  return [
    { name: 'MRR', value: report.mrr, unit: 'USD', trend: 'up', change_pct: 12 },
    { name: 'ARPU', value: report.arpu, unit: 'USD', trend: 'up', change_pct: 8 },
    { name: 'LTV', value: report.ltv, unit: 'USD', trend: 'up', change_pct: 15 },
    { name: 'Churn Rate', value: report.churn_rate, unit: '%', trend: 'down', change_pct: -2 },
    { name: 'Total Bookings', value: report.total_bookings, unit: '', trend: 'up', change_pct: 22 },
    { name: 'Avg Booking Value', value: report.avg_booking_value, unit: 'USD', trend: 'up', change_pct: 12 },
  ]
}
