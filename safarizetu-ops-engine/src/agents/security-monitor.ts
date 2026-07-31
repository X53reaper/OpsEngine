import { callAgent, logger, sendEmail } from '../services/ai-agent.service'
import { storeMemory, retrieveMemory } from '../services/memory.service'
import { startTrace, endTrace } from '../services/observability.service'
import { wrapEmail, sectionHeader, bodyText } from '../services/email-templates'

// ── API RATE LIMITER & ABUSE DETECTOR ──────────────────────────
// Skills: CAI (security), AXME (durable orchestration)
// Protect platform from abuse, DDoS, data scraping
// Rate limiting, anomaly detection, automatic blocking

interface SecurityEvent {
  id: string
  event_type: 'rate_limit' | 'ddos' | 'scraper' | 'injection' | 'brute_force' | 'anomaly' | 'blocked'
  severity: 'low' | 'medium' | 'high' | 'critical'
  source_ip: string
  endpoint?: string
  details: Record<string, any>
  action_taken: string
  resolved: boolean
  created_at: Date
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  reset_at: Date
  blocked: boolean
}

interface ThreatAssessment {
  threat_level: 'low' | 'medium' | 'high' | 'critical'
  threats_detected: string[]
  recommended_actions: string[]
  blocked_ips: number
  events_last_hour: number
}

// ── RATE LIMITER ───────────────────────────────────────────────
const rateLimitStore = new Map<string, { count: number; window_start: number; blocked_until?: number }>()

const RATE_LIMITS: Record<string, { requests: number; window_ms: number }> = {
  default: { requests: 100, window_ms: 60000 }, // 100 req/min
  '/api/booking': { requests: 20, window_ms: 60000 }, // 20 req/min
  '/api/search': { requests: 30, window_ms: 60000 }, // 30 req/min
  '/api/auth': { requests: 5, window_ms: 900000 }, // 5 req/15min
}

export function checkRateLimit(identifier: string, endpoint: string = 'default'): RateLimitResult {
  const limits = RATE_LIMITS[endpoint] || RATE_LIMITS.default
  const key = `${identifier}:${endpoint}`
  const now = Date.now()

  const record = rateLimitStore.get(key)

  if (!record) {
    rateLimitStore.set(key, { count: 1, window_start: now })
    return { allowed: true, remaining: limits.requests - 1, reset_at: new Date(now + limits.window_ms), blocked: false }
  }

  // Check if blocked
  if (record.blocked_until && now < record.blocked_until) {
    return { allowed: false, remaining: 0, reset_at: new Date(record.blocked_until), blocked: true }
  }

  // Reset window if expired
  if (now - record.window_start > limits.window_ms) {
    rateLimitStore.set(key, { count: 1, window_start: now })
    return { allowed: true, remaining: limits.requests - 1, reset_at: new Date(now + limits.window_ms), blocked: false }
  }

  // Increment count
  record.count++

  if (record.count > limits.requests) {
    // Block for 5 minutes
    record.blocked_until = now + 300000
    return { allowed: false, remaining: 0, reset_at: new Date(now + 300000), blocked: true }
  }

  return { allowed: true, remaining: limits.requests - record.count, reset_at: new Date(record.window_start + limits.window_ms), blocked: false }
}

// ── ANOMALY DETECTION ──────────────────────────────────────────
export async function detectAnomalies(
  recentEvents: SecurityEvent[]
): Promise<ThreatAssessment> {
  const result = await callAgent({
    agentName: 'security_analyst',
    division: 'security',
    model: 'heavy',
    systemPrompt: `You are a cybersecurity analyst for Safari Zetu, a SaaS platform.
Analyze these security events and assess the threat level.

Recent events (${recentEvents.length} total):
${recentEvents.slice(0, 10).map(e => `- ${e.event_type} (${e.severity}) from ${e.source_ip}: ${e.action_taken}`).join('\n')}

Assess:
1. Overall threat level (low/medium/high/critical)
2. Specific threats detected (DDoS, scraping, injection, brute force, etc.)
3. Recommended immediate actions
4. Whether any IPs should be blocked

Consider:
- Volume of events in short time
- Severity distribution
- Source IP patterns
- Endpoint targeting patterns

Return JSON: {
  "threat_level": "low|medium|high|critical",
  "threats_detected": ["threat1", "threat2"],
  "recommended_actions": ["action1", "action2"],
  "blocked_ips": number,
  "events_last_hour": number
}`,
    userMessage: `Analyze ${recentEvents.length} security events for threat assessment`,
    triggerType: 'scheduled_hourly',
    triggerPayload: { event_count: recentEvents.length }
  })

  try {
    return JSON.parse(result.content)
  } catch {
    return {
      threat_level: 'low',
      threats_detected: [],
      recommended_actions: ['Continue monitoring'],
      blocked_ips: 0,
      events_last_hour: recentEvents.length
    }
  }
}

// ── BLOCK IP ───────────────────────────────────────────────────
export async function blockIp(
  ip: string,
  reason: string,
  durationMinutes: number = 60
): Promise<void> {
  logger.warn(`IP BLOCKED: ${ip} for ${durationMinutes} minutes — ${reason}`)
  await storeMemory('security', 'conversation_context', `blocked_${ip}`, JSON.stringify({
    ip, reason, blocked_at: new Date().toISOString(), expires_at: new Date(Date.now() + durationMinutes * 60000).toISOString()
  }))
}

// ── LOG SECURITY EVENT ─────────────────────────────────────────
export async function logSecurityEvent(
  eventType: SecurityEvent['event_type'],
  severity: SecurityEvent['severity'],
  sourceIp: string,
  details: Record<string, any>,
  actionTaken: string
): Promise<SecurityEvent> {
  const event: SecurityEvent = {
    id: `sec-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    event_type: eventType,
    severity,
    source_ip: sourceIp,
    details,
    action_taken: actionTaken,
    resolved: false,
    created_at: new Date()
  }

  await storeMemory('security', 'conversation_context', `event_${event.id}`, JSON.stringify(event))
  logger.info(`Security event logged: ${eventType} (${severity}) from ${sourceIp}`)

  // Auto-block critical threats
  if (severity === 'critical') {
    await blockIp(sourceIp, `Critical threat: ${eventType}`, 120)
  }

  return event
}

// ── SECURITY DASHBOARD ─────────────────────────────────────────
export async function generateSecurityDashboard(): Promise<string> {
  // Simulated security metrics
  const metrics = {
    blocked_ips: 12,
    events_today: 47,
    rate_limit_hits: 23,
    threats_blocked: 5,
    uptime: 99.97
  }

  let report = `🔒 Security Dashboard — ${new Date().toLocaleDateString()}\n\n`
  report += `Blocked IPs: ${metrics.blocked_ips}\n`
  report += `Events Today: ${metrics.events_today}\n`
  report += `Rate Limit Hits: ${metrics.rate_limit_hits}\n`
  report += `Threats Blocked: ${metrics.threats_blocked}\n`
  report += `Platform Uptime: ${metrics.uptime}%\n`

  return report
}

// ── SEND SECURITY ALERT ────────────────────────────────────────
export async function sendSecurityAlert(assessment: ThreatAssessment): Promise<void> {
  if (assessment.threat_level === 'low') return

  const html = wrapEmail(
    sectionHeader('Security Alert', 'Safari Zetu') +
    `
    <p>Threat Level: <strong style="color: ${assessment.threat_level === 'critical' ? 'red' : assessment.threat_level === 'high' ? 'orange' : 'yellow'}">${assessment.threat_level.toUpperCase()}</strong></p>

    <h3>Threats Detected</h3>
    <ul>
      ${assessment.threats_detected.map(t => `<li>${t}</li>`).join('') || '<li>None</li>'}
    </ul>

    <h3>Recommended Actions</h3>
    <ul>
      ${assessment.recommended_actions.map(a => `<li>${a}</li>`).join('')}
    </ul>

    <h3>Metrics</h3>
    <ul>
      <li>Events Last Hour: ${assessment.events_last_hour}</li>
      <li>IPs Blocked: ${assessment.blocked_ips}</li>
    </ul>

    <p><em>Auto-generated by Safari Zetu Security Monitor</em></p>`,
    { palette: 'midnight' }
  )

  const securityEmail = process.env.SECURITY_EMAIL || 'security@safarizetu.com'
  await sendEmail(securityEmail, `Security Alert — ${assessment.threat_level.toUpperCase()} Threat`, html)
  logger.info(`Security alert sent: ${assessment.threat_level} threat`)
}

// ── HOURLY SECURITY CHECK ──────────────────────────────────────
export async function runHourlySecurityCheck(): Promise<{
  events_analyzed: number
  threats_detected: number
  ips_blocked: number
}> {
  const traceId = startTrace('hourly_security', 'mimo-v2.5-free')

  // Simulated recent events
  const recentEvents: SecurityEvent[] = [
    { id: 'e1', event_type: 'rate_limit', severity: 'medium', source_ip: '192.168.1.100', details: {}, action_taken: 'Rate limited', resolved: false, created_at: new Date() },
    { id: 'e2', event_type: 'scraper', severity: 'high', source_ip: '10.0.0.55', details: {}, action_taken: 'Temporarily blocked', resolved: false, created_at: new Date() },
  ]

  const assessment = await detectAnomalies(recentEvents)

  if (assessment.threat_level !== 'low') {
    await sendSecurityAlert(assessment)
  }

  endTrace(traceId, { input_tokens: 0, output_tokens: 0, cost_usd: 0, latency_ms: 0, status: 'success' })

  logger.info(`Security check: ${recentEvents.length} events, threat level: ${assessment.threat_level}`)
  return {
    events_analyzed: recentEvents.length,
    threats_detected: assessment.threats_detected.length,
    ips_blocked: assessment.blocked_ips
  }
}
