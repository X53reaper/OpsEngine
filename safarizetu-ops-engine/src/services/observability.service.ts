import { logger } from './ai-agent.service'

// ── LANGFUSE OBSERVABILITY SERVICE ─────────────────────────────
// Track every LLM call, monitor costs, evaluate response quality,
// debug failures, and generate performance reports

interface TraceEntry {
  id: string
  name: string
  model: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
  latency_ms: number
  status: 'success' | 'error' | 'timeout'
  error?: string
  metadata?: Record<string, any>
  timestamp: Date
}

interface GenerationEntry {
  id: string
  trace_id: string
  model: string
  input: string
  output: string
  tokens: number
  cost_usd: number
  duration_ms: number
  prompt_version?: string
}

interface ScoreEntry {
  id: string
  trace_id: string
  name: string
  value: number
  comment?: string
}

// In-memory store
const traces: TraceEntry[] = []
const generations: GenerationEntry[] = []
const scores: ScoreEntry[] = []

let traceCounter = 0

// ── LANGFUSE SDK CLIENT ─────────────────────────────────────────
let langfuseClient: any = null
let langfuseEnabled = false

export function initLangfuse(): boolean {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY
  const secretKey = process.env.LANGFUSE_SECRET_KEY
  const host = process.env.LANGFUSE_HOST || 'http://localhost:3001'

  if (!publicKey || !secretKey || publicKey === 'generate_after_langfuse_setup') {
    logger.warn('Langfuse: missing API keys — using in-memory store only')
    langfuseEnabled = false
    return false
  }

  try {
    const { Langfuse } = require('langfuse')
    langfuseClient = new Langfuse({
      publicKey,
      secretKey,
      baseUrl: host,
      persistence: 'memory',
      enabled: true,
    })
    langfuseEnabled = true
    logger.info(`Langfuse: initialized → ${host}`)
    return true
  } catch (err: any) {
    logger.warn(`Langfuse: SDK init failed (${err.message}) — using in-memory store`)
    langfuseEnabled = false
    return false
  }
}

export function isLangfuseEnabled(): boolean {
  return langfuseEnabled
}

export function getLangfuseClient(): any {
  return langfuseClient
}

// ── START TRACE ────────────────────────────────────────────────
export function startTrace(
  name: string,
  model: string,
  metadata?: Record<string, any>
): string {
  const traceId = `trace-${++traceCounter}-${Date.now()}`

  // Local in-memory store
  const trace: TraceEntry = {
    id: traceId,
    name,
    model,
    input_tokens: 0,
    output_tokens: 0,
    cost_usd: 0,
    latency_ms: 0,
    status: 'success',
    metadata,
    timestamp: new Date()
  }
  traces.push(trace)

  // Send to Langfuse
  if (langfuseEnabled && langfuseClient) {
    try {
      langfuseClient.trace({
        id: traceId,
        name,
        metadata,
      })
    } catch (err: any) {
      logger.warn(`Langfuse: startTrace error: ${err.message}`)
    }
  }

  return traceId
}

// ── END TRACE ──────────────────────────────────────────────────
export function endTrace(
  traceId: string,
  result: {
    input_tokens: number
    output_tokens: number
    cost_usd: number
    latency_ms: number
    status: 'success' | 'error' | 'timeout'
    error?: string
  }
): void {
  const trace = traces.find(t => t.id === traceId)
  if (trace) {
    trace.input_tokens = result.input_tokens
    trace.output_tokens = result.output_tokens
    trace.cost_usd = result.cost_usd
    trace.latency_ms = result.latency_ms
    trace.status = result.status
    trace.error = result.error
  }

  if (langfuseEnabled && langfuseClient) {
    try {
      const langfuseTrace = langfuseClient.trace({ id: traceId })
      if (langfuseTrace) {
        langfuseTrace.update({
          input: null,
          output: result.status === 'error' ? { error: result.error } : null,
          metadata: {
            cost_usd: result.cost_usd,
            latency_ms: result.latency_ms,
            status: result.status,
          },
        })
      }
    } catch (err: any) {
      logger.warn(`Langfuse: endTrace error: ${err.message}`)
    }
  }
}

// ── LOG GENERATION ─────────────────────────────────────────────
export function logGeneration(params: {
  traceId: string
  model: string
  input: string
  output: string
  tokens: number
  costUsd: number
  durationMs: number
}): void {
  generations.push({
    id: `gen-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    trace_id: params.traceId,
    model: params.model,
    input: params.input.substring(0, 200),
    output: params.output.substring(0, 200),
    tokens: params.tokens,
    cost_usd: params.costUsd,
    duration_ms: params.durationMs
  })

  if (langfuseEnabled && langfuseClient) {
    try {
      langfuseClient.generation({
        traceId: params.traceId,
        name: params.model,
        model: params.model,
        input: params.input.substring(0, 1000),
        output: params.output.substring(0, 1000),
        usage: {
          output: params.tokens,
          input: params.tokens,
          unit: 'TOKENS',
        },
        cost: params.costUsd,
        startTime: new Date(Date.now() - params.durationMs),
        endTime: new Date(),
      })
    } catch (err: any) {
      logger.warn(`Langfuse: logGeneration error: ${err.message}`)
    }
  }
}

// ── SCORE TRACE ────────────────────────────────────────────────
export function scoreTrace(
  traceId: string,
  name: string,
  value: number,
  comment?: string
): void {
  scores.push({
    id: `score-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    trace_id: traceId,
    name,
    value,
    comment
  })

  if (langfuseEnabled && langfuseClient) {
    try {
      langfuseClient.score({
        traceId,
        name,
        value,
        comment,
      })
    } catch (err: any) {
      logger.warn(`Langfuse: scoreTrace error: ${err.message}`)
    }
  }
}

// ── GET METRICS ────────────────────────────────────────────────
export function getMetrics(): {
  total_traces: number
  total_cost_usd: number
  total_tokens: number
  avg_latency_ms: number
  error_rate: number
  cost_by_model: Record<string, number>
  traces_by_status: Record<string, number>
  langfuse_connected: boolean
} {
  const totalCost = traces.reduce((s, t) => s + t.cost_usd, 0)
  const totalTokens = traces.reduce((s, t) => s + t.input_tokens + t.output_tokens, 0)
  const avgLatency = traces.length > 0
    ? traces.reduce((s, t) => s + t.latency_ms, 0) / traces.length
    : 0
  const errorCount = traces.filter(t => t.status === 'error').length

  const costByModel: Record<string, number> = {}
  const tracesByStatus: Record<string, number> = {}

  for (const t of traces) {
    costByModel[t.model] = (costByModel[t.model] || 0) + t.cost_usd
    tracesByStatus[t.status] = (tracesByStatus[t.status] || 0) + 1
  }

  return {
    total_traces: traces.length,
    total_cost_usd: totalCost,
    total_tokens: totalTokens,
    avg_latency_ms: Math.round(avgLatency),
    error_rate: traces.length > 0 ? errorCount / traces.length : 0,
    cost_by_model: costByModel,
    traces_by_status: tracesByStatus,
    langfuse_connected: langfuseEnabled
  }
}

// ── GET RECENT TRACES ──────────────────────────────────────────
export function getRecentTraces(limit: number = 20): TraceEntry[] {
  return traces
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit)
}

// ── PERFORMANCE REPORT ─────────────────────────────────────────
export function generatePerformanceReport(): string {
  const metrics = getMetrics()
  return `📊 Agent Performance Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Traces: ${metrics.total_traces}
Total Tokens: ${metrics.total_tokens.toLocaleString()}
Total Cost: $${metrics.total_cost_usd.toFixed(4)}
Avg Latency: ${metrics.avg_latency_ms}ms
Error Rate: ${(metrics.error_rate * 100).toFixed(1)}%
Langfuse: ${metrics.langfuse_connected ? 'connected' : 'in-memory-only'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cost by Model:
${Object.entries(metrics.cost_by_model).map(([m, c]) => `  ${m}: $${c.toFixed(4)}`).join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Traces by Status:
${Object.entries(metrics.traces_by_status).map(([s, c]) => `  ${s}: ${c}`).join('\n')}`
}
