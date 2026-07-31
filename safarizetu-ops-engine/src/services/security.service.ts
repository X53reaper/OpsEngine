// ── SECURITY UTILITIES ─────────────────────────────────────────
// Shared security functions for the Safari Zetu Ops Engine

// ── HTML ESCAPING (prevents XSS) ───────────────────────────────
export function escapeHtml(unsafe: string): string {
  if (!unsafe) return ''
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// ── INPUT SANITIZATION ─────────────────────────────────────────
export function sanitizeInput(input: string): string {
  if (!input) return ''
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim()
    .substring(0, 10000) // Limit length
}

// ── PROMPT INJECTION PROTECTION ────────────────────────────────
export function sanitizePromptInput(input: string): string {
  if (!input) return ''
  // Remove common prompt injection patterns
  return input
    .replace(/ignore\s+(all\s+)?previous\s+instructions/gi, '[FILTERED]')
    .replace(/you\s+are\s+now\s+/gi, '[FILTERED]')
    .replace(/system\s*:\s*/gi, '[FILTERED]')
    .replace(/assistant\s*:\s*/gi, '[FILTERED]')
    .trim()
    .substring(0, 5000)
}

// ── URL VALIDATION ─────────────────────────────────────────────
const ALLOWED_DOMAINS = [
  'safarizetu.com',
  'opencode.ai',
  'resend.com',
  'api.openai.com',
]

export function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    // Block internal/private IPs
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '0.0.0.0') {
      return false
    }
    if (parsed.hostname.startsWith('192.168.') || parsed.hostname.startsWith('10.') || parsed.hostname.startsWith('172.')) {
      return false
    }
    // Must be HTTPS in production
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      return false
    }
    return true
  } catch {
    return false
  }
}

// ── CRYPTOGRAPHIC ID GENERATION ────────────────────────────────
export function generateSecureId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36)
  const randomBytes = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  ).join('')
  return prefix ? `${prefix}-${timestamp}-${randomBytes}` : `${timestamp}-${randomBytes}`
}

// ── RATE LIMITING (in-memory, upgrade to Redis for production) ─
const rateLimitStore = new Map<string, { count: number; window_start: number }>()

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: Date } {
  const now = Date.now()
  const record = rateLimitStore.get(key)

  if (!record || now - record.window_start > windowMs) {
    rateLimitStore.set(key, { count: 1, window_start: now })
    return { allowed: true, remaining: maxRequests - 1, resetAt: new Date(now + windowMs) }
  }

  record.count++
  if (record.count > maxRequests) {
    return { allowed: false, remaining: 0, resetAt: new Date(record.window_start + windowMs) }
  }

  return { allowed: true, remaining: maxRequests - record.count, resetAt: new Date(record.window_start + windowMs) }
}

// ── WEBHOOK SIGNATURE VERIFICATION ─────────────────────────────
import crypto from 'crypto'

export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret) return false

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex')

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )
  } catch {
    return false
  }
}

// ── DATA MASKING (for logs) ────────────────────────────────────
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***'
  const [local, domain] = email.split('@')
  const maskedLocal = local.length > 2
    ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
    : '***'
  return `${maskedLocal}@${domain}`
}

export function maskApiKey(key: string): string {
  if (!key) return '***'
  if (key.length <= 8) return '***'
  return key.substring(0, 4) + '*'.repeat(key.length - 8) + key.substring(key.length - 4)
}

// ── PASSWORD VALIDATION (C2: Strong password requirements) ──────
export function validatePasswordStrength(password: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!password) {
    return { valid: false, errors: ['Password is required'] }
  }

  if (password.length < 12) {
    errors.push('Password must be at least 12 characters')
  }

  if (password.length > 128) {
    errors.push('Password must be at most 128 characters')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one digit')
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }

  // Check for common passwords
  const commonPasswords = [
    'password', '123456', 'qwerty', 'admin', 'letmein',
    'welcome', 'monkey', 'dragon', 'master', 'login'
  ]
  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    errors.push('Password contains a common password pattern')
  }

  return { valid: errors.length === 0, errors }
}

// ── INPUT LENGTH VALIDATION (H1-H8) ────────────────────────────
export function validateInputLength(
  input: string,
  fieldName: string,
  maxLength: number = 10000
): { valid: boolean; error?: string } {
  if (!input) return { valid: true }
  if (input.length > maxLength) {
    return { valid: false, error: `${fieldName} exceeds maximum length of ${maxLength} characters` }
  }
  return { valid: true }
}

// ── SQL INJECTION DETECTION ─────────────────────────────────────
export function detectSqlInjection(input: string): boolean {
  if (!input) return false
  const patterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|FETCH|DECLARE|TRUNCATE)\b)/i,
    /(--|;|\/\*|\*\/|xp_|sp_)/i,
    /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i,
    /(CHAR\s*\(|CONCAT\s*\(|0x[0-9a-f]+)/i
  ]
  return patterns.some(pattern => pattern.test(input))
}

// ── XSS DETECTION ──────────────────────────────────────────────
export function detectXss(input: string): boolean {
  if (!input) return false
  const patterns = [
    /<script\b[^>]*>[\s\S]*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe\b[^>]*>/gi,
    /<object\b[^>]*>/gi,
    /<embed\b[^>]*>/gi,
    /<form\b[^>]*>/gi
  ]
  return patterns.some(pattern => pattern.test(input))
}
