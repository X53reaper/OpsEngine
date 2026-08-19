import { createHmac } from 'crypto'

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
  sendEmail: jest.fn().mockResolvedValue('test-email-id'),
  isDbConnected: jest.fn().mockReturnValue(false),
}))

jest.mock('../services/security.service', () => ({
  escapeHtml: jest.fn((s: string) => s),
  detectSqlInjection: jest.fn(() => false),
  detectXss: jest.fn(() => false),
  validateInputLength: jest.fn(() => ({ valid: true })),
}))

jest.mock('../agents/division1-growth', () => ({
  acknowledgeEnquiry: jest.fn().mockResolvedValue(undefined),
  sendOperatorActivation: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../agents/contract-generator', () => ({
  generateContract: jest.fn().mockResolvedValue({ contract_id: 'c-1', content: 'contract' }),
  sendContractToPartner: jest.fn().mockResolvedValue(undefined),
}))

describe('webhook signature verification', () => {
  const WEBHOOK_SECRET = 'test-webhook-secret-12345'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('verifyWebhookSignature', () => {
    it('should accept valid HMAC signature', async () => {
      process.env.SAFARI_ZETU_WEBHOOK_SECRET = WEBHOOK_SECRET

      const { verifyWebhookSignature } = await import('../webhook/receiver')

      const body = JSON.stringify({ event: 'test', data: {} })
      const signature = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex')

      expect(verifyWebhookSignature(body, signature)).toBe(true)
    })

    it('should reject invalid HMAC signature', async () => {
      process.env.SAFARI_ZETU_WEBHOOK_SECRET = WEBHOOK_SECRET

      const { verifyWebhookSignature } = await import('../webhook/receiver')

      const body = JSON.stringify({ event: 'test', data: {} })
      expect(verifyWebhookSignature(body, 'invalid-signature-hex')).toBe(false)
    })

    it('should reject missing signature', async () => {
      process.env.SAFARI_ZETU_WEBHOOK_SECRET = WEBHOOK_SECRET

      const { verifyWebhookSignature } = await import('../webhook/receiver')

      expect(verifyWebhookSignature('body', '')).toBe(false)
    })

    it('should reject when WEBHOOK_SECRET is not set', async () => {
      process.env.SAFARI_ZETU_WEBHOOK_SECRET = ''

      const { verifyWebhookSignature } = await import('../webhook/receiver')

      const body = 'test-body'
      const signature = createHmac('sha256', 'anything').update(body).digest('hex')
      expect(verifyWebhookSignature(body, signature)).toBe(false)
    })
  })

  describe('handleWebhook', () => {
    it('should accept valid payload with correct signature', async () => {
      process.env.SAFARI_ZETU_WEBHOOK_SECRET = WEBHOOK_SECRET

      const { handleWebhook } = await import('../webhook/receiver')

      const data = { id: 'booking-1', name: 'Test Booking' }
      const rawBody = JSON.stringify(data)
      const signature = createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex')

      await expect(
        handleWebhook('booking.completed', data, signature, rawBody)
      ).resolves.not.toThrow()
    })

    it('should reject invalid signature', async () => {
      process.env.SAFARI_ZETU_WEBHOOK_SECRET = WEBHOOK_SECRET

      const { handleWebhook } = await import('../webhook/receiver')

      await expect(
        handleWebhook('booking.completed', { id: '1' }, 'bad-sig', 'body')
      ).rejects.toThrow('Invalid webhook signature')
    })

    it('should handle valid JSON payload correctly', async () => {
      process.env.SAFARI_ZETU_WEBHOOK_SECRET = WEBHOOK_SECRET

      const { handleWebhook } = await import('../webhook/receiver')

      const data = { id: 'review-1', rating: 5 }
      const rawBody = JSON.stringify(data)
      const signature = createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex')

      await expect(
        handleWebhook('review.submitted', data, signature, rawBody)
      ).resolves.not.toThrow()
    })

    it('should throw on invalid webhook data', async () => {
      process.env.SAFARI_ZETU_WEBHOOK_SECRET = WEBHOOK_SECRET

      const { handleWebhook } = await import('../webhook/receiver')

      await expect(
        handleWebhook('operator.registered', null)
      ).rejects.toThrow('Invalid webhook data')
    })

    it('should throw on invalid email in webhook data', async () => {
      process.env.SAFARI_ZETU_WEBHOOK_SECRET = WEBHOOK_SECRET

      const { handleWebhook } = await import('../webhook/receiver')

      await expect(
        handleWebhook('operator.registered', { id: '1', email: 'not-an-email' })
      ).rejects.toThrow('Invalid webhook data')
    })
  })
})
