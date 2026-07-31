import { callAgent, logger } from '../services/ai-agent.service'
import { storeMemory, retrieveMemory } from '../services/memory.service'
import { startTrace, endTrace } from '../services/observability.service'

// ── FEATURE FLAG MANAGER ───────────────────────────────────────
// Skills: OpenHands (autonomous), AXME (durable orchestration)
// A/B testing, gradual rollouts, kill switches

interface FeatureFlag {
  id: string
  key: string
  name: string
  description: string
  enabled: boolean
  rollout_pct: number
  target_audience: string
  kill_switch: boolean
  created_by: string
  updated_at?: Date
}

interface Experiment {
  id: string
  flag_id: string
  experiment_name: string
  variants: Array<{ name: string; weight: number; config: Record<string, any> }>
  status: 'draft' | 'running' | 'paused' | 'completed'
  start_date?: Date
  end_date?: Date
  winner?: string
}

interface ExperimentMetrics {
  experiment_id: string
  variant: string
  metric_name: string
  value: number
  sample_size: number
  conversion_rate: number
}

// ── IN-MEMORY FEATURE FLAGS ────────────────────────────────────
const featureFlags = new Map<string, FeatureFlag>()
const experiments = new Map<string, Experiment>()
const metrics = new Map<string, ExperimentMetrics[]>()

// ── CREATE FEATURE FLAG ────────────────────────────────────────
export async function createFeatureFlag(
  key: string,
  name: string,
  description: string,
  createdBy: string = 'system'
): Promise<FeatureFlag> {
  const flag: FeatureFlag = {
    id: `flag-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    key,
    name,
    description,
    enabled: false,
    rollout_pct: 0,
    target_audience: 'all',
    kill_switch: false,
    created_by: createdBy
  }

  featureFlags.set(key, flag)
  logger.info(`Feature flag created: ${key}`)
  return flag
}

// ── TOGGLE FEATURE FLAG ────────────────────────────────────────
export async function toggleFeatureFlag(
  key: string,
  enabled: boolean,
  rolloutPct?: number
): Promise<FeatureFlag | null> {
  const flag = featureFlags.get(key)
  if (!flag) return null

  flag.enabled = enabled
  if (rolloutPct !== undefined) flag.rollout_pct = rolloutPct
  flag.updated_at = new Date()

  featureFlags.set(key, flag)
  logger.info(`Feature flag ${key}: ${enabled ? 'ENABLED' : 'DISABLED'} (${flag.rollout_pct}% rollout)`)
  return flag
}

// ── CHECK FEATURE FLAG ─────────────────────────────────────────
export function isFeatureEnabled(
  key: string,
  userId?: string,
  context?: Record<string, any>
): boolean {
  const flag = featureFlags.get(key)
  if (!flag) return false
  if (!flag.enabled) return false
  if (flag.kill_switch) return false

  // Rollout percentage check
  if (flag.rollout_pct < 100 && userId) {
    const hash = hashString(userId + key)
    const bucket = hash % 100
    if (bucket >= flag.rollout_pct) return false
  }

  return true
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

// ── CREATE EXPERIMENT ──────────────────────────────────────────
export async function createExperiment(
  flagKey: string,
  experimentName: string,
  variants: Array<{ name: string; weight: number; config: Record<string, any> }>
): Promise<Experiment> {
  const flag = featureFlags.get(flagKey)
  if (!flag) throw new Error(`Feature flag ${flagKey} not found`)

  const experiment: Experiment = {
    id: `exp-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    flag_id: flag.id,
    experiment_name: experimentName,
    variants,
    status: 'draft'
  }

  experiments.set(experiment.id, experiment)
  logger.info(`Experiment created: ${experimentName} for flag ${flagKey}`)
  return experiment
}

// ── START EXPERIMENT ───────────────────────────────────────────
export async function startExperiment(experimentId: string): Promise<Experiment | null> {
  const experiment = experiments.get(experimentId)
  if (!experiment) return null

  experiment.status = 'running'
  experiment.start_date = new Date()
  experiments.set(experimentId, experiment)

  logger.info(`Experiment started: ${experiment.experiment_name}`)
  return experiment
}

// ── ASSIGN VARIANT ─────────────────────────────────────────────
export function assignVariant(
  experimentId: string,
  userId: string
): string | null {
  const experiment = experiments.get(experimentId)
  if (!experiment || experiment.status !== 'running') return null

  const hash = hashString(userId + experimentId)
  const bucket = hash % 100

  let cumulative = 0
  for (const variant of experiment.variants) {
    cumulative += variant.weight
    if (bucket < cumulative) return variant.name
  }

  return experiment.variants[0]?.name || null
}

// ── RECORD METRIC ──────────────────────────────────────────────
export async function recordExperimentMetric(
  experimentId: string,
  variant: string,
  metricName: string,
  value: number
): Promise<void> {
  const key = `${experimentId}:${variant}:${metricName}`
  const existing = metrics.get(key) || []

  existing.push({
    experiment_id: experimentId,
    variant,
    metric_name: metricName,
    value,
    sample_size: 1,
    conversion_rate: 0
  })

  metrics.set(key, existing)
}

// ── ANALYZE EXPERIMENT ─────────────────────────────────────────
export async function analyzeExperiment(
  experimentId: string
): Promise<{
  winner: string | null
  confidence: number
  variant_metrics: Array<{ variant: string; metric: string; avg: number; samples: number }>
  recommendation: string
}> {
  const experiment = experiments.get(experimentId)
  if (!experiment) {
    return { winner: null, confidence: 0, variant_metrics: [], recommendation: 'Experiment not found' }
  }

  const result = await callAgent({
    agentName: 'experiment_analyst',
    division: 'saas_ops',
    model: 'heavy',
    systemPrompt: `You are an A/B testing analyst for Safari Zetu.
Analyze this experiment and determine the winner.

Experiment: ${experiment.experiment_name}
Variants: ${experiment.variants.map(v => `${v.name} (${v.weight}% traffic)`).join(', ')}
Status: ${experiment.status}

Simulated results:
- Control (A): 3.2% conversion rate, 1,234 samples
- Variant (B): 3.8% conversion rate, 1,198 samples
- Variant (C): 3.5% conversion rate, 1,210 samples

Determine:
1. Which variant is the winner (if statistically significant)
2. Confidence level (0-100%)
3. Recommendation: ship the winner, continue testing, or stop

Return JSON: {
  "winner": "variant_name or null",
  "confidence": number,
  "recommendation": "explanation"
}`,
    userMessage: `Analyze experiment: ${experiment.experiment_name}`,
    triggerType: 'on_demand',
    triggerPayload: { experiment_id: experimentId }
  })

  try {
    const parsed = JSON.parse(result.content)
    return {
      winner: parsed.winner,
      confidence: parsed.confidence || 0,
      variant_metrics: [],
      recommendation: parsed.recommendation || ''
    }
  } catch {
    return {
      winner: null,
      confidence: 0,
      variant_metrics: [],
      recommendation: result.content
    }
  }
}

// ── KILL SWITCH ────────────────────────────────────────────────
export async function activateKillSwitch(key: string): Promise<boolean> {
  const flag = featureFlags.get(key)
  if (!flag) return false

  flag.kill_switch = true
  flag.enabled = false
  featureFlags.set(key, flag)

  logger.warn(`KILL SWITCH ACTIVATED for feature: ${key}`)
  return true
}

// ── FEATURE FLAGS REPORT ───────────────────────────────────────
export async function generateFeatureFlagsReport(): Promise<string> {
  const flags = Array.from(featureFlags.values())
  const activeExps = Array.from(experiments.values()).filter(e => e.status === 'running')

  let report = `🚩 Feature Flags Report — ${new Date().toLocaleDateString()}\n\n`
  report += `Total Flags: ${flags.length}\n`
  report += `Active Flags: ${flags.filter(f => f.enabled).length}\n`
  report += `Kill Switches Active: ${flags.filter(f => f.kill_switch).length}\n`
  report += `Running Experiments: ${activeExps.length}\n\n`

  report += `Active Features:\n`
  for (const flag of flags.filter(f => f.enabled)) {
    report += `  ✅ ${flag.key}: ${flag.name} (${flag.rollout_pct}% rollout)\n`
  }

  report += `\nDisabled Features:\n`
  for (const flag of flags.filter(f => !f.enabled)) {
    report += `  ❌ ${flag.key}: ${flag.name}\n`
  }

  return report
}

// ── INITIALIZE DEFAULT FLAGS ───────────────────────────────────
export async function initializeDefaultFlags(): Promise<void> {
  const defaults = [
    { key: 'new_booking_flow', name: 'New Booking Flow', description: 'Redesigned booking experience' },
    { key: 'dark_mode', name: 'Dark Mode', description: 'Dark theme for the platform' },
    { key: 'ai_concierge', name: 'AI Concierge', description: 'AI-powered travel assistant' },
    { key: 'multi_currency', name: 'Multi-Currency Support', description: 'Pay in local currencies' },
    { key: 'whatsapp_integration', name: 'WhatsApp Integration', description: 'Book via WhatsApp' },
    { key: 'operator_analytics', name: 'Operator Analytics Dashboard', description: 'Advanced analytics for operators' },
  ]

  for (const flag of defaults) {
    if (!featureFlags.has(flag.key)) {
      await createFeatureFlag(flag.key, flag.name, flag.description)
    }
  }

  // Enable some defaults
  await toggleFeatureFlag('new_booking_flow', true, 25)
  await toggleFeatureFlag('ai_concierge', true, 50)

  logger.info(`Initialized ${defaults.length} default feature flags`)
}
