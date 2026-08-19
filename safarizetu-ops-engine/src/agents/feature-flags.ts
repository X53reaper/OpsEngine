import { callAgent, pool, isDbConnected, logger } from '../services/ai-agent.service'
import { storeMemory, retrieveMemory } from '../services/memory.service'
import { startTrace, endTrace } from '../services/observability.service'

// ── FEATURE FLAG MANAGER ───────────────────────────────────────
// Queries PostgreSQL feature_flags, feature_experiments, feature_metrics tables
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

// ── MOCK DATA (used when DB unavailable) ───────────────────────
const MOCK_FLAGS: FeatureFlag[] = [
  { id: 'flag-1', key: 'new_booking_flow', name: 'New Booking Flow', description: 'Redesigned booking experience', enabled: true, rollout_pct: 25, target_audience: 'all', kill_switch: false, created_by: 'system' },
  { id: 'flag-2', key: 'dark_mode', name: 'Dark Mode', description: 'Dark theme for the platform', enabled: false, rollout_pct: 0, target_audience: 'all', kill_switch: false, created_by: 'system' },
  { id: 'flag-3', key: 'ai_concierge', name: 'AI Concierge', description: 'AI-powered travel assistant', enabled: true, rollout_pct: 50, target_audience: 'all', kill_switch: false, created_by: 'system' },
  { id: 'flag-4', key: 'multi_currency', name: 'Multi-Currency Support', description: 'Pay in local currencies', enabled: false, rollout_pct: 0, target_audience: 'all', kill_switch: false, created_by: 'system' },
  { id: 'flag-5', key: 'whatsapp_integration', name: 'WhatsApp Integration', description: 'Book via WhatsApp', enabled: false, rollout_pct: 0, target_audience: 'all', kill_switch: false, created_by: 'system' },
  { id: 'flag-6', key: 'operator_analytics', name: 'Operator Analytics Dashboard', description: 'Advanced analytics for operators', enabled: false, rollout_pct: 0, target_audience: 'all', kill_switch: false, created_by: 'system' },
]

const MOCK_EXPERIMENTS: Experiment[] = [
  { id: 'exp-1', flag_id: 'flag-1', experiment_name: 'Booking Flow A/B Test', variants: [{ name: 'control', weight: 50, config: {} }, { name: 'variant_b', weight: 50, config: { new_ui: true } }], status: 'running', start_date: new Date() },
]

// ── CREATE FEATURE FLAG ────────────────────────────────────────
export async function createFeatureFlag(
  key: string,
  name: string,
  description: string,
  createdBy: string = 'system'
): Promise<FeatureFlag> {
  if (isDbConnected()) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO feature_flags (key, name, description, created_by)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [key, name, description, createdBy]
      )
      logger.info(`Feature flag created: ${key}`)
      return rows[0]
    } catch (error: any) {
      logger.error(`Failed to create feature flag: ${error.message}`)
    }
  }

  // Mock mode
  const flag: FeatureFlag = {
    id: `flag-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    key, name, description, enabled: false, rollout_pct: 0,
    target_audience: 'all', kill_switch: false, created_by: createdBy
  }
  MOCK_FLAGS.push(flag)
  logger.info(`Feature flag created (mock): ${key}`)
  return flag
}

// ── TOGGLE FEATURE FLAG ────────────────────────────────────────
export async function toggleFeatureFlag(
  key: string,
  enabled: boolean,
  rolloutPct?: number
): Promise<FeatureFlag | null> {
  if (isDbConnected()) {
    try {
      const updates: string[] = ['enabled = $2', 'updated_at = NOW()']
      const params: any[] = [key, enabled]
      if (rolloutPct !== undefined) {
        updates.push('rollout_pct = $3')
        params.push(rolloutPct)
      }
      const { rows } = await pool.query(
        `UPDATE feature_flags SET ${updates.join(', ')} WHERE key = $1 RETURNING *`,
        params
      )
      if (rows.length > 0) {
        logger.info(`Feature flag ${key}: ${enabled ? 'ENABLED' : 'DISABLED'} (${rows[0].rollout_pct}% rollout)`)
        return rows[0]
      }
      return null
    } catch (error: any) {
      logger.error(`Failed to toggle feature flag: ${error.message}`)
    }
  }

  // Mock mode
  const flag = MOCK_FLAGS.find(f => f.key === key)
  if (!flag) return null
  flag.enabled = enabled
  if (rolloutPct !== undefined) flag.rollout_pct = rolloutPct
  flag.updated_at = new Date()
  logger.info(`Feature flag ${key}: ${enabled ? 'ENABLED' : 'DISABLED'} (${flag.rollout_pct}% rollout)`)
  return flag
}

// ── CHECK FEATURE FLAG ─────────────────────────────────────────
export async function isFeatureEnabled(
  key: string,
  userId?: string,
  context?: Record<string, any>
): Promise<boolean> {
  if (isDbConnected()) {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM feature_flags WHERE key = $1`, [key]
      )
      if (rows.length === 0) return false
      const flag = rows[0]
      if (!flag.enabled) return false
      if (flag.kill_switch) return false
      if (flag.rollout_pct < 100 && userId) {
        const hash = hashString(userId + key)
        if (hash % 100 >= flag.rollout_pct) return false
      }
      return true
    } catch (error: any) {
      logger.error(`Failed to check feature flag: ${error.message}`)
    }
  }

  // Mock mode
  const flag = MOCK_FLAGS.find(f => f.key === key)
  if (!flag) return false
  if (!flag.enabled) return false
  if (flag.kill_switch) return false
  if (flag.rollout_pct < 100 && userId) {
    const hash = hashString(userId + key)
    if (hash % 100 >= flag.rollout_pct) return false
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
  if (isDbConnected()) {
    try {
      const { rows: flags } = await pool.query(
        `SELECT id FROM feature_flags WHERE key = $1`, [flagKey]
      )
      if (flags.length === 0) throw new Error(`Feature flag ${flagKey} not found`)

      const { rows } = await pool.query(
        `INSERT INTO feature_experiments (flag_id, experiment_name, variants)
         VALUES ($1, $2, $3) RETURNING *`,
        [flags[0].id, experimentName, JSON.stringify(variants)]
      )
      logger.info(`Experiment created: ${experimentName} for flag ${flagKey}`)
      return { ...rows[0], variants }
    } catch (error: any) {
      logger.error(`Failed to create experiment: ${error.message}`)
    }
  }

  // Mock mode
  const flag = MOCK_FLAGS.find(f => f.key === flagKey)
  if (!flag) throw new Error(`Feature flag ${flagKey} not found`)
  const experiment: Experiment = {
    id: `exp-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    flag_id: flag.id, experiment_name: experimentName, variants, status: 'draft'
  }
  MOCK_EXPERIMENTS.push(experiment)
  logger.info(`Experiment created (mock): ${experimentName} for flag ${flagKey}`)
  return experiment
}

// ── START EXPERIMENT ───────────────────────────────────────────
export async function startExperiment(experimentId: string): Promise<Experiment | null> {
  if (isDbConnected()) {
    try {
      const { rows } = await pool.query(
        `UPDATE feature_experiments SET status = 'running', start_date = NOW() WHERE id = $1 RETURNING *`,
        [experimentId]
      )
      if (rows.length > 0) {
        logger.info(`Experiment started: ${rows[0].experiment_name}`)
        return { ...rows[0], variants: typeof rows[0].variants === 'string' ? JSON.parse(rows[0].variants) : rows[0].variants }
      }
      return null
    } catch (error: any) {
      logger.error(`Failed to start experiment: ${error.message}`)
    }
  }

  // Mock mode
  const experiment = MOCK_EXPERIMENTS.find(e => e.id === experimentId)
  if (!experiment) return null
  experiment.status = 'running'
  experiment.start_date = new Date()
  logger.info(`Experiment started (mock): ${experiment.experiment_name}`)
  return experiment
}

// ── ASSIGN VARIANT ─────────────────────────────────────────────
export function assignVariant(experimentId: string, userId: string): string | null {
  const experiment = MOCK_EXPERIMENTS.find(e => e.id === experimentId)
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
  if (isDbConnected()) {
    try {
      await pool.query(
        `INSERT INTO feature_metrics (experiment_id, variant, metric_name, value, sample_size)
         VALUES ($1, $2, $3, $4, 1)`,
        [experimentId, variant, metricName, value]
      )
      return
    } catch (error: any) {
      logger.error(`Failed to record metric: ${error.message}`)
    }
  }
  // Mock: no-op
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
  if (isDbConnected()) {
    try {
      const { rows: experiments } = await pool.query(
        `SELECT * FROM feature_experiments WHERE id = $1`, [experimentId]
      )
      if (experiments.length === 0) {
        return { winner: null, confidence: 0, variant_metrics: [], recommendation: 'Experiment not found' }
      }
      const experiment = experiments[0]

      const { rows: metrics } = await pool.query(
        `SELECT variant, metric_name, AVG(value) as avg, SUM(sample_size) as total_samples
         FROM feature_metrics WHERE experiment_id = $1
         GROUP BY variant, metric_name`,
        [experimentId]
      )

      const result = await callAgent({
        agentName: 'experiment_analyst',
        division: 'saas_ops',
        model: 'heavy',
        systemPrompt: `You are an A/B testing analyst for Safari Zetu. Analyze this experiment data and determine the winner.

Experiment: ${experiment.experiment_name}
Metrics: ${JSON.stringify(metrics)}

Return JSON: { "winner": "variant_name or null", "confidence": number, "recommendation": "explanation" }`,
        userMessage: `Analyze experiment: ${experiment.experiment_name}`,
        triggerType: 'on_demand',
        triggerPayload: { experiment_id: experimentId }
      })

      try {
        const parsed = JSON.parse(result.content)
        return {
          winner: parsed.winner,
          confidence: parsed.confidence || 0,
          variant_metrics: metrics.map((m: any) => ({ variant: m.variant, metric: m.metric_name, avg: Number(m.avg), samples: Number(m.total_samples) })),
          recommendation: parsed.recommendation || ''
        }
      } catch {
        return { winner: null, confidence: 0, variant_metrics: [], recommendation: result.content }
      }
    } catch (error: any) {
      logger.error(`Failed to analyze experiment: ${error.message}`)
    }
  }

  // Mock mode
  return {
    winner: null,
    confidence: 0,
    variant_metrics: [],
    recommendation: 'Mock mode: connect to database for real experiment analysis'
  }
}

// ── KILL SWITCH ────────────────────────────────────────────────
export async function activateKillSwitch(key: string): Promise<boolean> {
  if (isDbConnected()) {
    try {
      const { rowCount } = await pool.query(
        `UPDATE feature_flags SET kill_switch = true, enabled = false, updated_at = NOW() WHERE key = $1`,
        [key]
      )
      if (rowCount && rowCount > 0) {
        logger.warn(`KILL SWITCH ACTIVATED for feature: ${key}`)
        return true
      }
      return false
    } catch (error: any) {
      logger.error(`Failed to activate kill switch: ${error.message}`)
    }
  }

  // Mock mode
  const flag = MOCK_FLAGS.find(f => f.key === key)
  if (!flag) return false
  flag.kill_switch = true
  flag.enabled = false
  logger.warn(`KILL SWITCH ACTIVATED for feature: ${key}`)
  return true
}

// ── FEATURE FLAGS REPORT ───────────────────────────────────────
export async function generateFeatureFlagsReport(): Promise<string> {
  if (isDbConnected()) {
    try {
      const { rows: flags } = await pool.query(`SELECT * FROM feature_flags ORDER BY created_at DESC`)
      const { rows: activeExps } = await pool.query(`SELECT * FROM feature_experiments WHERE status = 'running'`)

      let report = `🚩 Feature Flags Report — ${new Date().toLocaleDateString()}\n\n`
      report += `Total Flags: ${flags.length}\n`
      report += `Active Flags: ${flags.filter((f: any) => f.enabled).length}\n`
      report += `Kill Switches Active: ${flags.filter((f: any) => f.kill_switch).length}\n`
      report += `Running Experiments: ${activeExps.length}\n\n`

      report += `Active Features:\n`
      for (const flag of flags.filter((f: any) => f.enabled)) {
        report += `  ✅ ${flag.key}: ${flag.name} (${flag.rollout_pct}% rollout)\n`
      }
      report += `\nDisabled Features:\n`
      for (const flag of flags.filter((f: any) => !flag.enabled)) {
        report += `  ❌ ${flag.key}: ${flag.name}\n`
      }
      return report
    } catch (error: any) {
      logger.error(`Failed to generate feature flags report: ${error.message}`)
    }
  }

  // Mock mode
  let report = `🚩 Feature Flags Report (MOCK) — ${new Date().toLocaleDateString()}\n\n`
  report += `Total Flags: ${MOCK_FLAGS.length}\n`
  report += `Active Flags: ${MOCK_FLAGS.filter(f => f.enabled).length}\n`
  report += `Kill Switches Active: ${MOCK_FLAGS.filter(f => f.kill_switch).length}\n\n`
  report += `Active Features:\n`
  for (const flag of MOCK_FLAGS.filter(f => f.enabled)) {
    report += `  ✅ ${flag.key}: ${flag.name} (${flag.rollout_pct}% rollout)\n`
  }
  report += `\nDisabled Features:\n`
  for (const flag of MOCK_FLAGS.filter(f => !f.enabled)) {
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
    const exists = isDbConnected()
      ? (await pool.query(`SELECT id FROM feature_flags WHERE key = $1`, [flag.key])).rows.length > 0
      : MOCK_FLAGS.some(f => f.key === flag.key)
    if (!exists) {
      await createFeatureFlag(flag.key, flag.name, flag.description)
    }
  }

  await toggleFeatureFlag('new_booking_flow', true, 25)
  await toggleFeatureFlag('ai_concierge', true, 50)

  logger.info(`Initialized ${defaults.length} default feature flags`)
}
