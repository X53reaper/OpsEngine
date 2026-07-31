import { callAgent, pool, logger } from '../services/ai-agent.service'
import { AGENT_PROMPTS } from './prompts'

export async function researchPartnership(partner: any): Promise<void> {
  logger.info(`Researching partnership: ${partner.company_name}`)

  const result = await callAgent({
    agentName: 'partnership_research',
    division: 'partnership',
    model: 'heavy',
    systemPrompt: AGENT_PROMPTS.partnership_research,
    userMessage: `Research this potential partner for Safari Zetu:
Company: ${partner.company_name}
Type: ${partner.company_type}
Country: ${partner.country || 'Zimbabwe'}
Known info: ${partner.partnership_value_proposition}
Current status: ${partner.status}`,
    triggerType: 'partnership_research_requested',
    triggerPayload: { partner_id: partner.id },
    maxTokens: 2000
  })

  await pool.query(
    `UPDATE partnership_pipeline SET research_brief=$1, status='researched', updated_at=NOW() WHERE id=$2`,
    [result.content, partner.id]
  )

  // Add to approval queue so founder can review
  await pool.query(
    `INSERT INTO approval_queue (item_type, reference_id, title, preview, full_content, priority)
     VALUES ('proposal', $1, $2, $3, $4, 'high')`,
    [partner.id, `Partnership Brief: ${partner.company_name}`,
     result.content.substring(0, 300) + '...', result.content]
  )

  logger.info(`Partnership research complete for ${partner.company_name}`)
}

export async function draftPartnershipOutreach(partner: any): Promise<void> {
  if (!partner.research_brief) {
    throw new Error(`Cannot draft outreach for ${partner.company_name} — research brief missing. Run research first.`)
  }

  const result = await callAgent({
    agentName: 'outreach_email_drafter',
    division: 'partnership',
    model: 'light',
    systemPrompt: AGENT_PROMPTS.outreach_email_drafter,
    userMessage: `Write a partnership outreach email to:
Company: ${partner.company_name} (${partner.company_type})
Contact: ${partner.contact_name || 'the partnerships team'}
Research: ${partner.research_brief}`,
    triggerType: 'partnership_outreach_drafted',
    triggerPayload: { partner_id: partner.id }
  })

  await pool.query(
    `INSERT INTO approval_queue (item_type, reference_id, title, preview, full_content, priority)
     VALUES ('partnership_email', $1, $2, $3, $4, 'high')`,
    [partner.id, `Outreach Email: ${partner.company_name}`,
     result.content.substring(0, 200), result.content]
  )

  logger.info(`Partnership outreach drafted for ${partner.company_name} — pending founder approval`)
}
