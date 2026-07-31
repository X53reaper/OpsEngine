import { logger } from './ai-agent.service'

// ── AFRICA'S TALKING — SMS Service ─────────────────────────────
// Send booking confirmations, payment alerts, trip reminders
// via SMS to tourists and operators across Africa

const AT_API_KEY = process.env.AT_API_KEY || ''
const AT_USERNAME = process.env.AT_USERNAME || 'safarizetu'
const AT_ENV = process.env.AT_ENV || 'production'
const AT_BASE = AT_ENV === 'production'
  ? 'https://api.africastalking.com/version1/messaging'
  : 'https://sandbox.africastalking.com/version1/messaging'

// ── BRANDED SENDER ID ──────────────────────────────────────────
// Shows "SafariZetu" on the recipient's phone instead of a number
// Africa's Talking requires registration of sender IDs for production
// If not registered, falls back to their default (shows "Africa's Talking")
const AT_SENDER_ID = process.env.AT_SENDER_ID || 'SafariZetu'

export function isAfricasTalkingConfigured(): boolean {
  return !!AT_API_KEY
}

interface SmsResult {
  messageId: string
  status: string
  recipients: number
}

// ── SEND SMS ───────────────────────────────────────────────────
export async function sendSms(
  to: string | string[],
  message: string
): Promise<SmsResult[]> {
  if (!isAfricasTalkingConfigured()) {
    logger.warn("Africa's Talking not configured — skipping SMS")
    return []
  }

  const recipients = Array.isArray(to) ? to : [to]
  const results: SmsResult[] = []

  // Batch SMS (max 100 recipients per API call)
  const batchSize = 100
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize)

    try {
      const params = new URLSearchParams({
        username: AT_USERNAME,
        message,
        to: batch.join(','),
        from: AT_SENDER_ID  // Branded sender ID: shows "SafariZetu" on phone
      })

      const response = await fetch(AT_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'apiKey': AT_API_KEY,
          'Accept': 'application/json'
        },
        body: params.toString(),
        signal: AbortSignal.timeout(15000)
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(`AT SMS error ${response.status}: ${err}`)
      }

      const data = await response.json() as any
      const smsData = data.SMSMessageData || data

      if (smsData.Recipients) {
        for (const recipient of smsData.Recipients) {
          results.push({
            messageId: recipient.messageId || `at-${Date.now()}`,
            status: recipient.status || 'Unknown',
            recipients: batch.length
          })
        }
      } else {
        results.push({
          messageId: `at-${Date.now()}`,
          status: 'Sent',
          recipients: batch.length
        })
      }

      logger.info(`AT SMS sent to ${batch.length} recipients`)
    } catch (error: any) {
      logger.error(`AT SMS failed: ${error.message}`)
      results.push({
        messageId: `at-error-${Date.now()}`,
        status: `Failed: ${error.message}`,
        recipients: 0
      })
    }
  }

  return results
}

// ── BOOKING CONFIRMATION SMS ───────────────────────────────────
export async function sendBookingConfirmationSms(
  phone: string,
  touristName: string,
  safariName: string,
  date: string,
  guests: number
): Promise<SmsResult[]> {
  const message = [
    `Hi ${touristName}! 🌍`,
    `Your Safari Zetu booking is confirmed:`,
    `Safari: ${safariName}`,
    `Date: ${date}`,
    `Guests: ${guests}`,
    `We'll send you the itinerary shortly.`,
    `— Safari Zetu Team`
  ].join('\n')

  return sendSms(phone, message)
}

// ── PAYMENT REMINDER SMS ───────────────────────────────────────
export async function sendPaymentReminderSms(
  phone: string,
  touristName: string,
  amount: number,
  currency: string,
  dueDate: string
): Promise<SmsResult[]> {
  const message = [
    `Hi ${touristName},`,
    `Friendly reminder: Your Safari Zetu payment of ${currency} ${amount.toLocaleString()} is due by ${dueDate}.`,
    `Pay now at safarizetu.com/pay`,
    `Questions? Reply to this SMS.`,
    `— Safari Zetu Team`
  ].join('\n')

  return sendSms(phone, message)
}

// ── TRIP REMINDER SMS ──────────────────────────────────────────
export async function sendTripReminderSms(
  phone: string,
  touristName: string,
  safariName: string,
  departureDate: string,
  meetingPoint: string
): Promise<SmsResult[]> {
  const message = [
    `Hi ${touristName}! 🦁`,
    `Your ${safariName} safari starts on ${departureDate}!`,
    `Meeting point: ${meetingPoint}`,
    `Pack light, bring your camera, and get ready for adventure!`,
    `See you there!`,
    `— Safari Zetu Team`
  ].join('\n')

  return sendSms(phone, message)
}

// ── OPERATOR NOTIFICATION SMS ──────────────────────────────────
export async function sendOperatorNotificationSms(
  phone: string,
  operatorName: string,
  enquiryCount: number,
  newBooking: boolean
): Promise<SmsResult[]> {
  const message = newBooking
    ? [
        `Hi ${operatorName}! 🎉`,
        `Great news — you have a new booking on Safari Zetu!`,
        `Log in to view details: safarizetu.com/operator`,
        `— Safari Zetu Team`
      ].join('\n')
    : [
        `Hi ${operatorName},`,
        `You have ${enquiryCount} new enquiry${enquiryCount > 1 ? 's' : ''} on Safari Zetu.`,
        `Respond quickly to improve your ranking!`,
        `safarizetu.com/operator`,
        `— Safari Zetu Team`
      ].join('\n')

  return sendSms(phone, message)
}
