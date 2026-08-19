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
  startTrace: jest.fn(() => 'trace-seo'),
  endTrace: jest.fn(),
  logGeneration: jest.fn(),
}))

jest.mock('../services/chroma.service', () => ({
  upsertDocuments: jest.fn().mockResolvedValue(undefined),
  queryCollection: jest.fn().mockResolvedValue([]),
}))

describe('seo-content-factory', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createResearchReport', () => {
    it('should return structured research report', async () => {
      const researchContent = JSON.stringify({
        search_intent: 'informational — user wants to learn about Victoria Falls safaris',
        reader_questions: [
          'What is the best time to visit Victoria Falls?',
          'How much does a Victoria Falls safari cost?',
        ],
        ranking_criteria: ['Comprehensive guide with pricing', 'First-hand experience'],
        source_summary: 'Top results provide detailed guides with pricing and itineraries.',
        recommended_outline: [
          { heading: 'Introduction', level: 'H2', notes: 'Hook with the falls' },
          { heading: 'Planning Your Trip', level: 'H2', notes: 'Logistics' },
        ],
        fact_check_flags: ['Pricing should be verified'],
      })

      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValueOnce({
        content: researchContent,
        tokensUsed: 400,
        model: 'mimo-v2.5-free',
        costUsd: 0,
        runLogId: 'run-1',
      })

      const { createResearchReport } = await import('../agents/seo-content-factory')
      const result = await createResearchReport('Victoria Falls safari guide')

      expect(result).toHaveProperty('search_intent')
      expect(result).toHaveProperty('reader_questions')
      expect(Array.isArray(result.reader_questions)).toBe(true)
      expect(result).toHaveProperty('ranking_criteria')
      expect(result).toHaveProperty('recommended_outline')
      expect(result).toHaveProperty('fact_check_flags')
    })

    it('should handle keyword research failure with structured fallback', async () => {
      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValueOnce({
        content: 'not valid json at all',
        tokensUsed: 100,
        model: 'mimo-v2.5-free',
        costUsd: 0,
        runLogId: null,
      })

      const { createResearchReport } = await import('../agents/seo-content-factory')
      const result = await createResearchReport('Hwange National Park safari')

      expect(result.search_intent).toContain('Hwange National Park safari')
      expect(result.reader_questions.length).toBeGreaterThan(0)
      expect(result.ranking_criteria.length).toBeGreaterThan(0)
      expect(result.recommended_outline.length).toBeGreaterThan(0)
    })

    it('should fall back to mock mode when LLM is unavailable', async () => {
      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockRejectedValueOnce(new Error('All LLM providers failed'))

      const { createResearchReport } = await import('../agents/seo-content-factory')

      await expect(createResearchReport('test keyword')).rejects.toThrow('All LLM providers failed')
    })
  })

  describe('writeSEOArticle', () => {
    it('should return article with required sections', async () => {
      const articleContent = JSON.stringify({
        title: 'Complete Guide to Victoria Falls Safari',
        meta_title: 'Victoria Falls Safari Guide | Safari Zetu',
        meta_description: 'Plan your Victoria Falls safari with expert tips and costs.',
        slug: 'victoria-falls-safari-guide',
        intro: 'Standing at the edge of Victoria Falls, mist on your face...',
        body_markdown: '# Victoria Falls Safari Guide\n\n## Getting There\n\nFly into Victoria Falls Airport...',
        conclusion: 'Ready to plan your Victoria Falls safari?',
        faq: [
          { question: 'When is the best time to visit?', answer: 'October to December for high water.' },
        ],
        citations_to_verify: ['Entry fee amounts'],
        ranking_criteria: ['Comprehensive guide'],
      })

      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValueOnce({
        content: articleContent,
        tokensUsed: 800,
        model: 'deepseek-v4-flash-free',
        costUsd: 0,
        runLogId: 'run-2',
      })

      const { writeSEOArticle } = await import('../agents/seo-content-factory')
      const research = {
        search_intent: 'informational',
        reader_questions: ['What is the best time?'],
        ranking_criteria: ['Comprehensive guide'],
        source_summary: 'Top results provide detailed guides.',
        recommended_outline: [{ heading: 'Intro', level: 'H2' as const, notes: 'Hook' }],
        fact_check_flags: ['Pricing needs verification'],
      }

      const result = await writeSEOArticle('Victoria Falls safari guide', research)

      expect(result).toHaveProperty('title')
      expect(result).toHaveProperty('meta_title')
      expect(result).toHaveProperty('meta_description')
      expect(result).toHaveProperty('slug')
      expect(result).toHaveProperty('intro')
      expect(result).toHaveProperty('body_markdown')
      expect(result).toHaveProperty('conclusion')
      expect(result).toHaveProperty('faq')
      expect(Array.isArray(result.faq)).toBe(true)
      expect(result).toHaveProperty('citations_to_verify')
      expect(result).toHaveProperty('cms', 'Ghost')
      expect(result).toHaveProperty('publish_mode', 'DRAFT_ONLY')
      expect(result).toHaveProperty('approval_status', 'NEEDS_FACT_CHECK_AND_HUMAN_REVIEW')
    })

    it('should handle parse failure with minimal draft fallback', async () => {
      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValueOnce({
        content: 'not valid json',
        tokensUsed: 50,
        model: 'mimo-v2.5-free',
        costUsd: 0,
        runLogId: null,
      })

      const { writeSEOArticle } = await import('../agents/seo-content-factory')
      const research = {
        search_intent: 'informational',
        reader_questions: ['Q1'],
        ranking_criteria: ['C1'],
        source_summary: 'Summary',
        recommended_outline: [{ heading: 'H1', level: 'H2' as const, notes: 'n' }],
        fact_check_flags: [],
      }

      const result = await writeSEOArticle('test keyword', research)

      expect(result.title).toContain('test keyword')
      expect(result.body_markdown).toContain('NEEDS FULL GENERATION')
      expect(result.cms).toBe('Ghost')
      expect(result.publish_mode).toBe('DRAFT_ONLY')
    })
  })

  describe('getDefaultKeywords', () => {
    it('should return array of default keywords', async () => {
      const { getDefaultKeywords } = await import('../agents/seo-content-factory')
      const keywords = getDefaultKeywords()

      expect(Array.isArray(keywords)).toBe(true)
      expect(keywords.length).toBeGreaterThan(0)
      expect(keywords.some(k => k.includes('safari'))).toBe(true)
    })
  })
})
