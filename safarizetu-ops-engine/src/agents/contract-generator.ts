import { callAgent, logger, sendEmail } from '../services/ai-agent.service'
import { storeMemory } from '../services/memory.service'
import { startTrace, endTrace } from '../services/observability.service'
import { wrapEmail, sectionHeader, bodyText } from '../services/email-templates'

// ── AUTOMATED CONTRACT GENERATOR ───────────────────────────────
// Skills: CrewAI (multi-agent), Aider (code), Metagpt (docs)
// Generates partnership agreements, commission structures, T&Cs
// Outputs ready-to-sign PDFs

interface ContractRequest {
  partner_name: string
  partner_type: 'airline' | 'lodge' | 'activity' | 'transport' | 'insurance' | 'technology' | 'other'
  contact_email: string
  commission_pct?: number
  commission_type?: 'percentage' | 'fixed' | 'tiered'
  payment_terms?: string
  start_date?: string
  end_date?: string
  special_terms?: string[]
}

interface GeneratedContract {
  id: string
  partner_name: string
  contract_type: string
  status: 'draft'
  title: string
  sections: ContractSection[]
  summary: string
  created_at: Date
}

interface ContractSection {
  title: string
  content: string
  clause_type: string
}

// ── CONTRACT TEMPLATES ─────────────────────────────────────────
const CONTRACT_TEMPLATES: Record<string, string[]> = {
  airline: [
    'definitions',
    'scope_of_partnership',
    'commission_structure',
    'booking_process',
    'payment_terms',
    'data_sharing',
    'marketing_obligations',
    'termination',
    'liability',
    'confidentiality',
    'governing_law',
    'signatures'
  ],
  lodge: [
    'definitions',
    'scope_of_partnership',
    'listing_terms',
    'commission_structure',
    'payment_terms',
    'quality_standards',
    'cancellation_policy',
    'insurance_requirements',
    'termination',
    'governing_law',
    'signatures'
  ],
  activity: [
    'definitions',
    'scope_of_partnership',
    'service_description',
    'commission_structure',
    'payment_terms',
    'safety_requirements',
    'liability',
    'termination',
    'governing_law',
    'signatures'
  ],
  default: [
    'definitions',
    'scope_of_partnership',
    'commission_structure',
    'payment_terms',
    'obligations',
    'termination',
    'liability',
    'confidentiality',
    'governing_law',
    'signatures'
  ]
}

// ── GENERATE CONTRACT ──────────────────────────────────────────
export async function generateContract(request: ContractRequest): Promise<GeneratedContract> {
  const traceId = startTrace('contract_generator', 'mimo-v2.5-free', { partner: request.partner_name })

  const template = CONTRACT_TEMPLATES[request.partner_type] || CONTRACT_TEMPLATES.default

  const result = await callAgent({
    agentName: 'contract_generator',
    division: 'partnerships',
    model: 'heavy',
    systemPrompt: `You are a legal contract specialist for Safari Zetu, a safari marketplace platform.
Generate a professional partnership agreement for ${request.partner_name} (${request.partner_type}).

Template sections: ${template.join(', ')}

Contract details:
- Partner: ${request.partner_name}
- Type: ${request.partner_type}
- Commission: ${request.commission_pct || 10}% (${request.commission_type || 'percentage'})
- Payment terms: ${request.payment_terms || 'Net 30'}
- Duration: ${request.start_date || 'Upon signing'} to ${request.end_date || '12 months'}
${request.special_terms?.length ? `- Special terms: ${request.special_terms.join(', ')}` : ''}

Generate a complete contract with all sections. Each section should have:
- title: Section heading
- content: Full legal text (professional but readable)
- clause_type: Category (financial, legal, operational, etc.)

Return JSON: {
  "title": "Partnership Agreement — [Partner Name]",
  "sections": [{"title": "...", "content": "...", "clause_type": "..."}],
  "summary": "2-3 sentence summary of key terms"
}

Return ONLY valid JSON.`,
    userMessage: `Generate partnership contract for ${request.partner_name} (${request.partner_type})`,
    triggerType: 'on_demand',
    triggerPayload: { partner_name: request.partner_name, partner_type: request.partner_type }
  })

  let contract: GeneratedContract

  try {
    const parsed = JSON.parse(result.content)
    contract = {
      id: `contract-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      partner_name: request.partner_name,
      contract_type: request.partner_type,
      status: 'draft',
      title: parsed.title || `Partnership Agreement — ${request.partner_name}`,
      sections: parsed.sections || [],
      summary: parsed.summary || '',
      created_at: new Date()
    }
  } catch {
    // Fallback: use raw content as single section
    contract = {
      id: `contract-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      partner_name: request.partner_name,
      contract_type: request.partner_type,
      status: 'draft',
      title: `Partnership Agreement — ${request.partner_name}`,
      sections: [{
        title: 'Full Agreement',
        content: result.content,
        clause_type: 'general'
      }],
      summary: result.content.substring(0, 200),
      created_at: new Date()
    }
  }

  endTrace(traceId, { input_tokens: 0, output_tokens: 0, cost_usd: 0, latency_ms: 0, status: 'success' })

  logger.info(`Contract generated for ${request.partner_name}: ${contract.id}`)
  return contract
}

// ── FORMAT CONTRACT AS HTML ────────────────────────────────────
export function formatContractAsHtml(contract: GeneratedContract): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
        h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
        h2 { color: #2c5530; margin-top: 30px; }
        .section { margin-bottom: 20px; padding: 15px; border-left: 3px solid #2c5530; }
        .signature-block { margin-top: 60px; display: flex; justify-content: space-between; }
        .signature-line { width: 200px; border-top: 1px solid #333; margin-top: 50px; }
        .header { text-align: center; color: #666; margin-bottom: 30px; }
        .confidential { text-align: center; font-style: italic; color: #999; }
      </style>
    </head>
    <body>
      <div class="confidential">CONFIDENTIAL</div>
      <h1>${contract.title}</h1>
      <div class="header">
        <p>Effective Date: ${contract.created_at.toLocaleDateString()}</p>
        <p>Contract Reference: ${contract.id.toUpperCase()}</p>
      </div>

      ${contract.sections.map(section => `
        <div class="section">
          <h2>${section.title}</h2>
          <p>${section.content.replace(/\n/g, '</p><p>')}</p>
        </div>
      `).join('')}

      <div class="signature-block">
        <div>
          <p><strong>For Safari Zetu:</strong></p>
          <div class="signature-line"></div>
          <p>Name: ____________________</p>
          <p>Title: ____________________</p>
          <p>Date: ____________________</p>
        </div>
        <div>
          <p><strong>For ${contract.partner_name}:</strong></p>
          <div class="signature-line"></div>
          <p>Name: ____________________</p>
          <p>Title: ____________________</p>
          <p>Date: ____________________</p>
        </div>
      </div>

      <div class="confidential" style="margin-top: 60px;">
        <p>This agreement is confidential and proprietary to Safari Zetu.</p>
      </div>
    </body>
    </html>
  `
}

// ── SEND CONTRACT TO PARTNER ───────────────────────────────────
export async function sendContractToPartner(
  contract: GeneratedContract,
  partnerEmail: string
): Promise<void> {
  const html = formatContractAsHtml(contract)

  const emailHtml = wrapEmail(
    sectionHeader('Partnership Agreement', 'Safari Zetu') +
    `
    <p>Dear ${contract.partner_name} Team,</p>
    <p>Please find attached our proposed partnership agreement for your review.</p>

    <h3>Key Terms Summary</h3>
    <p>${contract.summary}</p>

    <h3>Next Steps</h3>
    <ol>
      <li>Review the attached agreement</li>
      <li>Sign and return via reply email</li>
      <li>We'll activate your partnership within 48 hours</li>
    </ol>

    <p>If you have any questions or need modifications, please don't hesitate to reach out.</p>

    <p>Best regards,<br>Safari Zetu Partnerships Team</p>

    <hr>
    <p><em>Contract Reference: ${contract.id.toUpperCase()}</em></p>
    <p><em>This agreement is confidential.</em></p>`,
    { palette: 'midnight' }
  )

  await sendEmail(partnerEmail, `Partnership Agreement — Safari Zetu × ${contract.partner_name}`, emailHtml)
  logger.info(`Contract sent to ${partnerEmail}`)
}

// ── GENERATE COMMISSION STRUCTURE ──────────────────────────────
export async function generateCommissionStructure(
  partnerType: string,
  partnerSize: string
): Promise<{
  base_commission: number
  tier_structure: Array<{ tier: string; threshold: number; commission: number }>
  payment_terms: string
  bonus_structure: string
}> {
  const result = await callAgent({
    agentName: 'commission_advisor',
    division: 'partnerships',
    model: 'light',
    systemPrompt: `You are a commission structure specialist for Safari Zetu.
Generate an optimal commission structure for a ${partnerSize} ${partnerType} partner.

Consider:
- Industry standards (typically 8-15% for travel)
- Partner size and volume potential
- Incentives for growth
- Payment terms that work for both parties

Return JSON: {
  "base_commission": number (percent),
  "tier_structure": [{"tier": "Bronze/Silver/Gold", "threshold": number (bookings/month), "commission": number (percent)}],
  "payment_terms": "Net 30 with monthly settlements",
  "bonus_structure": "description of performance bonuses"
}`,
    userMessage: `Design commission structure for ${partnerSize} ${partnerType} partner`,
    triggerType: 'on_demand',
    triggerPayload: { partner_type: partnerType, partner_size: partnerSize }
  })

  try {
    return JSON.parse(result.content)
  } catch {
    return {
      base_commission: 10,
      tier_structure: [
        { tier: 'Bronze', threshold: 0, commission: 8 },
        { tier: 'Silver', threshold: 10, commission: 10 },
        { tier: 'Gold', threshold: 25, commission: 12 },
        { tier: 'Platinum', threshold: 50, commission: 15 },
      ],
      payment_terms: 'Net 30 with monthly settlements',
      bonus_structure: 'Performance bonus of 2% for exceeding 100 bookings/month'
    }
  }
}
