import { callAgent, fetchFromSafariZetu, sendEmail, pool, logger } from '../services/ai-agent.service'
import { AGENT_PROMPTS } from './prompts'
import { enquiryAcknowledgementEmail } from '../services/email-templates/enquiry-acknowledgement'

// ── ENQUIRY ACKNOWLEDGEMENT ───────────────────────────────────
export async function acknowledgeEnquiry(enquiry: any): Promise<void> {
  logger.info(`Acknowledging enquiry ${enquiry.id}`)

  // Normalize field mapping: webhook sends email/name directly, code may also expect tourist?.email
  const touristEmail = enquiry.tourist?.email || enquiry.email || enquiry.customer_email
  const touristName = enquiry.tourist?.name || enquiry.name || enquiry.customer_name || 'there'
  const destination = enquiry.destination || 'Zimbabwe Safari'
  const travelDates = enquiry.travelDates || enquiry.travel_dates || 'Flexible dates'
  const groupSize = enquiry.groupSize || enquiry.guests || 1

  // Use the template to generate the email
  const emailHtml = enquiryAcknowledgementEmail({
    touristName,
    enquiryId: enquiry.id,
    destination,
    travelDates,
    partySize: groupSize,
    enquiryUrl: `https://safarizetu.com/enquiry/${enquiry.id}/confirmed`
  })

  // Send the email
  const messageId = await sendEmail(
    touristEmail,
    `Your Safari Zetu Enquiry — ${destination}`,
    emailHtml
  )

  // Log to ops database
  await pool.query(
    `INSERT INTO outreach_log (entity_type, entity_id, email_to, email_subject, email_body, email_type, resend_message_id, status, agent_name, tokens_used, model_used, cost_usd, sent_at)
     VALUES ('tourist', $1, $2, $3, $4, 'acknowledgement', $5, 'sent', 'enquiry_acknowledgement', $6, $7, $8, NOW())`,
    [enquiry.id, touristEmail, `Your Safari Zetu Enquiry — ${destination}`,
     emailHtml, messageId, 0, 'template', 0]
  )

  // Update enquiry log (in Safari Zetu database)
  try {
    await pool.query(
      `INSERT INTO enquiry_log (safari_zetu_enquiry_id, tourist_email, tourist_name, destination, status, acknowledgement_sent_at)
       VALUES ($1, $2, $3, $4, 'acknowledged', NOW())
       ON CONFLICT (safari_zetu_enquiry_id) DO UPDATE SET status='acknowledged', acknowledgement_sent_at=NOW()`,
      [enquiry.id, touristEmail, touristName, destination]
    )
  } catch (e: any) {
    // enquiry_log may be in a different database - log but don't fail
    logger.warn(`Could not write to enquiry_log: ${e.message}`)
  }

  logger.info(`Enquiry ${enquiry.id} acknowledged successfully — email sent to ${touristEmail}`)
}

// ── SEO CONTENT GENERATION ────────────────────────────────────
export async function generateSeoContent(topic: string, destination?: string, keywords?: string[]): Promise<void> {
  logger.info(`Generating SEO content: ${topic}`)

  // Queue the content item
  const { rows: [contentItem] } = await pool.query(
    `INSERT INTO content_queue (content_type, topic, keywords, target_destination, status)
     VALUES ('blog_article', $1, $2, $3, 'generating') RETURNING id`,
    [topic, keywords || [], destination || null]
  )

  try {
    const result = await callAgent({
      agentName: 'seo_content_generator',
      division: 'growth',
      model: 'heavy',
      systemPrompt: AGENT_PROMPTS.seo_content_generator,
      userMessage: `Write an SEO article about: ${topic}. Primary keyword: ${keywords?.[0] || topic}. ${destination ? `Focus destination: ${destination}.` : ''} ${keywords ? `Secondary keywords: ${keywords.slice(1).join(', ')}.` : ''}`,
      triggerType: 'scheduled_content',
      maxTokens: 3000
    })

    // Parse title and content
    const lines = result.content.split('\n')
    const titleLine = lines.find(l => l.startsWith('Title:'))
    const title = titleLine?.replace('Title:', '').trim() || topic
    const contentBody = result.content.split('---').slice(1).join('---').trim()

    // Move to approval queue
    await pool.query(
      `UPDATE content_queue SET status='pending_approval', title=$1, draft_content=$2, generated_at=NOW(), tokens_used=$3, model_used=$4, cost_usd=$5, word_count=$6 WHERE id=$7`,
      [title, contentBody, result.tokensUsed, result.model, result.costUsd, contentBody.split(' ').length, contentItem.id]
    )

    await pool.query(
      `INSERT INTO approval_queue (item_type, reference_id, title, preview, full_content, priority)
       VALUES ('content', $1, $2, $3, $4, 'normal')`,
      [contentItem.id, title, contentBody.substring(0, 300) + '...', contentBody]
    )

    logger.info(`SEO content generated and queued for approval: ${title}`)
  } catch (error: any) {
    await pool.query(`UPDATE content_queue SET status='queued' WHERE id=$1`, [contentItem.id])
    throw error
  }
}

// ── OPERATOR ACTIVATION ───────────────────────────────────────
export async function sendOperatorActivation(operator: any, stage: 'day1' | 'day3' | 'day7'): Promise<void> {
  const promptKey = `operator_activation_${stage}` as keyof typeof AGENT_PROMPTS
  logger.info(`Sending ${stage} activation to operator ${operator.id}`)

  const result = await callAgent({
    agentName: `operator_activation_${stage}`,
    division: 'operator_relations',
    model: 'light',
    systemPrompt: AGENT_PROMPTS[promptKey],
    userMessage: JSON.stringify({
      operator_name: operator.name,
      contact_name: operator.contactName || operator.name,
      operator_type: operator.operatorType,
      destination: operator.destinations?.[0],
      listing_completion: operator.listingCompletion || 0
    }),
    triggerType: `operator_activation_${stage}`,
    triggerPayload: { operator_id: operator.id }
  })

  const subject = {
    day1: 'Welcome to Safari Zetu — Complete your listing today',
    day3: 'Your Safari Zetu listing is almost ready',
    day7: 'One last thing from Safari Zetu'
  }[stage]

  const messageId = await sendEmail(operator.email, subject, result.content)

  // Use whitelist map to prevent SQL injection
  const stageColumnMap: Record<string, string> = {
    day1: 'day1_sent_at',
    day3: 'day3_sent_at',
    day7: 'day7_sent_at'
  }
  const columnName = stageColumnMap[stage]
  if (!columnName) throw new Error(`Invalid activation stage: ${stage}`)

  await pool.query(
    `UPDATE operator_activation_queue SET activation_stage=$1, ${columnName}=NOW() WHERE safari_zetu_operator_id=$2`,
    [stage + '_sent', operator.id]
  )

  await pool.query(
    `INSERT INTO outreach_log (entity_type, entity_id, email_to, email_subject, email_body, email_type, resend_message_id, status, agent_name, tokens_used, model_used, cost_usd, sent_at)
     VALUES ('operator', $1, $2, $3, $4, $5, $6, 'sent', $7, $8, $9, $10, NOW())`,
    [operator.id, operator.email, subject, result.content, `activation_${stage}`, messageId,
     `operator_activation_${stage}`, result.tokensUsed, result.model, result.costUsd]
  )

  logger.info(`Operator ${operator.id} activation ${stage} sent`)
}
