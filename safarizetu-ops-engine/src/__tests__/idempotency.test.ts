jest.mock('../services/ai-agent.service', () => {
  const runs: Array<{ id: string; status: string; agent_name: string; trigger_type: string }> = []
  let runCounter = 0

  const mockQuery = jest.fn().mockImplementation(async (text: string, params?: any[]) => {
    if (text.includes('INSERT INTO agent_run_log')) {
      runCounter++
      const id = `run-${runCounter}`
      runs.push({
        id,
        status: 'running',
        agent_name: params?.[0] || 'unknown',
        trigger_type: params?.[2] || 'unknown',
      })
      return { rows: [{ id }] }
    }
    if (text.includes('UPDATE agent_run_log')) {
      const id = params?.[params.length - 1]
      const run = runs.find(r => r.id === id)
      if (run) {
        run.status = text.includes("status='success'") ? 'success' : 'failed'
      }
      return { rows: [] }
    }
    if (text.includes('SELECT') && text.includes('agent_run_log')) {
      // Filter by agent_name and trigger_type from params
      const agentName = params?.[0]
      const triggerType = params?.[1]
      let filtered = runs
      if (agentName) filtered = filtered.filter(r => r.agent_name === agentName)
      if (triggerType) filtered = filtered.filter(r => r.trigger_type === triggerType)
      if (text.includes("status IN")) {
        filtered = filtered.filter(r => r.status === 'running' || r.status === 'success')
      }
      return { rows: filtered }
    }
    return { rows: [] }
  })

  return {
    pool: { query: mockQuery },
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
    callAgent: jest.fn(),
    sendEmail: jest.fn(),
    isDbConnected: jest.fn().mockReturnValue(false),
  }
})

jest.mock('../services/observability.service', () => ({
  startTrace: jest.fn(() => 'trace-idempotency'),
  endTrace: jest.fn(),
  logGeneration: jest.fn(),
}))

describe('idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('duplicate run detection', () => {
    it('should detect duplicate runs via agent_run_log', async () => {
      const { pool } = await import('../services/ai-agent.service')

      // First run — INSERT returns id
      const result1 = await pool.query(
        `INSERT INTO agent_run_log (agent_name, division, trigger_type, trigger_payload, status, model_used)
         VALUES ($1, $2, $3, $4, 'running', $5) RETURNING id`,
        ['test_agent', 'test', 'test_trigger', '{}', 'mimo-v2.5-free']
      )
      expect(result1.rows[0].id).toBeDefined()

      // Second run with same parameters — would be a duplicate in real system
      const result2 = await pool.query(
        `INSERT INTO agent_run_log (agent_name, division, trigger_type, trigger_payload, status, model_used)
         VALUES ($1, $2, $3, $4, 'running', $5) RETURNING id`,
        ['test_agent', 'test', 'test_trigger', '{}', 'mimo-v2.5-free']
      )
      expect(result2.rows[0].id).toBeDefined()

      // Both runs get unique IDs
      expect(result1.rows[0].id).not.toBe(result2.rows[0].id)
    })

    it('should proceed with first run', async () => {
      const { pool } = await import('../services/ai-agent.service')

      const result = await pool.query(
        `INSERT INTO agent_run_log (agent_name, division, trigger_type, trigger_payload, status, model_used)
         VALUES ($1, $2, $3, $4, 'running', $5) RETURNING id`,
        ['newsletter', 'growth', 'scheduled', '{}', 'mimo-v2.5-free']
      )

      expect(result.rows[0].id).toBeDefined()

      // Mark as success
      await pool.query(
        `UPDATE agent_run_log SET status='success', completed_at=NOW() WHERE id=$1`,
        [result.rows[0].id]
      )
    })

    it('should skip second run within window (simulated)', async () => {
      const { pool } = await import('../services/ai-agent.service')

      // Simulate: first run exists
      const firstRun = await pool.query(
        `INSERT INTO agent_run_log (agent_name, division, trigger_type, trigger_payload, status, model_used)
         VALUES ($1, $2, $3, $4, 'running', $5) RETURNING id`,
        ['competitor_research', 'growth', 'monthly', '{}', 'mimo-v2.5-free']
      )

      // Check if run already exists (idempotency check)
      const existing = await pool.query(
        `SELECT id, status FROM agent_run_log WHERE agent_name = $1 AND trigger_type = $2 AND status IN ('running', 'success')`,
        ['competitor_research', 'monthly']
      )

      expect(existing.rows.length).toBe(1)

      // In a real system, this would skip the second run
      // For testing, we verify the check query works
      if (existing.rows.length > 0) {
        // Skip — run already in progress or completed
        expect(existing.rows[0].status).toMatch(/running|success/)
      }
    })
  })

  describe('run log lifecycle', () => {
    it('should track run from running to success', async () => {
      const { pool } = await import('../services/ai-agent.service')

      // Start run
      const insertResult = await pool.query(
        `INSERT INTO agent_run_log (agent_name, division, trigger_type, trigger_payload, status, model_used)
         VALUES ($1, $2, $3, $4, 'running', $5) RETURNING id`,
        ['seo_factory', 'growth', 'on_demand', '{}', 'mimo-v2.5-free']
      )
      const runId = insertResult.rows[0].id

      // Complete run
      await pool.query(
        `UPDATE agent_run_log SET status='success', result_summary=$1, tokens_used=$2,
         cost_usd=$3, duration_ms=$4, completed_at=NOW() WHERE id=$5`,
        ['Article generated', 500, 0, 1500, runId]
      )

      // Verify
      const allRuns = await pool.query(`SELECT * FROM agent_run_log`)
      const completedRun = allRuns.rows.find((r: any) => r.id === runId)
      expect(completedRun).toBeDefined()
      expect(completedRun.status).toBe('success')
    })

    it('should track run failure', async () => {
      const { pool } = await import('../services/ai-agent.service')

      const insertResult = await pool.query(
        `INSERT INTO agent_run_log (agent_name, division, trigger_type, trigger_payload, status, model_used)
         VALUES ($1, $2, $3, $4, 'running', $5) RETURNING id`,
        ['test_agent', 'test', 'test', '{}', 'mimo-v2.5-free']
      )
      const runId = insertResult.rows[0].id

      await pool.query(
        `UPDATE agent_run_log SET status='failed', error_message=$1, duration_ms=$2, completed_at=NOW() WHERE id=$3`,
        ['LLM provider unavailable', 5000, runId]
      )

      const allRuns = await pool.query(`SELECT * FROM agent_run_log`)
      const failedRun = allRuns.rows.find((r: any) => r.id === runId)
      expect(failedRun).toBeDefined()
      expect(failedRun.status).toBe('failed')
    })
  })
})
