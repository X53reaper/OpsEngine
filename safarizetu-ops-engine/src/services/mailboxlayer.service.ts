import { logger } from './ai-agent.service'

// ── MAILBOXLAYER — Email Address Validation ─────────────────────
// Syntax check, domain check, MX check, disposable detection
// Cheaper complement to NeverBounce (uses credits differently)

const MAILBOXLAYER_KEY = process.env.MAILBOXLAYER_API_KEY || ''
const MAILBOXLAYER_BASE = 'http://apilayer.net/api/check'

export function isMailboxLayerConfigured(): boolean {
  return !!MAILBOXLAYER_KEY
}

export interface MailboxLayerResult {
  email: string
  format_valid: boolean
  mx_found: boolean
  smtp_check: boolean
  catch_all: boolean
  role: boolean
  disposable: boolean
  free: boolean
  score: number
}

// ── VALIDATE SINGLE EMAIL ──────────────────────────────────────
export async function validateEmail(email: string): Promise<MailboxLayerResult> {
  if (!MAILBOXLAYER_KEY) {
    return {
      email,
      format_valid: false,
      mx_found: false,
      smtp_check: false,
      catch_all: false,
      role: false,
      disposable: false,
      free: false,
      score: 0
    }
  }

  try {
    const params = new URLSearchParams({
      access_key: MAILBOXLAYER_KEY,
      email,
      smtp: '1',
      format: '1',
      mx: '1',
      catchall: '1'
    })

    const response = await fetch(`${MAILBOXLAYER_BASE}?${params}`, {
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      throw new Error(`MailboxLayer error ${response.status}`)
    }

    const data = await response.json() as MailboxLayerResult
    logger.debug(`MailboxLayer check: ${email} -> score=${data.score}, format=${data.format_valid}, mx=${data.mx_found}`)
    return data
  } catch (error: any) {
    logger.error(`MailboxLayer validation failed for ${email}: ${error.message}`)
    return {
      email,
      format_valid: false,
      mx_found: false,
      smtp_check: false,
      catch_all: false,
      role: false,
      disposable: false,
      free: false,
      score: 0
    }
  }
}

// ── BATCH VALIDATE ─────────────────────────────────────────────
export async function validateEmailsBatch(
  emails: string[]
): Promise<Array<MailboxLayerResult & { is_safe: boolean }>> {
  const results: Array<MailboxLayerResult & { is_safe: boolean }> = []

  for (const email of emails) {
    const result = await validateEmail(email)
    results.push({
      ...result,
      is_safe: result.format_valid && result.mx_found && !result.disposable
    })
  }

  const safeCount = results.filter(r => r.is_safe).length
  logger.info(`MailboxLayer: ${safeCount}/${results.length} emails validated as safe`)
  return results
}

// ── QUICK CHECK — is email deliverable? ─────────────────────────
export async function isEmailDeliverable(email: string): Promise<boolean> {
  const result = await validateEmail(email)
  return result.format_valid && result.mx_found && !result.disposable
}
