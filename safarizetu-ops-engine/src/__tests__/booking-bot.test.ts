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
  sendEmail: jest.fn().mockResolvedValue('email-sent'),
  isDbConnected: jest.fn().mockReturnValue(false),
}))

jest.mock('../services/observability.service', () => ({
  startTrace: jest.fn(() => 'trace-booking'),
  endTrace: jest.fn(),
  logGeneration: jest.fn(),
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

jest.mock('../services/chroma.service', () => ({
  queryCollection: jest.fn().mockResolvedValue([]),
  ragQuery: jest.fn().mockResolvedValue('Based on Safari Zetu catalog: lodges available'),
  upsertDocuments: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../services/email-templates', () => ({
  bookingConfirmationEmail: jest.fn().mockReturnValue('<html>booking confirmation</html>'),
}))

describe('booking-bot', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('handleIncomingMessage', () => {
    it('should parse booking request correctly', async () => {
      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValueOnce({
        content: 'I see you want to book a Victoria Falls safari for 2 guests. Let me help you with that.',
        tokensUsed: 200,
        model: 'mimo-v2.5-free',
        costUsd: 0,
        runLogId: null,
      })

      const { handleIncomingMessage } = await import('../agents/booking-bot')
      const result = await handleIncomingMessage({
        conversation_id: 'conv-1',
        platform: 'whatsapp',
        platform_user_id: 'user-1',
        message: 'I want to book a Victoria Falls safari for 2 guests on 15 August',
      })

      expect(result).toHaveProperty('conversation_id', 'conv-1')
      expect(result).toHaveProperty('reply')
      expect(result).toHaveProperty('intent')
      expect(result).toHaveProperty('entities')
      expect(result).toHaveProperty('action')
      expect(typeof result.reply).toBe('string')
      expect(result.reply.length).toBeGreaterThan(0)
    })

    it('should return structured response with all fields', async () => {
      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValueOnce({
        content: 'Hello! Welcome to Safari Zetu.',
        tokensUsed: 50,
        model: 'mimo-v2.5-free',
        costUsd: 0,
        runLogId: null,
      })

      const { handleIncomingMessage } = await import('../agents/booking-bot')
      const result = await handleIncomingMessage({
        conversation_id: 'conv-2',
        platform: 'telegram',
        platform_user_id: 'user-2',
        message: 'Hello',
      })

      expect(result).toHaveProperty('conversation_id')
      expect(result).toHaveProperty('reply')
      expect(result).toHaveProperty('intent')
      expect(result).toHaveProperty('entities')
      expect(result.intent).toBe('greeting')
      expect(result.action).toBe('info')
    })

    it('should detect browse intent', async () => {
      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValueOnce({
        content: 'Here are some safari options for you.',
        tokensUsed: 100,
        model: 'mimo-v2.5-free',
        costUsd: 0,
        runLogId: null,
      })

      const { handleIncomingMessage } = await import('../agents/booking-bot')
      const result = await handleIncomingMessage({
        conversation_id: 'conv-3',
        platform: 'web',
        platform_user_id: 'user-3',
        message: 'Show me what safaris are available',
      })

      expect(result.intent).toBe('browse')
      expect(result.action).toBe('browse')
    })

    it('should detect book intent with entities', async () => {
      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValueOnce({
        content: 'Great, let me book that for you.',
        tokensUsed: 100,
        model: 'mimo-v2.5-free',
        costUsd: 0,
        runLogId: null,
      })

      const { handleIncomingMessage } = await import('../agents/booking-bot')
      const result = await handleIncomingMessage({
        conversation_id: 'conv-4',
        platform: 'whatsapp',
        platform_user_id: 'user-4',
        message: 'I want to book a Hwange safari for 3 guests on 20 September',
      })

      expect(result.intent).toBe('book')
      expect(result.action).toBe('book')
      expect(result.booking_data).toBeDefined()
    })

    it('should handle cancel intent', async () => {
      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValueOnce({
        content: 'I understand you want to cancel. Let me help.',
        tokensUsed: 80,
        model: 'mimo-v2.5-free',
        costUsd: 0,
        runLogId: null,
      })

      const { handleIncomingMessage } = await import('../agents/booking-bot')
      const result = await handleIncomingMessage({
        conversation_id: 'conv-5',
        platform: 'web',
        platform_user_id: 'user-5',
        message: 'I want to cancel this trip',
      })

      expect(result.intent).toBe('cancel')
      expect(result.action).toBe('cancel')
    })

    it('should handle help intent with transfer action', async () => {
      const { handleIncomingMessage } = await import('../agents/booking-bot')
      const result = await handleIncomingMessage({
        conversation_id: 'conv-6',
        platform: 'web',
        platform_user_id: 'user-6',
        message: 'I need help, speak to someone',
      })

      expect(result.intent).toBe('help')
      expect(result.action).toBe('transfer')
      expect(result.reply).toContain('human agent')
    })

    it('should handle invalid/empty input gracefully', async () => {
      const { handleIncomingMessage } = await import('../agents/booking-bot')
      const result = await handleIncomingMessage({
        conversation_id: 'conv-7',
        platform: 'web',
        platform_user_id: 'user-7',
        message: '',
      })

      expect(result).toHaveProperty('reply')
      expect(result).toHaveProperty('intent')
      expect(typeof result.reply).toBe('string')
    })
  })
})
