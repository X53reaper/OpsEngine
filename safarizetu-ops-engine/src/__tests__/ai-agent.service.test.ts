jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
  format: {
    combine: jest.fn(() => ({})),
    timestamp: jest.fn(() => ({})),
    printf: jest.fn(() => ({})),
    simple: jest.fn(() => ({})),
  },
  transports: {
    File: jest.fn(),
    Console: jest.fn(),
  },
}))

jest.mock('../services/observability.service', () => ({
  startTrace: jest.fn(() => 'trace-mock-1'),
  endTrace: jest.fn(),
  logGeneration: jest.fn(),
}))

jest.mock('pg', () => {
  const mockQuery = jest.fn().mockResolvedValue({ rows: [{ id: 'mock-id' }] })
  return {
    Pool: jest.fn(() => ({
      query: mockQuery,
      end: jest.fn(),
    })),
    __mockQuery: mockQuery,
  }
})

const mockFetch = jest.fn()
global.fetch = mockFetch as any

describe('ai-agent.service', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
    process.env.OPENCODE_ZEN_API_KEY = 'test-zen-key'
    process.env.OPENCODE_ZEN_BASE_URL = 'https://test.example.com/zen/v1'
    mockFetch.mockReset()
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('callAgent', () => {
    it('should return structured result with content, tokensUsed, model, costUsd, runLogId', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"result":"test"}' } }],
          usage: { total_tokens: 100 },
        }),
      })

      const { callAgent } = await import('../services/ai-agent.service')

      const result = await callAgent({
        agentName: 'test_agent',
        division: 'test',
        model: 'light',
        systemPrompt: 'You are a test',
        userMessage: 'Hello',
        triggerType: 'test',
      })

      expect(result).toHaveProperty('content')
      expect(result).toHaveProperty('tokensUsed', 100)
      expect(result).toHaveProperty('model')
      expect(result).toHaveProperty('costUsd')
      expect(result).toHaveProperty('runLogId')
    })

    it('should use default light model when model not specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'ok' } }],
          usage: { total_tokens: 50 },
        }),
      })

      const { callAgent } = await import('../services/ai-agent.service')

      const result = await callAgent({
        agentName: 'test',
        division: 'test',
        systemPrompt: 'test',
        userMessage: 'test',
        triggerType: 'test',
      })

      expect(result.model).toContain('mimo-v2.5-free')
    })

    it('should throw when all LLM providers fail', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'rate limited',
      })

      const { callAgent } = await import('../services/ai-agent.service')

      await expect(
        callAgent({
          agentName: 'test',
          division: 'test',
          systemPrompt: 'test',
          userMessage: 'test',
          triggerType: 'test',
        })
      ).rejects.toThrow('All LLM providers failed')
    })
  })

  describe('sendEmail', () => {
    it('should block emails when PUBLIC_ACTIONS_ENABLED=false', async () => {
      process.env.PUBLIC_ACTIONS_ENABLED = 'false'
      process.env.EMAIL_TEST_MODE = 'false'

      const { sendEmail } = await import('../services/ai-agent.service')

      const result = await sendEmail('test@example.com', 'Subject', '<p>Hello</p>')

      expect(result).toBe('blocked-safety-flag')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should redirect to test address when EMAIL_TEST_MODE=true', async () => {
      process.env.PUBLIC_ACTIONS_ENABLED = 'true'
      process.env.EMAIL_TEST_MODE = 'true'
      process.env.EMAIL_TEST_OVERRIDE = 'test-override@example.com'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'email-test-123' }),
      })

      const { sendEmail } = await import('../services/ai-agent.service')

      const result = await sendEmail('real@example.com', 'Real Subject', '<p>Hi</p>')

      expect(result).toBe('email-test-123')
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(callBody.to).toEqual(['test-override@example.com'])
      expect(callBody.subject).toContain('[TEST')
      expect(callBody.html).toContain('TEST MODE')
    })

    it('should send to actual recipient when test mode is off', async () => {
      process.env.PUBLIC_ACTIONS_ENABLED = 'true'
      process.env.EMAIL_TEST_MODE = 'false'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'email-real-456' }),
      })

      const { sendEmail } = await import('../services/ai-agent.service')

      const result = await sendEmail('real@example.com', 'Subject', '<p>Hi</p>')

      expect(result).toBe('email-real-456')
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(callBody.to).toEqual(['real@example.com'])
    })

    it('should throw on Resend API error', async () => {
      process.env.PUBLIC_ACTIONS_ENABLED = 'true'
      process.env.EMAIL_TEST_MODE = 'false'

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      })

      const { sendEmail } = await import('../services/ai-agent.service')

      await expect(
        sendEmail('test@example.com', 'Subject', '<p>Hi</p>')
      ).rejects.toThrow('Resend error: 403')
    })
  })

  describe('isDbConnected', () => {
    it('should return a boolean', async () => {
      const { isDbConnected } = await import('../services/ai-agent.service')
      const result = isDbConnected()
      expect(typeof result).toBe('boolean')
    })
  })

  describe('pool', () => {
    it('should have a query method', async () => {
      const { pool } = await import('../services/ai-agent.service')
      expect(pool).toBeDefined()
      expect(typeof pool.query).toBe('function')
    })
  })
})
