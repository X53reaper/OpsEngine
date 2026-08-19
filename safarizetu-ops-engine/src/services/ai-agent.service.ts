import dotenv from 'dotenv'
dotenv.config()

import winston from 'winston'
import { createHmac } from 'crypto'
import { startTrace, endTrace, logGeneration } from './observability.service'

// ── LOG REDACTION FILTER ──────────────────────────────────────────
// Masks API keys, emails, phone numbers, and names from log output
const REDACTION_PATTERNS: [RegExp, string | ((match: string) => string)][] = [
  [/sk-[a-zA-Z0-9_-]{20,}/g, '[REDACTED_API_KEY]'],
  [/re_[a-zA-Z0-9_-]{20,}/g, '[REDACTED_RESEND_KEY]'],
  [/tvly-[a-zA-Z0-9_-]{20,}/g, '[REDACTED_TAVILY_KEY]'],
  [/apify_api_[a-zA-Z0-9_-]{20,}/g, '[REDACTED_APIFY_KEY]'],
  [/atsk_[a-zA-Z0-9_-]{20,}/g, '[REDACTED_AT_KEY]'],
  [/5KoeTG[0-9A-Za-z]{32}/g, '[REDACTED_APOLLO_KEY]'],
  [/8A9cta[0-9A-Za-z]{40}/g, '[REDACTED_BUFFER_TOKEN]'],
  [/AIza[0-9A-Za-z_-]{35}/g, '[REDACTED_GOOGLE_API]'],
  [/cf1[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[REDACTED_MAILBOXLAYER]'],
  [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]'],
  [/\+?[1-9]\d{1,14}/g, '[REDACTED_PHONE]'],
  [/"(?:email|name|phone)"\s*:\s*"[^"]*"/gi, (match) => match.replace(/: "[^"]*"/, ': "[REDACTED]"')],
]

function redactLog(message: string): string {
  let redacted = message
  for (const [pattern, replacement] of REDACTION_PATTERNS) {
    if (typeof replacement === 'function') {
      redacted = redacted.replace(pattern, replacement as (match: string) => string)
    } else {
      redacted = redacted.replace(pattern, replacement)
    }
  }
  return redacted
}

const originalConsoleLog = console.log
console.log = (...args: any[]) => {
  originalConsoleLog(...args.map(a => typeof a === 'string' ? redactLog(a) : a))
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const redactedMessage = redactLog(String(message))
      const redactedMeta = JSON.stringify(meta, (key, value) => {
        if (typeof value === 'string') return redactLog(value)
        return value
      })
      return `${timestamp} ${level}: ${redactedMessage} ${redactedMeta !== '{}' ? redactedMeta : ''}`
    })
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/ops-engine.log' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
})

// ── DATABASE (optional — works without PostgreSQL) ─────────────
let pool: any = null
let dbConnected = false
let mockWarningTimer: ReturnType<typeof setInterval> | null = null

export function isDbConnected(): boolean {
  return dbConnected
}

async function initPool() {
  try {
    const { Pool } = await import('pg')
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000
    })
    await pool.query('SELECT 1')
    dbConnected = true
    logger.info('PostgreSQL connected')
  } catch (error: any) {
    dbConnected = false
    logger.error('CRITICAL: PostgreSQL not available — running in memory-only mode. DATA WILL NOT PERSIST.')
    logger.error(`DB connection error: ${error.message}`)
    logger.error('Set DATABASE_URL and ensure PostgreSQL is running. All data stored in memory and will be lost on restart.')
    pool = {
      query: async (text: string, params?: any[]) => {
        logger.debug(`[DB-MOCK] ${text.substring(0, 80)}...`)
        return { rows: [{ count: 0, id: 'mock-' + Date.now() }] }
      }
    }
    // Repeat warning every 5 minutes so it's visible in logs
    mockWarningTimer = setInterval(() => {
      logger.error('REMINDER: Running in DB-MOCK mode — no data is being persisted')
    }, 5 * 60 * 1000)
  }
}

// Initialize pool on import
initPool()

interface AgentCallOptions {
  agentName: string
  division: string
  model?: 'heavy' | 'light' | 'free' | 'fast' | 'code'
  systemPrompt: string
  userMessage: string
  triggerType: string
  triggerPayload?: Record<string, any>
  maxTokens?: number
}

interface AgentResult {
  content: string
  tokensUsed: number
  model: string
  costUsd: number
  runLogId: string | null
}

// ── MODEL ROUTING — OpenCode Zen Free Tier ────────────────────
// All models below are FREE on OpenCode Zen
// Sign up: https://opencode.ai/auth → Create API Key
// Docs: https://opencode.ai/docs/zen

interface ProviderConfig {
  baseURL: string
  apiKey: string
}

const ZEN_CONFIG: ProviderConfig = {
  baseURL: process.env.OPENCODE_ZEN_BASE_URL || 'https://opencode.ai/zen/v1',
  apiKey: process.env.OPENCODE_ZEN_API_KEY || ''
}

// Free models on OpenCode Zen
const MODELS = {
  heavy:    process.env.MODEL_HEAVY || 'deepseek-v4-flash-free',
  light:    process.env.MODEL_LIGHT || 'mimo-v2.5-free',
  free:     process.env.MODEL_FREE  || 'north-mini-code-free',
  fast:     process.env.MODEL_FAST  || 'nemotron-3-ultra-free',
  code:     process.env.MODEL_CODE  || 'mimo-v2.5-free'
}

// All free — $0 per token
const COST_PER_1K_TOKENS: Record<string, number> = {
  'deepseek-v4-flash-free': 0,
  'mimo-v2.5-free': 0,
  'north-mini-code-free': 0,
  'nemotron-3-ultra-free': 0,
  'big-pickle': 0
}

export async function callAgent(options: AgentCallOptions): Promise<AgentResult> {
  const {
    agentName, division, model = 'light', systemPrompt,
    userMessage, triggerType, triggerPayload, maxTokens = 2000
  } = options

  const selectedModel = MODELS[model] || MODELS.light
  const startTime = Date.now()
  const traceId = startTrace(agentName, selectedModel, { division, triggerType })

  // Log run start
  let runLogId: string | null = null
  try {
    const result = await pool.query(
      `INSERT INTO agent_run_log (agent_name, division, trigger_type, trigger_payload, status, model_used)
       VALUES ($1, $2, $3, $4, 'running', $5) RETURNING id`,
      [agentName, division, triggerType, JSON.stringify(triggerPayload || {}), selectedModel]
    )
    runLogId = result.rows[0]?.id || null
  } catch { /* mock mode */ }

  try {
    // Multi-provider fallback: Zen → Gemini → OpenRouter
    const { content, tokensUsed, provider } = await callLlmWithFallback(
      systemPrompt, userMessage, model, maxTokens
    )

    const costPer1k = COST_PER_1K_TOKENS[selectedModel] || 0
    const costUsd = (tokensUsed / 1000) * costPer1k
    const duration = Date.now() - startTime

    // Update run log with success
    try {
      if (runLogId) {
        await pool.query(
          `UPDATE agent_run_log SET status='success', result_summary=$1, tokens_used=$2,
           cost_usd=$3, duration_ms=$4, completed_at=NOW() WHERE id=$5`,
          [content.substring(0, 500), tokensUsed, costUsd, duration, runLogId]
        )
      }
    } catch { /* mock mode */ }

    logger.info(`Agent ${agentName} completed via ${provider}`, { tokensUsed, costUsd, duration, model: selectedModel })

    endTrace(traceId, { input_tokens: tokensUsed, output_tokens: 0, cost_usd: costUsd, latency_ms: duration, status: 'success' })
    logGeneration({ traceId, model: `${selectedModel} (${provider})`, input: systemPrompt.substring(0, 200), output: content.substring(0, 200), tokens: tokensUsed, costUsd, durationMs: duration })

    return { content, tokensUsed, model: `${selectedModel} (${provider})`, costUsd, runLogId }

  } catch (error: any) {
    const duration = Date.now() - startTime
    try {
      if (runLogId) {
        await pool.query(
          `UPDATE agent_run_log SET status='failed', error_message=$1, duration_ms=$2, completed_at=NOW() WHERE id=$3`,
          [error.message, duration, runLogId]
        )
      }
    } catch { /* mock mode */ }
    logger.error(`Agent ${agentName} failed`, { error: error.message })
    endTrace(traceId, { input_tokens: 0, output_tokens: 0, cost_usd: 0, latency_ms: duration, status: 'error', error: error.message })
    throw error
  }
}

// ── SAFARI ZETU BRIDGE CLIENT ─────────────────────────────────
export async function fetchFromSafariZetu(resource: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`${process.env.SAFARI_ZETU_BRIDGE_URL}`)
  url.searchParams.set('resource', resource)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  // HMAC signing for outbound webhooks (P0 security)
  const body = JSON.stringify({ resource, ...params })
  const signature = createHmac('sha256', process.env.WEBHOOK_SECRET_OUTBOUND!).update(body).digest('hex')

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'x-ops-api-key': process.env.SAFARI_ZETU_API_KEY!,
      'x-webhook-signature': signature,
      'Content-Type': 'application/json'
    },
    body,
    signal: AbortSignal.timeout(15000)
  })

  if (!response.ok) {
    throw new Error(`Safari Zetu bridge error: ${response.status}`)
  }

  return response.json()
}

export async function sendEmail(to: string, subject: string, html: string): Promise<string> {
  // Safety: PUBLIC_ACTIONS_ENABLED=false blocks ALL outgoing emails
  if (process.env.PUBLIC_ACTIONS_ENABLED === 'false') {
    logger.warn(`Email blocked: PUBLIC_ACTIONS_ENABLED=false. To: ${to}, Subject: ${subject}`)
    return 'blocked-safety-flag'
  }

  // Email test mode: route all emails to test address
  const testMode = process.env.EMAIL_TEST_MODE === 'true'
  const testOverride = process.env.EMAIL_TEST_OVERRIDE || process.env.TEST_EMAIL || 'sirmarshalmuvhuni@gmail.com'
  
  let actualTo = to
  let actualSubject = subject
  let actualHtml = html
  
  if (testMode && to !== testOverride) {
    actualTo = testOverride
    actualSubject = `[TEST - intended for: ${to}] ${subject}`
    actualHtml = `<div style="background:#fef3c7;border:1px solid #f59e0b;padding:12px;margin-bottom:20px;font-family:sans-serif;font-size:14px;">
      <strong>TEST MODE</strong> — This email was originally intended for: <strong>${to}</strong>
    </div>${html}`
    logger.info(`Email test mode: routing to ${testOverride} (original: ${to})`)
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `${process.env.RESEND_FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`,
      to: [actualTo],
      subject: actualSubject,
      html: actualHtml
    }),
    signal: AbortSignal.timeout(30000) // 30s timeout
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'unknown')
    throw new Error(`Resend error: ${response.status} - ${errorBody}`)
  }

  const data = await response.json() as any
  return data.id
}

export { pool, logger }

// ── GEMINI FALLBACK ──────────────────────────────────────────
// Used when OpenCode Zen is down or rate-limited
async function callGemini(systemPrompt: string, userMessage: string, maxTokens: number = 2000): Promise<{ content: string; tokensUsed: number }> {
  const GEMINI_KEY = process.env.GEMINI_API_KEY
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not configured')

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userMessage}` }] }
      ],
      generationConfig: { maxOutputTokens: maxTokens }
    }),
    signal: AbortSignal.timeout(60000)
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${err}`)
  }

  const data = await response.json() as any
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const tokensUsed = data.usageMetadata?.totalTokenCount || 0
  return { content: text, tokensUsed }
}

// ── OPENROUTER FALLBACK ──────────────────────────────────────
// Used when both Zen and Gemini are down
async function callOpenRouter(systemPrompt: string, userMessage: string, model: string, maxTokens: number = 2000): Promise<{ content: string; tokensUsed: number }> {
  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY
  if (!OPENROUTER_KEY) throw new Error('OPENROUTER_API_KEY not configured')

  const response = await fetch(`${process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://safarizetu.com',
      'X-Title': 'Safari Zetu Ops Engine'
    },
    body: JSON.stringify({
      model: model || 'mistralai/mistral-7b-instruct:free',
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    }),
    signal: AbortSignal.timeout(60000)
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenRouter API error ${response.status}: ${err}`)
  }

  const data = await response.json() as any
  return {
    content: data.choices?.[0]?.message?.content || '',
    tokensUsed: data.usage?.total_tokens || 0
  }
}

// ── PERPLEXITY LIVE RESEARCH ─────────────────────────────────
async function callPerplexity(systemPrompt: string, userMessage: string, maxTokens: number = 2000): Promise<{ content: string; tokensUsed: number }> {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.PERPLEXITY_MODEL || 'sonar-pro',
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    }),
    signal: AbortSignal.timeout(60000)
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Perplexity API error ${response.status}`)
  }

  const data = await response.json() as any
  return {
    content: data.choices?.[0]?.message?.content || '',
    tokensUsed: data.usage?.total_tokens || 0
  }
}

// ── MULTI-PROVIDER LLM CALL WITH FALLBACK ────────────────────
// Tries OpenCode Zen → Gemini → OpenRouter (free models)
async function callLlmWithFallback(
  systemPrompt: string,
  userMessage: string,
  modelTier: string,
  maxTokens: number = 2000
): Promise<{ content: string; tokensUsed: number; provider: string }> {
  let lastZenError = ''
  let lastGeminiError = ''

  // 1. Try OpenCode Zen (primary — all free)
  try {
    const result = await callZenApi(systemPrompt, userMessage, modelTier, maxTokens)
    return { ...result, provider: 'opencode-zen' }
  } catch (zenError: any) {
    lastZenError = zenError.message
    logger.warn(`OpenCode Zen failed: ${lastZenError} — trying Gemini`)
  }

  // 2. Try Gemini (fallback)
  try {
    const result = await callGemini(systemPrompt, userMessage, maxTokens)
    return { ...result, provider: 'gemini' }
  } catch (geminiError: any) {
    lastGeminiError = geminiError.message
    logger.warn(`Gemini failed: ${lastGeminiError} — trying OpenRouter`)
  }

  // 3. Try OpenRouter (last resort — free models)
  try {
    const freeModels: Record<string, string> = {
      heavy: 'mistralai/mistral-7b-instruct:free',
      light: 'mistralai/mistral-7b-instruct:free',
      free: 'mistralai/mistral-7b-instruct:free'
    }
    const result = await callOpenRouter(systemPrompt, userMessage, freeModels[modelTier] || 'mistralai/mistral-7b-instruct:free', maxTokens)
    return { ...result, provider: 'openrouter' }
  } catch (routerError: any) {
    throw new Error(`All LLM providers failed. Zen: ${lastZenError}, Gemini: ${lastGeminiError}, OpenRouter: ${routerError.message}`)
  }
}

// Extract Zen call into its own function for the fallback chain
async function callZenApi(systemPrompt: string, userMessage: string, modelTier: string, maxTokens: number): Promise<{ content: string; tokensUsed: number }> {
  const selectedModel = MODELS[modelTier as keyof typeof MODELS] || MODELS.light

  if (!ZEN_CONFIG.apiKey) {
    throw new Error('OPENCODE_ZEN_API_KEY not configured')
  }

  const response = await fetch(`${ZEN_CONFIG.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ZEN_CONFIG.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://safarizetu.com',
      'X-Title': 'Safari Zetu Ops Engine'
    },
    body: JSON.stringify({
      model: selectedModel,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    }),
    signal: AbortSignal.timeout(60000)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Zen API error ${response.status}: ${errorText}`)
  }

  const data = await response.json() as any
  return {
    content: data.choices?.[0]?.message?.content || '',
    tokensUsed: data.usage?.total_tokens || 0
  }
}
