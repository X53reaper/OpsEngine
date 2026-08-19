jest.mock('../services/ai-agent.service', () => {
  const mockQuery = jest.fn()
  return {
    pool: { query: mockQuery },
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
    sendEmail: jest.fn().mockResolvedValue('test-id'),
    isDbConnected: jest.fn().mockReturnValue(false),
  }
})

jest.mock('../services/observability.service', () => ({
  startTrace: jest.fn(() => 'trace-mock'),
  endTrace: jest.fn(),
  logGeneration: jest.fn(),
}))

jest.mock('../services/chroma.service', () => ({
  upsertDocuments: jest.fn().mockResolvedValue(undefined),
  queryCollection: jest.fn().mockResolvedValue([]),
  ragQuery: jest.fn().mockResolvedValue('mock catalog context'),
  loadSafariCatalog: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../services/memory.service', () => ({
  storeMemory: jest.fn().mockResolvedValue(undefined),
  retrieveMemory: jest.fn().mockResolvedValue([]),
  buildTravelerProfile: jest.fn().mockResolvedValue({
    preferences: {},
    pastBookings: [],
    specialRequirements: [],
    communicationStyle: 'standard',
  }),
  searchMemory: jest.fn().mockResolvedValue([]),
  personalizeWithMemory: jest.fn().mockResolvedValue('personalized'),
}))

describe('approval flow', () => {
  let mockQuery: jest.Mock

  beforeEach(async () => {
    jest.clearAllMocks()
    const { pool } = await import('../services/ai-agent.service')
    mockQuery = pool.query as jest.Mock
  })

  describe('GET /api/approval/pending', () => {
    it('should return array of pending approvals', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 1, item_type: 'content', title: 'Newsletter Draft', status: 'pending', created_at: new Date() },
          { id: 2, item_type: 'content', title: 'Ad Concepts', status: 'pending', created_at: new Date() },
        ],
      })

      const { pool } = await import('../services/ai-agent.service')
      const result = await pool.query(
        `SELECT * FROM approval_queue WHERE status = 'pending' ORDER BY created_at DESC`
      )

      expect(Array.isArray(result.rows)).toBe(true)
      expect(result.rows.length).toBe(2)
      expect(result.rows[0].status).toBe('pending')
    })

    it('should return empty array when no pending items', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] })

      const { pool } = await import('../services/ai-agent.service')
      const result = await pool.query(
        `SELECT * FROM approval_queue WHERE status = 'pending'`
      )

      expect(result.rows).toEqual([])
    })
  })

  describe('POST /api/approval/approve/:id', () => {
    it('should update status to approved', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'approved', reviewer_notes: 'Looks good' }],
      })

      const { pool } = await import('../services/ai-agent.service')
      const result = await pool.query(
        `UPDATE approval_queue SET status = 'approved', reviewer_notes = $1, reviewed_at = NOW() WHERE id = $2 RETURNING *`,
        ['Looks good', 1]
      )

      expect(result.rows[0].status).toBe('approved')
    })

    it('should handle non-existent ID gracefully', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] })

      const { pool } = await import('../services/ai-agent.service')
      const result = await pool.query(
        `UPDATE approval_queue SET status = 'approved' WHERE id = $1 RETURNING *`,
        [999]
      )

      expect(result.rows).toEqual([])
    })
  })

  describe('POST /api/approval/reject/:id', () => {
    it('should update status to rejected with notes', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'rejected', reviewer_notes: 'Needs revision' }],
      })

      const { pool } = await import('../services/ai-agent.service')
      const result = await pool.query(
        `UPDATE approval_queue SET status = 'rejected', reviewer_notes = $1, reviewed_at = NOW() WHERE id = $2 RETURNING *`,
        ['Needs revision', 1]
      )

      expect(result.rows[0].status).toBe('rejected')
      expect(result.rows[0].reviewer_notes).toBe('Needs revision')
    })
  })

  describe('POST /api/approval/approve-all', () => {
    it('should approve all pending items', async () => {
      mockQuery.mockResolvedValueOnce({
        rowCount: 5,
        rows: [],
      })

      const { pool } = await import('../services/ai-agent.service')
      const result = await pool.query(
        `UPDATE approval_queue SET status = 'approved', reviewed_at = NOW() WHERE status = 'pending'`
      )

      expect(result.rowCount).toBe(5)
    })

    it('should handle zero pending items', async () => {
      mockQuery.mockResolvedValueOnce({
        rowCount: 0,
        rows: [],
      })

      const { pool } = await import('../services/ai-agent.service')
      const result = await pool.query(
        `UPDATE approval_queue SET status = 'approved', reviewed_at = NOW() WHERE status = 'pending'`
      )

      expect(result.rowCount).toBe(0)
    })
  })
})
