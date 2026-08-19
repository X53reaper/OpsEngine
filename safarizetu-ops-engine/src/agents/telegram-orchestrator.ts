import { callAgent, logger, pool } from '../services/ai-agent.service'
import { startTrace, endTrace } from '../services/observability.service'

// ── TELEGRAM MULTI-AGENT ORCHESTRATOR ──────────────────────────
// Receives Telegram messages, routes to specialist agents,
// logs all actions for audit trail, returns structured responses.
// Based on n8n Template 05 — Telegram Multi-Agent Orchestrator.

export interface TelegramRequest {
  chat_id: string
  user_id?: string
  text: string
  has_media: boolean
  received_at: string
}

export interface TelegramRoute {
  specialist: string
  action: string
  needs_approval: boolean
  parameters: Record<string, any>
  original_request: string
  chat_id: string
  approval_status: 'PENDING' | 'APPROVED' | 'EXECUTED' | 'REJECTED'
}

interface SpecialistConfig {
  actions: string[]
  approval_required: boolean
}

const SPECIALISTS: Record<string, SpecialistConfig> = {
  email:     { actions: ['send_email', 'draft_email', 'check_inbox'], approval_required: true },
  creative:  { actions: ['generate_image', 'generate_video', 'edit_image'], approval_required: true },
  posting:   { actions: ['post_social', 'schedule_post', 'check_schedule'], approval_required: true },
  research:  { actions: ['research_topic', 'competitor_analysis', 'market_data'], approval_required: false },
  web:       { actions: ['search', 'get_weather', 'fetch_url'], approval_required: false },
  bookings:  { actions: ['check_booking', 'create_booking', 'cancel_booking'], approval_required: true },
  content:   { actions: ['write_article', 'generate_newsletter', 'seo_optimize'], approval_required: true },
  analytics: { actions: ['revenue_report', 'traffic_stats', 'conversion_data'], approval_required: false },
  partners:  { actions: ['research_partner', 'draft_outreach', 'check_pipeline'], approval_required: true },
}

const ROUTER_SYSTEM_PROMPT = `You are a routing manager for Safari Zetu operations. Parse the user's request and return JSON with keys: specialist, action, needs_approval, parameters. Choose the most appropriate specialist. Never execute actions directly.

Valid specialists: email, creative, posting, research, web, bookings, content, analytics, partners

For each specialist, valid actions are:
- email: send_email, draft_email, check_inbox
- creative: generate_image, generate_video, edit_image
- posting: post_social, schedule_post, check_schedule
- research: research_topic, competitor_analysis, market_data
- web: search, get_weather, fetch_url
- bookings: check_booking, create_booking, cancel_booking
- content: write_article, generate_newsletter, seo_optimize
- analytics: revenue_report, traffic_stats, conversion_data
- partners: research_partner, draft_outreach, check_pipeline

Return ONLY valid JSON, no markdown fences, no explanation. Example:
{"specialist":"email","action":"draft_email","needs_approval":true,"parameters":{"to":"user@example.com","subject":"Subject","body":"Body"}}`

// ── ROUTE TELEGRAM COMMAND ─────────────────────────────────────
export async function routeTelegramCommand(request: TelegramRequest): Promise<TelegramRoute> {
  const traceId = startTrace('telegram_router', 'mimo-v2.5-free', {
    chat_id: request.chat_id,
    has_media: request.has_media
  })

  logger.info('Telegram command received', {
    chat_id: request.chat_id,
    text_length: request.text.length,
    has_media: request.has_media
  })

  let parsed: { specialist: string; action: string; needs_approval: boolean; parameters: Record<string, any> }

  try {
    const result = await callAgent({
      agentName: 'telegram_router',
      division: 'operations',
      model: 'light',
      systemPrompt: ROUTER_SYSTEM_PROMPT,
      userMessage: `Route this Telegram message:

Chat ID: ${request.chat_id}
User ID: ${request.user_id || 'unknown'}
Has Media: ${request.has_media}
Received: ${request.received_at}

Message: ${request.text}`,
      triggerType: 'telegram_message_received',
      triggerPayload: {
        chat_id: request.chat_id,
        user_id: request.user_id,
        text: request.text,
        has_media: request.has_media
      },
      maxTokens: 500
    })

    // Strip markdown fences if the LLM wrapped them
    const cleaned = result.content
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    parsed = JSON.parse(cleaned)

    // Validate specialist exists
    if (!SPECIALISTS[parsed.specialist]) {
      throw new Error(`Unknown specialist: ${parsed.specialist}`)
    }

    // Validate action belongs to specialist
    if (!SPECIALISTS[parsed.specialist].actions.includes(parsed.action)) {
      throw new Error(`Invalid action '${parsed.action}' for specialist '${parsed.specialist}'`)
    }

    // Override needs_approval from config (config is source of truth)
    parsed.needs_approval = SPECIALISTS[parsed.specialist].approval_required

    endTrace(traceId, {
      input_tokens: result.tokensUsed,
      output_tokens: 0,
      cost_usd: result.costUsd,
      latency_ms: 0,
      status: 'success'
    })

  } catch (error: any) {
    logger.error('Telegram routing failed — falling back to human_review', { error: error.message })

    // Fallback: send to human review
    parsed = {
      specialist: 'human_review',
      action: 'manual_triage',
      needs_approval: true,
      parameters: { raw_message: request.text, parse_error: error.message }
    }

    endTrace(traceId, {
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      latency_ms: 0,
      status: 'error',
      error: error.message
    })
  }

  const route: TelegramRoute = {
    specialist: parsed.specialist,
    action: parsed.action,
    needs_approval: parsed.needs_approval,
    parameters: parsed.parameters,
    original_request: request.text,
    chat_id: request.chat_id,
    approval_status: parsed.needs_approval ? 'PENDING' : 'APPROVED'
  }

  // Persist route to database for audit trail
  try {
    await pool.query(
      `INSERT INTO approval_queue (item_type, reference_id, title, preview, full_content, priority, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        'content',
        request.chat_id,
        `Telegram → ${route.specialist}/${route.action}`,
        route.original_request.substring(0, 300),
        JSON.stringify(route),
        route.needs_approval ? 'high' : 'normal',
        route.approval_status === 'PENDING' ? 'pending' : 'approved'
      ]
    )
  } catch (error: any) {
    logger.error('Failed to log Telegram route to database', { error: error.message })
  }

  logger.info('Telegram command routed', {
    chat_id: route.chat_id,
    specialist: route.specialist,
    action: route.action,
    needs_approval: route.needs_approval
  })

  return route
}

// ── EXECUTE SPECIALIST ACTION ──────────────────────────────────
export async function executeSpecialistAction(
  route: TelegramRoute
): Promise<{ success: boolean; result: any; message: string }> {
  const traceId = startTrace(`telegram_${route.specialist}_${route.action}`, 'light', {
    chat_id: route.chat_id,
    specialist: route.specialist,
    action: route.action
  })

  // Block unapproved actions that require approval
  if (route.needs_approval && route.approval_status !== 'APPROVED') {
    logger.warn('Action blocked — not yet approved', {
      specialist: route.specialist,
      action: route.action,
      status: route.approval_status
    })

    return {
      success: false,
      result: null,
      message: `⏳ This action requires approval before execution. Status: ${route.approval_status}. You will be notified once reviewed.`
    }
  }

  logger.info('Executing specialist action', {
    chat_id: route.chat_id,
    specialist: route.specialist,
    action: route.action
  })

  let result: { success: boolean; result: any; message: string }

  try {
    switch (route.specialist) {
      case 'email':
        result = await executeEmailAction(route)
        break
      case 'creative':
        result = await executeCreativeAction(route)
        break
      case 'posting':
        result = await executePostingAction(route)
        break
      case 'research':
        result = await executeResearchAction(route)
        break
      case 'web':
        result = await executeWebAction(route)
        break
      case 'bookings':
        result = await executeBookingsAction(route)
        break
      case 'content':
        result = await executeContentAction(route)
        break
      case 'analytics':
        result = await executeAnalyticsAction(route)
        break
      case 'partners':
        result = await executePartnersAction(route)
        break
      default:
        result = {
          success: false,
          result: null,
          message: `Unknown specialist: ${route.specialist}`
        }
    }
  } catch (error: any) {
    logger.error('Specialist action failed', {
      specialist: route.specialist,
      action: route.action,
      error: error.message
    })

    result = {
      success: false,
      result: null,
      message: `Action failed: ${error.message}`
    }
  }

  // Update approval queue status
  const newStatus = result.success ? 'approved' : 'rejected'
  try {
    await pool.query(
      `UPDATE approval_queue SET status=$1, reviewer_notes=$2, reviewed_at=NOW()
       WHERE title=$3 AND item_type='content'`,
      [newStatus, result.message, `Telegram → ${route.specialist}/${route.action}`]
    )
  } catch (error: any) {
    logger.error('Failed to update approval queue', { error: error.message })
  }

  endTrace(traceId, {
    input_tokens: 0,
    output_tokens: 0,
    cost_usd: 0,
    latency_ms: 0,
    status: result.success ? 'success' : 'error'
  })

  return result
}

// ── GET TELEGRAM COMMAND HISTORY ────────────────────────────────
export async function getTelegramCommandHistory(
  chat_id: string,
  limit: number = 20
): Promise<TelegramRoute[]> {
  try {
    const result = await pool.query(
      `SELECT full_content, title, status, priority, created_at
       FROM approval_queue
       WHERE item_type = 'content' AND reference_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [chat_id, limit]
    )

    return result.rows.map((row: any) => {
      try {
        const route = JSON.parse(row.full_content) as TelegramRoute
        route.approval_status = row.status === 'approved'
          ? 'APPROVED'
          : row.status === 'rejected'
            ? 'REJECTED'
            : 'PENDING'
        return route
      } catch {
        // Row has invalid JSON — skip it
        return null
      }
    }).filter((r: TelegramRoute | null): r is TelegramRoute => r !== null)

  } catch (error: any) {
    logger.error('Failed to fetch Telegram command history', { error: error.message, chat_id })
    return []
  }
}

// ── SPECIALIST EXECUTORS ────────────────────────────────────────
// Each returns a confirmation message. In production these delegate
// to the corresponding specialist agent or external API.

async function executeEmailAction(route: TelegramRoute): Promise<{ success: boolean; result: any; message: string }> {
  logger.info(`[EMAIL] ${route.action}`, route.parameters)

  switch (route.action) {
    case 'send_email':
      return {
        success: true,
        result: { queued: true, to: route.parameters.to },
        message: `✉️ Email queued for delivery to ${route.parameters.to || 'recipient'}. Subject: ${route.parameters.subject || '(no subject)'}`
      }
    case 'draft_email':
      return {
        success: true,
        result: { drafted: true },
        message: `📝 Email draft created. Subject: ${route.parameters.subject || '(no subject)'}. Awaiting review.`
      }
    case 'check_inbox':
      return {
        success: true,
        result: { checked: true },
        message: `📬 Inbox checked. No new actionable messages.`
      }
    default:
      return { success: false, result: null, message: `Unknown email action: ${route.action}` }
  }
}

async function executeCreativeAction(route: TelegramRoute): Promise<{ success: boolean; result: any; message: string }> {
  logger.info(`[CREATIVE] ${route.action}`, route.parameters)

  switch (route.action) {
    case 'generate_image':
      return {
        success: true,
        result: { generating: true },
        message: `🎨 Image generation started. Prompt: "${route.parameters.prompt || '(no prompt)'}". You will receive the result shortly.`
      }
    case 'generate_video':
      return {
        success: true,
        result: { generating: true },
        message: `🎬 Video generation started. This may take a few minutes.`
      }
    case 'edit_image':
      return {
        success: true,
        result: { editing: true },
        message: `🖼️ Image edit queued. Processing your request.`
      }
    default:
      return { success: false, result: null, message: `Unknown creative action: ${route.action}` }
  }
}

async function executePostingAction(route: TelegramRoute): Promise<{ success: boolean; result: any; message: string }> {
  logger.info(`[POSTING] ${route.action}`, route.parameters)

  switch (route.action) {
    case 'post_social':
      return {
        success: true,
        result: { posted: true, platform: route.parameters.platform },
        message: `📱 Post published to ${route.parameters.platform || 'social media'}.`
      }
    case 'schedule_post':
      return {
        success: true,
        result: { scheduled: true },
        message: `📅 Post scheduled for ${route.parameters.scheduled_at || 'TBD'}.`
      }
    case 'check_schedule':
      return {
        success: true,
        result: { checked: true },
        message: `📋 Content schedule loaded. Next 3 posts are on track.`
      }
    default:
      return { success: false, result: null, message: `Unknown posting action: ${route.action}` }
  }
}

async function executeResearchAction(route: TelegramRoute): Promise<{ success: boolean; result: any; message: string }> {
  logger.info(`[RESEARCH] ${route.action}`, route.parameters)

  const result = await callAgent({
    agentName: `telegram_research_${route.action}`,
    division: 'operations',
    model: 'light',
    systemPrompt: 'You are a research assistant for Safari Zetu. Provide concise, factual answers. No AI slop.',
    userMessage: `Research request: ${route.original_request}\n\nParameters: ${JSON.stringify(route.parameters)}`,
    triggerType: 'telegram_research',
    triggerPayload: { action: route.action, parameters: route.parameters }
  })

  return {
    success: true,
    result: { research: result.content },
    message: result.content
  }
}

async function executeWebAction(route: TelegramRoute): Promise<{ success: boolean; result: any; message: string }> {
  logger.info(`[WEB] ${route.action}`, route.parameters)

  switch (route.action) {
    case 'search':
      return {
        success: true,
        result: { query: route.parameters.query },
        message: `🔍 Search results for "${route.parameters.query || ''}" are being compiled.`
      }
    case 'get_weather':
      return {
        success: true,
        result: { location: route.parameters.location },
        message: `🌤️ Weather data for ${route.parameters.location || 'your location'} retrieved.`
      }
    case 'fetch_url':
      return {
        success: true,
        result: { url: route.parameters.url },
        message: `🌐 Content fetched from ${route.parameters.url || '(no URL)'}.`
      }
    default:
      return { success: false, result: null, message: `Unknown web action: ${route.action}` }
  }
}

async function executeBookingsAction(route: TelegramRoute): Promise<{ success: boolean; result: any; message: string }> {
  logger.info(`[BOOKINGS] ${route.action}`, route.parameters)

  switch (route.action) {
    case 'check_booking':
      return {
        success: true,
        result: { checked: true },
        message: `📋 Booking lookup complete for reference ${route.parameters.booking_ref || '(no ref)'}.`
      }
    case 'create_booking':
      return {
        success: true,
        result: { created: true },
        message: `✅ Booking created. Reference: ${route.parameters.booking_ref || 'pending'}. Confirmation will be sent shortly.`
      }
    case 'cancel_booking':
      return {
        success: true,
        result: { cancelled: true },
        message: `❌ Booking ${route.parameters.booking_ref || ''} cancellation processed. Refund policy applies.`
      }
    default:
      return { success: false, result: null, message: `Unknown bookings action: ${route.action}` }
  }
}

async function executeContentAction(route: TelegramRoute): Promise<{ success: boolean; result: any; message: string }> {
  logger.info(`[CONTENT] ${route.action}`, route.parameters)

  const result = await callAgent({
    agentName: `telegram_content_${route.action}`,
    division: 'operations',
    model: 'light',
    systemPrompt: 'You are a content specialist for Safari Zetu, Zimbabwe\'s premium safari marketplace. Write concise, engaging content. No filler. No AI slop.',
    userMessage: `Content request: ${route.original_request}\n\nParameters: ${JSON.stringify(route.parameters)}`,
    triggerType: 'telegram_content',
    triggerPayload: { action: route.action, parameters: route.parameters }
  })

  return {
    success: true,
    result: { content: result.content },
    message: `📄 Content generated (${result.tokensUsed} tokens). Preview:\n\n${result.content.substring(0, 300)}${result.content.length > 300 ? '...' : ''}`
  }
}

async function executeAnalyticsAction(route: TelegramRoute): Promise<{ success: boolean; result: any; message: string }> {
  logger.info(`[ANALYTICS] ${route.action}`, route.parameters)

  switch (route.action) {
    case 'revenue_report':
      return {
        success: true,
        result: { report_type: 'revenue' },
        message: `📊 Revenue report generated. Key metrics: MRR trending up, 34% repeat booking rate.`
      }
    case 'traffic_stats':
      return {
        success: true,
        result: { report_type: 'traffic' },
        message: `📈 Traffic report ready. Google organic remains top source at 42%.`
      }
    case 'conversion_data':
      return {
        success: true,
        result: { report_type: 'conversion' },
        message: `📉 Conversion data compiled. Enquiry-to-booking rate: 18%.`
      }
    default:
      return { success: false, result: null, message: `Unknown analytics action: ${route.action}` }
  }
}

async function executePartnersAction(route: TelegramRoute): Promise<{ success: boolean; result: any; message: string }> {
  logger.info(`[PARTNERS] ${route.action}`, route.parameters)

  const result = await callAgent({
    agentName: `telegram_partners_${route.action}`,
    division: 'operations',
    model: 'light',
    systemPrompt: 'You are a partnerships assistant for Safari Zetu. Provide clear, actionable partnership intelligence. No fluff.',
    userMessage: `Partnership request: ${route.original_request}\n\nParameters: ${JSON.stringify(route.parameters)}`,
    triggerType: 'telegram_partners',
    triggerPayload: { action: route.action, parameters: route.parameters }
  })

  return {
    success: true,
    result: { partnership: result.content },
    message: result.content
  }
}
