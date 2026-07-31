import { createHmac } from 'crypto'

// ... existing code ...

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET_OUTBOUND!

export function generateWebhookSignature(body: string): string {
  return createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex')
}
