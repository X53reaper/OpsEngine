import { callAgent, logger, sendEmail } from '../services/ai-agent.service'
import { invoiceEmail } from '../services/email-templates'
import { storeMemory, retrieveMemory } from '../services/memory.service'
import { startTrace, endTrace } from '../services/observability.service'

// ── MULTI-TENANT BILLING AGENT ─────────────────────────────────
// Skills: AXME (durable orchestration), LangChain (chains)
// Usage metering, subscription management, invoice generation

interface Tenant {
  id: string
  name: string
  email: string
  plan: 'free' | 'starter' | 'pro' | 'enterprise'
  status: 'active' | 'suspended' | 'cancelled' | 'trial'
}

interface Subscription {
  id: string
  tenant_id: string
  plan: string
  monthly_price: number
  api_calls_limit: number
  bookings_limit: number
  current_period_start: Date
  current_period_end: Date
  status: string
}

interface UsageRecord {
  tenant_id: string
  metric_name: string
  metric_value: number
}

interface Invoice {
  id: string
  tenant_id: string
  invoice_number: string
  amount: number
  currency: string
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  due_date: Date
  line_items: Array<{ description: string; quantity: number; unit_price: number; total: number }>
}

// ── PLAN PRICING ───────────────────────────────────────────────
const PLAN_PRICING: Record<string, { price: number; api_limit: number; bookings_limit: number }> = {
  free: { price: 0, api_limit: 100, bookings_limit: 10 },
  starter: { price: 49, api_limit: 1000, bookings_limit: 100 },
  pro: { price: 149, api_limit: 10000, bookings_limit: 500 },
  enterprise: { price: 499, api_limit: 100000, bookings_limit: 5000 }
}

// ── RECORD USAGE ───────────────────────────────────────────────
export async function recordUsage(
  tenantId: string,
  metricName: string,
  value: number
): Promise<void> {
  await storeMemory(tenantId, 'conversation_context', `usage_${metricName}_${Date.now()}`, String(value))
  logger.info(`Usage recorded: tenant=${tenantId}, metric=${metricName}, value=${value}`)
}

// ── CHECK USAGE LIMITS ─────────────────────────────────────────
export async function checkUsageLimits(
  tenantId: string
): Promise<{
  within_limits: boolean
  api_calls: { used: number; limit: number; pct: number }
  bookings: { used: number; limit: number; pct: number }
  upgrade_recommended: string | null
}> {
  // Simulated usage data
  const apiCalls = Math.floor(Math.random() * 500) + 100
  const bookings = Math.floor(Math.random() * 30) + 5
  const plan = 'starter' as string // Simulated
  const limits = PLAN_PRICING[plan as keyof typeof PLAN_PRICING] || PLAN_PRICING.starter

  const apiPct = (apiCalls / limits.api_limit) * 100
  const bookingsPct = (bookings / limits.bookings_limit) * 100

  let upgradeRecommended: string | null = null
  if (apiPct > 80 || bookingsPct > 80) {
    if (plan === 'free') upgradeRecommended = 'starter'
    else if (plan === 'starter') upgradeRecommended = 'pro'
    else if (plan === 'pro') upgradeRecommended = 'enterprise'
  }

  return {
    within_limits: apiCalls <= limits.api_limit && bookings <= limits.bookings_limit,
    api_calls: { used: apiCalls, limit: limits.api_limit, pct: apiPct },
    bookings: { used: bookings, limit: limits.bookings_limit, pct: bookingsPct },
    upgrade_recommended: upgradeRecommended
  }
}

// ── GENERATE INVOICE ───────────────────────────────────────────
export async function generateInvoice(
  tenantId: string,
  tenantName: string,
  plan: string,
  usage: { api_calls: number; bookings: number; overage_api: number; overage_bookings: number }
): Promise<Invoice> {
  const pricing = PLAN_PRICING[plan] || PLAN_PRICING.starter

  const lineItems = [
    {
      description: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan — Monthly Subscription`,
      quantity: 1,
      unit_price: pricing.price,
      total: pricing.price
    }
  ]

  // Overages
  if (usage.overage_api > 0) {
    const overageCost = usage.overage_api * 0.01 // $0.01 per API call over limit
    lineItems.push({
      description: `API Overage — ${usage.overage_api} calls @ $0.01`,
      quantity: usage.overage_api,
      unit_price: 0.01,
      total: overageCost
    })
  }

  if (usage.overage_bookings > 0) {
    const overageCost = usage.overage_bookings * 2.50 // $2.50 per booking over limit
    lineItems.push({
      description: `Booking Overage — ${usage.overage_bookings} bookings @ $2.50`,
      quantity: usage.overage_bookings,
      unit_price: 2.50,
      total: overageCost
    })
  }

  const total = lineItems.reduce((sum, item) => sum + item.total, 0)
  const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`

  return {
    id: `inv-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    tenant_id: tenantId,
    invoice_number: invoiceNumber,
    amount: total,
    currency: 'USD',
    status: 'draft',
    due_date: new Date(Date.now() + 30 * 86400000),
    line_items: lineItems
  }
}

// ── SEND INVOICE EMAIL ─────────────────────────────────────────
export async function sendInvoiceEmail(invoice: Invoice, tenantEmail: string, tenantName: string): Promise<void> {
  const html = invoiceEmail({
    recipientName: tenantName,
    invoiceNumber: invoice.invoice_number,
    invoiceDate: new Date().toLocaleDateString(),
    dueDate: invoice.due_date.toLocaleDateString(),
    lineItems: invoice.line_items.map((item: any) => ({
      description: item.description,
      amount: `$${item.total.toFixed(2)}`
    })),
    subtotal: `$${invoice.amount.toFixed(2)}`,
    commission: `$${(invoice.amount * 0.15).toFixed(2)}`,
    total: `$${(invoice.amount * 1.15).toFixed(2)}`,
    paymentUrl: `https://safarizetu.com/billing/pay/${invoice.id}`
  })

  await sendEmail(tenantEmail, `Invoice ${invoice.invoice_number} — Safari Zetu`, html)
  logger.info(`Invoice sent: ${invoice.invoice_number} to ${tenantEmail}`)
}

// ── MONTHLY BILLING RUN ────────────────────────────────────────
export async function runMonthlyBilling(): Promise<{
  invoices_generated: number
  total_revenue: number
  tenants_billed: number
}> {
  const traceId = startTrace('monthly_billing', 'mimo-v2.5-free')

  // Simulated tenants
  const tenants = [
    { id: 't-1', name: 'Wild Horizons', email: 'billing@wildhorizons.com', plan: 'pro' },
    { id: 't-2', name: 'Africa Bush Safaris', email: 'finance@africabush.com', plan: 'starter' },
    { id: 't-3', name: 'Zambezi Adventures', email: 'accounts@zambeziadv.com', plan: 'enterprise' },
  ]

  let totalRevenue = 0
  let invoicesGenerated = 0

  for (const tenant of tenants) {
    const apiCalls = Math.floor(Math.random() * 5000) + 500
    const bookings = Math.floor(Math.random() * 100) + 20
    const limits = PLAN_PRICING[tenant.plan]

    const overageApi = Math.max(0, apiCalls - limits.api_limit)
    const overageBookings = Math.max(0, bookings - limits.bookings_limit)

    const invoice = await generateInvoice(tenant.id, tenant.name, tenant.plan, {
      api_calls: apiCalls,
      bookings: bookings,
      overage_api: overageApi,
      overage_bookings: overageBookings
    })

    await sendInvoiceEmail(invoice, tenant.email, tenant.name)
    totalRevenue += invoice.amount
    invoicesGenerated++
  }

  endTrace(traceId, { input_tokens: 0, output_tokens: 0, cost_usd: 0, latency_ms: 0, status: 'success' })

  logger.info(`Monthly billing: ${invoicesGenerated} invoices, $${totalRevenue.toFixed(2)} revenue`)
  return { invoices_generated: invoicesGenerated, total_revenue: totalRevenue, tenants_billed: invoicesGenerated }
}

// ── UPGRADE RECOMMENDATION ─────────────────────────────────────
export async function recommendUpgrade(
  tenantId: string,
  currentPlan: string,
  usage: { api_calls: number; bookings: number }
): Promise<{ recommended_plan: string; reason: string; savings: number }> {
  const result = await callAgent({
    agentName: 'billing_advisor',
    division: 'saas_ops',
    model: 'light',
    systemPrompt: `You are a billing advisor for Safari Zetu SaaS platform.
Recommend the optimal plan for this tenant based on their usage.

Current plan: ${currentPlan}
API calls: ${usage.api_calls}/month
Bookings: ${usage.bookings}/month

Plan pricing:
- Free: $0 (100 API calls, 10 bookings)
- Starter: $49 (1,000 API calls, 100 bookings)
- Pro: $149 (10,000 API calls, 500 bookings)
- Enterprise: $499 (100,000 API calls, 5,000 bookings)

Recommend the most cost-effective plan. Consider:
- Current usage vs limits
- Growth trajectory
- Cost savings from right-sizing

Return JSON: {"recommended_plan": "...", "reason": "...", "savings": number (monthly savings vs current plan)}`,
    userMessage: `Recommend plan for tenant using ${usage.api_calls} API calls and ${usage.bookings} bookings`,
    triggerType: 'on_demand',
    triggerPayload: { tenant_id: tenantId, current_plan: currentPlan }
  })

  try {
    return JSON.parse(result.content)
  } catch {
    return { recommended_plan: currentPlan, reason: 'Current plan is optimal', savings: 0 }
  }
}
