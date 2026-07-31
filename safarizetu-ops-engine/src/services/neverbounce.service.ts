import { logger } from './ai-agent.service'

// ── NEVERBOUNCE — Email Verification ───────────────────────────
// Verify email deliverability before outreach campaigns
// Prevents bounces, protects sender reputation

const NEVERBOUNCE_KEY = process.env.NEVERBOUNCE_API_KEY || ''
const NEVERBOUNCE_BASE = 'https://api.neverbounce.com/v4.2/single/check'

export function isNeverBounceConfigured(): boolean {
  return !!NEVERBOUNCE_KEY
}

export type EmailStatus = 'valid' | 'invalid' | 'disposable' | 'risky' | 'unknown' | 'error'

export interface VerifyResult {
  email: string
  status: EmailStatus
  score: number        // 0-100
  flags: string[]      // e.g. ['has_catchall', 'is_disposable']
  suggested_correction?: string
}

export interface BulkVerifyResult {
  valid: string[]
  invalid: string[]
  risky: string[]
  unknown: string[]
  disposable: string[]
  total_processed: number
}

// ── SINGLE EMAIL VERIFICATION ──────────────────────────────────
export async function verifyEmail(email: string): Promise<VerifyResult> {
  if (!NEVERBOUNCE_KEY) {
    return { email, status: 'unknown', score: 0, flags: ['neverbounce_not_configured'] }
  }

  try {
    const params = new URLSearchParams({
      key: NEVERBOUNCE_KEY,
      email,
      address_info: '1'
    })

    const response = await fetch(`${NEVERBOUNCE_BASE}?${params}`, {
      method: 'GET',
      signal: AbortSignal.timeout(15000)
    })

    if (!response.ok) {
      throw new Error(`NeverBounce error ${response.status}`)
    }

    const data = await response.json() as any

    // Handle credit exhaustion gracefully
    if (data.status === 'general_failure') {
      logger.warn(`NeverBounce: ${data.message}`)
      return { email, status: 'unknown', score: 50, flags: ['insufficient_credits'] }
    }

    const flags = data.flags || []

    let status: EmailStatus = 'unknown'
    const resultCode = data.result

    switch (resultCode) {
      case 'valid':
      case '0':
        status = 'valid'
        break
      case 'invalid':
      case '-1':
      case '-2':
        status = 'invalid'
        break
      case 'disposable':
        status = 'disposable'
        break
      case 'risky':
        status = 'risky'
        break
      default:
        status = 'unknown'
    }

    return {
      email,
      status,
      score: data.score || (status === 'valid' ? 100 : status === 'invalid' ? 0 : 50),
      flags,
      suggested_correction: data.suggested_correction || undefined
    }
  } catch (error: any) {
    logger.error(`NeverBounce verify failed for ${email}: ${error.message}`)
    return { email, status: 'error', score: 0, flags: [error.message] }
  }
}

// ── BULK EMAIL VERIFICATION ────────────────────────────────────
export async function verifyEmailsBulk(emails: string[]): Promise<BulkVerifyResult> {
  const result: BulkVerifyResult = {
    valid: [], invalid: [], risky: [], unknown: [], disposable: [], total_processed: 0
  }

  // Verify in batches of 50 to avoid rate limits
  const batchSize = 50
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize)
    const verifications = await Promise.all(batch.map(email => verifyEmail(email)))

    for (const v of verifications) {
      result.total_processed++
      switch (v.status) {
        case 'valid': result.valid.push(v.email); break
        case 'invalid': result.invalid.push(v.email); break
        case 'risky': result.risky.push(v.email); break
        case 'disposable': result.disposable.push(v.email); break
        default: result.unknown.push(v.email)
      }
    }
  }

  logger.info(`NeverBounce bulk verify: ${result.valid.length} valid, ${result.invalid.length} invalid, ${result.risky.length} risky out of ${result.total_processed}`)
  return result
}

// ── FILTER SAFE EMAILS ─────────────────────────────────────────
export async function filterSafeEmails(emails: string[]): Promise<string[]> {
  const results = await verifyEmailsBulk(emails)
  return [...results.valid, ...results.risky] // Include risky (may be valid, just needs attention)
}

// ── CHECK IF DISPOSABLE ────────────────────────────────────────
export async function isDisposableEmail(email: string): Promise<boolean> {
  const result = await verifyEmail(email)
  return result.status === 'disposable'
}

// ── VERIFY LEAD EMAILS ─────────────────────────────────────────
export async function verifyLeadEmails(
  leads: Array<{ id: string; email: string }>
): Promise<Array<{ id: string; email: string; safe: boolean; status: EmailStatus }>> {
  const results: Array<{ id: string; email: string; safe: boolean; status: EmailStatus }> = []

  for (const lead of leads) {
    const verification = await verifyEmail(lead.email)
    results.push({
      id: lead.id,
      email: lead.email,
      safe: verification.status === 'valid' || verification.status === 'risky',
      status: verification.status
    })
  }

  const safeCount = results.filter(r => r.safe).length
  logger.info(`NeverBounce: ${safeCount}/${results.length} lead emails are safe to send`)
  return results
}
