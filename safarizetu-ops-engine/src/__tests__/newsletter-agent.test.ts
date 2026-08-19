jest.mock('../services/ai-agent.service', () => ({
  pool: {
    query: jest.fn().mockResolvedValue({ rows: [{ id: 'mock-id' }] }),
  },
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  callAgent: jest.fn(),
  sendEmail: jest.fn().mockResolvedValue('test-id'),
  isDbConnected: jest.fn().mockReturnValue(false),
}))

jest.mock('../services/observability.service', () => ({
  startTrace: jest.fn(() => 'trace-newsletter'),
  endTrace: jest.fn(),
  logGeneration: jest.fn(),
}))

describe('newsletter-agent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generateNewsletter', () => {
    it('should return structured output with required fields', async () => {
      const newsletterContent = JSON.stringify({
        subject: 'Safari Zetu Weekly — Zimbabwe Tourism Update',
        preview: 'This week in safari and Zimbabwe tourism',
        stories: [
          {
            headline: 'New Safari Lodge Opens in Hwange',
            summary: 'A new 20-bed luxury lodge has opened in Hwange National Park.',
            source_category: 'safari industry news',
            fact_check_needed: false,
          },
          {
            headline: 'ZTA Launches Visa Simplification',
            summary: 'The Zimbabwe Tourism Authority announced streamlined visa processing.',
            source_category: 'Zimbabwe tourism',
            fact_check_needed: true,
          },
        ],
        newsletter_markdown: '# Safari Zetu Weekly\n\n## New Safari Lodge Opens in Hwange\n\nA new lodge...',
        fact_check_flags: ['ZTA visa claim needs verification'],
      })

      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValueOnce({
        content: newsletterContent,
        tokensUsed: 500,
        model: 'mimo-v2.5-free (opencode-zen)',
        costUsd: 0,
        runLogId: 'run-1',
      })

      const { generateNewsletter } = await import('../agents/newsletter-agent')
      const result = await generateNewsletter()

      expect(result).toHaveProperty('subject')
      expect(result).toHaveProperty('preview')
      expect(result).toHaveProperty('newsletter_markdown')
      expect(result).toHaveProperty('story_count')
      expect(result).toHaveProperty('generated_at')
      expect(result.story_count).toBe(2)
      expect(typeof result.subject).toBe('string')
      expect(typeof result.generated_at).toBe('string')
    })

    it('should handle LLM returning markdown-wrapped JSON', async () => {
      const wrappedContent = '```json\n' + JSON.stringify({
        subject: 'Test Newsletter',
        preview: 'Preview text',
        stories: [],
        newsletter_markdown: 'Body content',
        fact_check_flags: [],
      }) + '\n```'

      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValueOnce({
        content: wrappedContent,
        tokensUsed: 300,
        model: 'mimo-v2.5-free (opencode-zen)',
        costUsd: 0,
        runLogId: 'run-2',
      })

      const { generateNewsletter } = await import('../agents/newsletter-agent')
      const result = await generateNewsletter()

      expect(result.subject).toBe('Test Newsletter')
      expect(result.story_count).toBe(0)
    })

    it('should handle LLM failure gracefully', async () => {
      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockRejectedValueOnce(new Error('LLM provider unavailable'))

      const { generateNewsletter } = await import('../agents/newsletter-agent')

      await expect(generateNewsletter()).rejects.toThrow('LLM provider unavailable')
    })

    it('should handle missing required fields in LLM response', async () => {
      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValueOnce({
        content: JSON.stringify({ preview: 'missing subject' }),
        tokensUsed: 100,
        model: 'mimo-v2.5-free',
        costUsd: 0,
        runLogId: null,
      })

      const { generateNewsletter } = await import('../agents/newsletter-agent')

      await expect(generateNewsletter()).rejects.toThrow('missing required fields')
    })

    it('should return structured output in fallback mode when DB unavailable', async () => {
      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValueOnce({
        content: JSON.stringify({
          subject: 'Fallback Newsletter',
          preview: 'Fallback preview',
          stories: [],
          newsletter_markdown: 'Fallback body',
          fact_check_flags: [],
        }),
        tokensUsed: 200,
        model: 'mimo-v2.5-free (opencode-zen)',
        costUsd: 0,
        runLogId: 'run-3',
      })

      const { generateNewsletter } = await import('../agents/newsletter-agent')
      const result = await generateNewsletter()

      expect(result).toHaveProperty('subject', 'Fallback Newsletter')
      expect(result).toHaveProperty('newsletter_markdown', 'Fallback body')
    })
  })
})
