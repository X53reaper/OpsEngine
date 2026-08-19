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
  startTrace: jest.fn(() => 'trace-competitor'),
  endTrace: jest.fn(),
  logGeneration: jest.fn(),
}))

describe('competitor-ad-agent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('analyzeCompetitorAds', () => {
    it('should return structured analysis output', async () => {
      const analysisContent = JSON.stringify({
        competitor: 'Wilderness Safaris',
        winning_patterns: ['Story-driven video', 'UGC testimonials', 'Destination hero imagery'],
        audience_angles: ['Luxury travelers', 'Adventure seekers'],
        copy_frameworks: ['Question hook → benefit → CTA'],
        visual_brief: 'High-production wildlife imagery with golden-hour tones',
        compliance_risks: ['Unsubstantiated availability claims'],
        adaptation_plan: 'Use first-party testimonials and real booking data for social proof.',
      })

      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValueOnce({
        content: analysisContent,
        tokensUsed: 400,
        model: 'mimo-v2.5-free',
        costUsd: 0,
        runLogId: 'run-1',
      })

      const { analyzeCompetitorAds } = await import('../agents/competitor-ad-agent')
      const result = await analyzeCompetitorAds('Wilderness Safaris', 'facebook')

      expect(result).toHaveProperty('competitor', 'Wilderness Safaris')
      expect(result).toHaveProperty('winning_patterns')
      expect(Array.isArray(result.winning_patterns)).toBe(true)
      expect(result).toHaveProperty('audience_angles')
      expect(result).toHaveProperty('copy_frameworks')
      expect(result).toHaveProperty('visual_brief')
      expect(result).toHaveProperty('compliance_risks')
      expect(result).toHaveProperty('adaptation_plan')
    })

    it('should handle missing competitor data with fallback', async () => {
      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValueOnce({
        content: 'not valid json',
        tokensUsed: 100,
        model: 'mimo-v2.5-free',
        costUsd: 0,
        runLogId: null,
      })

      const { analyzeCompetitorAds } = await import('../agents/competitor-ad-agent')
      const result = await analyzeCompetitorAds('Unknown Competitor')

      expect(result).toHaveProperty('competitor', 'Unknown Competitor')
      expect(result).toHaveProperty('winning_patterns')
      expect(Array.isArray(result.winning_patterns)).toBe(true)
      expect(result.winning_patterns.length).toBeGreaterThan(0)
    })

    it('should fall back to default analysis when LLM returns invalid JSON', async () => {
      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValueOnce({
        content: 'Here is the analysis of the competitor...',
        tokensUsed: 150,
        model: 'mimo-v2.5-free',
        costUsd: 0,
        runLogId: null,
      })

      const { analyzeCompetitorAds } = await import('../agents/competitor-ad-agent')
      const result = await analyzeCompetitorAds('Singita')

      expect(result.competitor).toBe('Singita')
      expect(result.winning_patterns.length).toBeGreaterThan(0)
      expect(result.compliance_risks.length).toBeGreaterThan(0)
    })
  })

  describe('generateAdConcepts', () => {
    it('should return ad concept pack with required fields', async () => {
      const conceptContent = JSON.stringify({
        concepts: [
          {
            id: 'concept-1',
            concept_name: 'Discovery Hook',
            primary_text: 'Discover Zimbabwe safaris...',
            headline: 'Explore Safari Zetu',
            description: 'Book your dream safari',
            image_prompt: 'Safari landscape at golden hour',
            target_audience: 'Luxury travelers',
            platform: 'facebook',
            cta: 'Learn More',
          },
        ],
        test_matrix: [
          { variant_a: 'Concept A', variant_b: 'Concept B', metric: 'CTR' },
        ],
        competitor: 'Wilderness Safaris',
        generated_at: new Date().toISOString(),
      })

      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValueOnce({
        content: conceptContent,
        tokensUsed: 600,
        model: 'mimo-v2.5-free',
        costUsd: 0,
        runLogId: 'run-2',
      })

      const { generateAdConcepts } = await import('../agents/competitor-ad-agent')
      const analysis = {
        competitor: 'Wilderness Safaris',
        winning_patterns: ['Story-driven video'],
        audience_angles: ['Luxury travelers'],
        copy_frameworks: ['Question hook'],
        visual_brief: 'Wildlife imagery',
        compliance_risks: ['Unsubstantiated claims'],
        adaptation_plan: 'Use original testimonials',
      }

      const result = await generateAdConcepts(analysis)

      expect(result).toHaveProperty('concepts')
      expect(Array.isArray(result.concepts)).toBe(true)
      expect(result.concepts.length).toBeGreaterThan(0)
      expect(result).toHaveProperty('test_matrix')
      expect(result).toHaveProperty('competitor', 'Wilderness Safaris')
      expect(result).toHaveProperty('generated_at')
    })

    it('should handle missing competitor data gracefully', async () => {
      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValueOnce({
        content: 'invalid json',
        tokensUsed: 50,
        model: 'mimo-v2.5-free',
        costUsd: 0,
        runLogId: null,
      })

      const { generateAdConcepts } = await import('../agents/competitor-ad-agent')
      const analysis = {
        competitor: 'Test Competitor',
        winning_patterns: ['Pattern 1'],
        audience_angles: ['Angle 1'],
        copy_frameworks: ['Framework 1'],
        visual_brief: 'Brief',
        compliance_risks: ['Risk 1'],
        adaptation_plan: 'Plan',
      }

      const result = await generateAdConcepts(analysis)

      expect(result.concepts.length).toBeGreaterThan(0)
      expect(result.test_matrix.length).toBeGreaterThan(0)
      expect(result.competitor).toBe('Test Competitor')
    })
  })

  describe('runCompetitorAdResearch', () => {
    it('should return research summary with counts', async () => {
      const analysisContent = JSON.stringify({
        competitor: 'Test',
        winning_patterns: ['P1'],
        audience_angles: ['A1'],
        copy_frameworks: ['F1'],
        visual_brief: 'VB',
        compliance_risks: ['R1'],
        adaptation_plan: 'AP',
      })

      const conceptContent = JSON.stringify({
        concepts: [
          {
            id: 'c1',
            concept_name: 'Concept 1',
            primary_text: 'Text',
            headline: 'Headline',
            description: 'Desc',
            image_prompt: 'Image',
            target_audience: 'Audience',
            platform: 'facebook',
            cta: 'CTA',
          },
        ],
        test_matrix: [],
        competitor: 'Test',
        generated_at: new Date().toISOString(),
      })

      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock)
        .mockResolvedValueOnce({ content: analysisContent, tokensUsed: 200, model: 'mimo-v2.5-free', costUsd: 0, runLogId: null })
        .mockResolvedValueOnce({ content: conceptContent, tokensUsed: 300, model: 'mimo-v2.5-free', costUsd: 0, runLogId: null })

      const { runCompetitorAdResearch } = await import('../agents/competitor-ad-agent')
      const result = await runCompetitorAdResearch()

      expect(result).toHaveProperty('competitors_analyzed')
      expect(result).toHaveProperty('concepts_generated')
      expect(typeof result.competitors_analyzed).toBe('number')
      expect(typeof result.concepts_generated).toBe('number')
    })
  })
})
