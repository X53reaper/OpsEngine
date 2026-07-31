import { pool, logger } from '../services/ai-agent.service'

// ── DASHBOARD API ROUTES ──────────────────────────────────────
// Express-style routes for the React dashboard

export async function getMetrics(): Promise<any> {
  const [
    enquiriesThisWeek,
    enquiriesLastWeek,
    operatorsActivated,
    totalLeads,
    activePartnerships,
    pendingApprovals,
    feedbackNew,
    feedbackFixReady,
    agentCostThisMonth,
    agentRunsThisMonth
  ] = await Promise.all([
    pool.query(`SELECT COUNT(*) as count FROM enquiry_log WHERE created_at > NOW() - INTERVAL '7 days'`),
    pool.query(`SELECT COUNT(*) as count FROM enquiry_log WHERE created_at > NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days'`),
    pool.query(`SELECT COUNT(*) as count FROM operator_activation_queue WHERE activation_stage = 'activated' AND updated_at > NOW() - INTERVAL '7 days'`),
    pool.query(`SELECT COUNT(*) as count FROM lead_pipeline`),
    pool.query(`SELECT COUNT(*) as count FROM partnership_pipeline WHERE status NOT IN ('declined','dormant')`),
    pool.query(`SELECT COUNT(*) as count FROM approval_queue WHERE status = 'pending'`),
    pool.query(`SELECT COUNT(*) as count FROM feedback_log WHERE status = 'new'`),
    pool.query(`SELECT COUNT(*) as count FROM code_fix_log WHERE founder_review_status = 'pending'`),
    pool.query(`SELECT COALESCE(SUM(cost_usd), 0) as total FROM agent_run_log WHERE started_at > NOW() - INTERVAL '30 days'`),
    pool.query(`SELECT COUNT(*) as count FROM agent_run_log WHERE started_at > NOW() - INTERVAL '30 days'`)
  ])

  const thisWeek = parseInt(enquiriesThisWeek.rows[0].count)
  const lastWeek = parseInt(enquiriesLastWeek.rows[0].count)
  const delta = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : 0

  return {
    enquiries_this_week: thisWeek,
    enquiry_delta: delta,
    response_rate: 85,  // Would be calculated from actual response data
    operators_activated: parseInt(operatorsActivated.rows[0].count),
    total_leads: parseInt(totalLeads.rows[0].count),
    active_partnerships: parseInt(activePartnerships.rows[0].count),
    pending_approvals: parseInt(pendingApprovals.rows[0].count),
    feedback_new: parseInt(feedbackNew.rows[0].count),
    feedback_fix_ready: parseInt(feedbackFixReady.rows[0].count),
    total_cost_usd: parseFloat(agentCostThisMonth.rows[0].total),
    total_runs: parseInt(agentRunsThisMonth.rows[0].count)
  }
}

export async function getApprovalQueue(): Promise<any> {
  const { rows: items } = await pool.query(
    `SELECT * FROM approval_queue WHERE status = 'pending'
     ORDER BY
       CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
       created_at ASC
     LIMIT 20`
  )
  return { items }
}

export async function getPartnerships(): Promise<any> {
  const { rows: items } = await pool.query(
    `SELECT * FROM partnership_pipeline ORDER BY created_at DESC LIMIT 20`
  )
  return { items }
}

export async function getLeads(): Promise<any> {
  const { rows: items } = await pool.query(
    `SELECT * FROM lead_pipeline ORDER BY created_at DESC LIMIT 20`
  )
  return { items }
}

export async function getAgentCosts(): Promise<any> {
  const { rows: [totals] } = await pool.query(`
    SELECT
      COALESCE(SUM(cost_usd), 0) as total_cost_usd,
      COUNT(*) as total_runs,
      COALESCE(AVG(cost_usd), 0) as avg_cost
    FROM agent_run_log
    WHERE started_at > NOW() - INTERVAL '30 days'
  `)

  const { rows: byAgent } = await pool.query(`
    SELECT
      agent_name,
      COUNT(*) as runs,
      COALESCE(SUM(cost_usd), 0) as cost
    FROM agent_run_log
    WHERE started_at > NOW() - INTERVAL '30 days'
    GROUP BY agent_name
    ORDER BY cost DESC
  `)

  return {
    total_cost_usd: parseFloat(totals.total_cost_usd),
    total_runs: parseInt(totals.total_runs),
    avg_cost: parseFloat(totals.avg_cost),
    by_agent: byAgent.map((a: any) => ({
      agent_name: a.agent_name,
      runs: parseInt(a.runs),
      cost: parseFloat(a.cost)
    }))
  }
}

export async function getFeedbackPipeline(): Promise<any> {
  const { rows: items } = await pool.query(`
    SELECT f.*, c.test_status, c.founder_review_status, c.fix_summary
    FROM feedback_log f
    LEFT JOIN code_fix_log c ON c.feedback_id = f.id
    WHERE f.status NOT IN ('dismissed', 'deployed')
    ORDER BY
      CASE f.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
      f.created_at DESC
    LIMIT 20
  `)
  return { items }
}

export async function approveFix(fixId: string): Promise<void> {
  await pool.query(
    `UPDATE code_fix_log SET founder_review_status='approved', reviewed_at=NOW() WHERE id=$1`,
    [fixId]
  )
  logger.info(`Fix ${fixId} approved by founder`)
}

export async function rejectFix(fixId: string, notes?: string): Promise<void> {
  await pool.query(
    `UPDATE code_fix_log SET founder_review_status='rejected', founder_notes=$1, reviewed_at=NOW() WHERE id=$2`,
    [notes || '', fixId]
  )
  logger.info(`Fix ${fixId} rejected by founder`)
}
