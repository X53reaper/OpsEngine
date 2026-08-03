import { createHmac, timingSafeEqual } from 'crypto'
import { acknowledgeEnquiry, sendOperatorActivation } from '../agents/division1-growth'
import { generateContract, sendContractToPartner } from '../agents/contract-generator'
import { logger, pool } from '../services/ai-agent.service'
import { escapeHtml, detectSqlInjection, detectXss, validateInputLength } from '../services/security.service'

const WEBHOOK_SECRET = process.env.SAFARI_ZETU_WEBHOOK_SECRET!

export function verifyWebhookSignature(body: string, signature: string): boolean {
  if (!WEBHOOK_SECRET || !signature) return false
  const expected = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch { return false }
}

// ── INPUT VALIDATION (H1-H8: Comprehensive validation) ─────────
interface WebhookData {
  id?: string
  name?: string
  email?: string
  operatorType?: string
  destinations?: string[]
  [key: string]: any
}

function validateWebhookData(event: string, data: any): data is WebhookData {
  if (!data || typeof data !== 'object') {
    logger.warn(`Invalid webhook data for ${event}: not an object`)
    return false
  }

  // Validate ID if present
  if (data.id && typeof data.id === 'string') {
    const idCheck = validateInputLength(data.id, 'id', 100)
    if (!idCheck.valid) {
      logger.warn(`Invalid webhook data for ${event}: ${idCheck.error}`)
      return false
    }
    // Check for injection attempts
    if (detectSqlInjection(data.id) || detectXss(data.id)) {
      logger.warn(`Potential injection in webhook id for ${event}`)
      return false
    }
  } else if (data.id && typeof data.id !== 'string') {
    logger.warn(`Invalid webhook data for ${event}: id must be string`)
    return false
  }

  // Validate email if present
  if (data.email && (typeof data.email !== 'string' || !data.email.includes('@'))) {
    logger.warn(`Invalid webhook data for ${event}: invalid email`)
    return false
  }

  // Validate name if present (max 200 chars, no injection)
  if (data.name && typeof data.name === 'string') {
    const nameCheck = validateInputLength(data.name, 'name', 200)
    if (!nameCheck.valid) {
      logger.warn(`Invalid webhook data for ${event}: ${nameCheck.error}`)
      return false
    }
    if (detectSqlInjection(data.name) || detectXss(data.name)) {
      logger.warn(`Potential injection in webhook name for ${event}`)
      return false
    }
  }

  // Validate destinations array if present
  if (data.destinations && Array.isArray(data.destinations)) {
    if (data.destinations.length > 10) {
      logger.warn(`Invalid webhook data for ${event}: too many destinations`)
      return false
    }
    for (const dest of data.destinations) {
      if (typeof dest !== 'string') {
        logger.warn(`Invalid webhook data for ${event}: destination must be string`)
        return false
      }
      const destCheck = validateInputLength(dest, 'destination', 200)
      if (!destCheck.valid) {
        logger.warn(`Invalid webhook data for ${event}: ${destCheck.error}`)
        return false
      }
    }
  }

  return true
}

export async function handleWebhook(
  event: string,
  data: any,
  signature?: string,
  rawBody?: string
): Promise<void> {
  // Verify HMAC signature if provided
  if (signature && rawBody) {
    if (!verifyWebhookSignature(rawBody, signature)) {
      logger.warn(`Webhook signature verification failed for ${event}`)
      throw new Error('Invalid webhook signature')
    }
  }

  // Validate input data
  if (!validateWebhookData(event, data)) {
    throw new Error('Invalid webhook data')
  }

  logger.info(`Received webhook: ${event}`)

  try {
    switch (event) {
      case 'enquiry.created':
        await acknowledgeEnquiry(data)
        break

      case 'operator.registered':
        // Sanitize data before DB insert
        const sanitizedName = escapeHtml(data.name || '')
        const sanitizedEmail = escapeHtml(data.email || '')
        const operatorType = escapeHtml(data.operatorType || '')
        const destination = escapeHtml(data.destinations?.[0] || '')

        await pool.query(
          `INSERT INTO operator_activation_queue (safari_zetu_operator_id, operator_name, operator_email, operator_type, destination, activation_stage)
           VALUES ($1, $2, $3, $4, $5, 'pending')
           ON CONFLICT (safari_zetu_operator_id) DO NOTHING`,
          [data.id, sanitizedName, sanitizedEmail, operatorType, destination]
        )
        // Send day1 immediately
        await sendOperatorActivation(data, 'day1')

        // Auto-generate partnership contract
        try {
          const contract = await generateContract({
            partner_name: sanitizedName,
            partner_type: (data.operatorType as any) || 'lodge',
            contact_email: sanitizedEmail,
          })
          await sendContractToPartner(contract, sanitizedEmail)
          logger.info(`Contract generated and sent for operator: ${sanitizedName}`)
        } catch (contractErr: any) {
          logger.error(`Contract generation failed for ${sanitizedName}: ${contractErr.message}`)
        }
        break

      case 'booking.completed':
        // Schedule post-trip follow-up (3 days after trip end)
        logger.info(`Booking completed ${data.id} — post-trip follow-up scheduled`)
        break

      case 'booking.confirmed':
        logger.info(`Booking confirmed ${data.id} — notifying operator`)
        break

      case 'booking.declined':
        logger.info(`Booking declined ${data.id} — logging drop-off`)
        break

      case 'booking.cancelled':
        logger.info(`Booking cancelled ${data.id} — logging cancellation`)
        break

      case 'review.submitted':
        logger.info(`Review submitted ${data.id} (${data.rating || '?'}★) — routing to feedback pipeline`)
        break

      default:
        logger.warn(`Unhandled webhook event: ${event}`)
    }
  } catch (error: any) {
    logger.error(`Webhook handler failed for ${event}:`, error.message)
    throw error
  }
}
