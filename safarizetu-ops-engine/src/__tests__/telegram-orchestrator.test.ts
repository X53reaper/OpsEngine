jest.mock('../services/ai-agent.service', () => ({
  pool: {
    query: jest.fn().mockResolvedValue({ rows: [] }),
  },
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  callAgent: jest.fn(),
  sendEmail: jest.fn(),
  isDbConnected: jest.fn().mockReturnValue(false),
}))

jest.mock('../services/observability.service', () => ({
  startTrace: jest.fn(() => 'trace-telegram'),
  endTrace: jest.fn(),
  logGeneration: jest.fn(),
}))

describe('telegram-orchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('routeTelegramCommand', () => {
    it('should route to correct specialist', async () => {
      const routeResponse = JSON.stringify({
        specialist: 'email',
        action: 'send_email',
        needs_approval: true,
        parameters: { to: 'user@example.com', subject: 'Test', body: 'Hello' },
      })

      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValueOnce({
        content: routeResponse,
        tokensUsed: 100,
        model: 'mimo-v2.5-free',
        costUsd: 0,
        runLogId: 'run-1',
      })

      const { routeTelegramCommand } = await import('../agents/telegram-orchestrator')
      const result = await routeTelegramCommand({
        chat_id: 'chat-123',
        text: 'Send an email to user@example.com',
        has_media: false,
        received_at: new Date().toISOString(),
      })

      expect(result).toHaveProperty('specialist', 'email')
      expect(result).toHaveProperty('action', 'send_email')
      expect(result).toHaveProperty('needs_approval', true)
      expect(result).toHaveProperty('chat_id', 'chat-123')
      expect(result).toHaveProperty('approval_status', 'PENDING')
    })

    it('should return approval_required flag', async () => {
      const routeResponse = JSON.stringify({
        specialist: 'posting',
        action: 'post_social',
        needs_approval: false,
        parameters: { platform: 'twitter', content: 'Hello world' },
      })

      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValueOnce({
        content: routeResponse,
        tokensUsed: 80,
        model: 'mimo-v2.5-free',
        costUsd: 0,
        runLogId: 'run-2',
      })

      const { routeTelegramCommand } = await import('../agents/telegram-orchestrator')
      const result = await routeTelegramCommand({
        chat_id: 'chat-456',
        text: 'Post to social media',
        has_media: false,
        received_at: new Date().toISOString(),
      })

      expect(result.needs_approval).toBe(true) // posting requires approval per config
      expect(result.approval_status).toBe('PENDING')
    })

    it('should handle unknown commands with human_review fallback', async () => {
      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockRejectedValueOnce(new Error('Parse failed'))

      const { routeTelegramCommand } = await import('../agents/telegram-orchestrator')
      const result = await routeTelegramCommand({
        chat_id: 'chat-789',
        text: 'gibberish random text',
        has_media: false,
        received_at: new Date().toISOString(),
      })

      expect(result.specialist).toBe('human_review')
      expect(result.action).toBe('manual_triage')
      expect(result.needs_approval).toBe(true)
    })

    it('should set needs_approval from specialist config (not LLM)', async () => {
      const routeResponse = JSON.stringify({
        specialist: 'research',
        action: 'research_topic',
        needs_approval: true, // LLM says true, but config says false
        parameters: { query: 'test' },
      })

      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValueOnce({
        content: routeResponse,
        tokensUsed: 50,
        model: 'mimo-v2.5-free',
        costUsd: 0,
        runLogId: null,
      })

      const { routeTelegramCommand } = await import('../agents/telegram-orchestrator')
      const result = await routeTelegramCommand({
        chat_id: 'chat-999',
        text: 'Research something',
        has_media: false,
        received_at: new Date().toISOString(),
      })

      expect(result.needs_approval).toBe(false) // research doesn't require approval
      expect(result.approval_status).toBe('APPROVED')
    })

    it('should handle invalid specialist from LLM', async () => {
      const routeResponse = JSON.stringify({
        specialist: 'nonexistent_specialist',
        action: 'do_stuff',
        needs_approval: false,
        parameters: {},
      })

      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValueOnce({
        content: routeResponse,
        tokensUsed: 50,
        model: 'mimo-v2.5-free',
        costUsd: 0,
        runLogId: null,
      })

      const { routeTelegramCommand } = await import('../agents/telegram-orchestrator')
      const result = await routeTelegramCommand({
        chat_id: 'chat-000',
        text: 'Do something',
        has_media: false,
        received_at: new Date().toISOString(),
      })

      // Falls back to human_review on unknown specialist
      expect(result.specialist).toBe('human_review')
    })
  })
})
