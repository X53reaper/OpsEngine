import { createHmac } from 'crypto'

const OPS_ENGINE_URL = process.env.OPS_ENGINE_URL
const WEBHOOK_SECRET = process.env.OPS_ENGINE_WEBHOOK_SECRET

export type OpsWebhookEvent =
  | 'enquiry.created'
  | 'enquiry.updated'
  | 'operator.registered'
  | 'operator.updated'
  | 'review.submitted'
  | 'booking.completed'

export interface OpsWebhookPayload {
  event: OpsWebhookEvent
  timestamp: string
  data: Record<string, any>
}

export async function sendOpsWebhook(event: OpsWebhookEvent, data: Record<string, any>): Promise<void> {
  if (!OPS_ENGINE_URL || !WEBHOOK_SECRET) {
    console.warn('[ops-webhook] OPS_ENGINE_URL or WEBHOOK_SECRET not configured — skipping webhook')
    return
  }

  const payload: OpsWebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data
  }

  const body = JSON.stringify(payload)
  const signature = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex')

  try {
    const response = await fetch(`${OPS_ENGINE_URL}/webhook/safari-zetu`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-safari-zetu-signature': signature,
        'x-safari-zetu-event': event,
        'x-safari-zetu-timestamp': payload.timestamp
      },
      body,
      signal: AbortSignal.timeout(10000) // 10s timeout
    })

    if (!response.ok) {
      console.error(`[ops-webhook] Failed to send ${event}: ${response.status}`)
    }
  } catch (error) {
    // Never throw — ops engine failure must not break Safari Zetu
    console.error(`[ops-webhook] Error sending ${event}:`, error)
  }
}
