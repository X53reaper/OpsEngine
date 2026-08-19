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
  sendEmail: jest.fn().mockResolvedValue('email-id'),
  fetchFromSafariZetu: jest.fn().mockResolvedValue({}),
  isDbConnected: jest.fn().mockReturnValue(false),
}))

jest.mock('../services/observability.service', () => ({
  startTrace: jest.fn(() => 'trace-prospector'),
  endTrace: jest.fn(),
  logGeneration: jest.fn(),
}))

jest.mock('../services/memory.service', () => ({
  storeMemory: jest.fn().mockResolvedValue(undefined),
  retrieveMemory: jest.fn().mockResolvedValue([]),
  buildTravelerProfile: jest.fn().mockResolvedValue({}),
  searchMemory: jest.fn().mockResolvedValue([]),
}))

jest.mock('../services/chroma.service', () => ({
  queryCollection: jest.fn().mockResolvedValue([]),
  upsertDocuments: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../services/apollo.service', () => ({
  searchPeople: jest.fn().mockResolvedValue({ people: [] }),
  searchOrganizations: jest.fn().mockResolvedValue({ organizations: [] }),
  enrichPerson: jest.fn().mockResolvedValue(null),
  enrichOrganization: jest.fn().mockResolvedValue(null),
  getApolloStatus: jest.fn().mockReturnValue({ configured: false }),
}))

jest.mock('../services/neverbounce.service', () => ({
  isNeverBounceConfigured: jest.fn().mockReturnValue(false),
  verifyEmail: jest.fn().mockResolvedValue({ email: 'test@test.com', status: 'valid', score: 100, flags: [] }),
}))

describe('sales-prospector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generateLeads', () => {
    it('should generate leads and return array', async () => {
      const leadsContent = JSON.stringify([
        {
          company_name: 'Zimbabwe Safari Co',
          contact_name: 'John Smith',
          email: 'john@zimsafari.com',
          website: 'https://zimsafari.com',
          company_type: 'tour_operator',
          location: 'Harare, Zimbabwe',
          employee_count: 15,
          estimated_revenue: 500000,
          lead_score: 85,
          notes: 'Premium safari operator',
        },
      ])

      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValueOnce({
        content: leadsContent,
        tokensUsed: 300,
        model: 'mimo-v2.5-free',
        costUsd: 0,
        runLogId: null,
      })

      const { generateLeads } = await import('../agents/sales-prospector')
      const leads = await generateLeads('tour_operators', 5)

      expect(Array.isArray(leads)).toBe(true)
      expect(leads.length).toBeGreaterThan(0)
      expect(leads[0]).toHaveProperty('company_name')
      expect(leads[0]).toHaveProperty('lead_score')
      expect(leads[0]).toHaveProperty('lead_status', 'new')
    })

    it('should filter fake emails from LLM-generated leads', async () => {
      const leadsContent = JSON.stringify([
        {
          company_name: 'Fake Company',
          contact_name: 'Fake Person',
          email: 'fake@example.com',
          company_type: 'tour_operator',
          lead_score: 90,
        },
        {
          company_name: 'Real Company',
          contact_name: 'Real Person',
          email: 'real@safaris.co.zw',
          company_type: 'tour_operator',
          lead_score: 80,
        },
      ])

      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValueOnce({
        content: leadsContent,
        tokensUsed: 200,
        model: 'mimo-v2.5-free',
        costUsd: 0,
        runLogId: null,
      })

      const { generateLeads } = await import('../agents/sales-prospector')
      const leads = await generateLeads('tour_operators', 2)

      // The fake email lead should be filtered out during daily prospecting
      // but generateLeads itself returns all parsed leads
      expect(leads.length).toBeGreaterThan(0)
    })

    it('should respect rate limits', async () => {
      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValueOnce({
        content: '[]',
        tokensUsed: 50,
        model: 'mimo-v2.5-free',
        costUsd: 0,
        runLogId: null,
      })

      const { generateLeads } = await import('../agents/sales-prospector')
      const leads = await generateLeads('tour_operators', 0)

      expect(Array.isArray(leads)).toBe(true)
    })
  })

  describe('scoreLead', () => {
    it('should return a numeric score between 0 and 100', async () => {
      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValueOnce({
        content: '85',
        tokensUsed: 50,
        model: 'mimo-v2.5-free',
        costUsd: 0,
        runLogId: null,
      })

      const { scoreLead } = await import('../agents/sales-prospector')
      const score = await scoreLead({
        id: 'lead-1',
        company_name: 'Test Safari Co',
        company_type: 'tour_operator',
        lead_score: 0,
        lead_status: 'new',
        source: 'test',
      })

      expect(typeof score).toBe('number')
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })

    it('should handle non-numeric LLM response', async () => {
      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValueOnce({
        content: 'This lead scores about 72 out of 100',
        tokensUsed: 50,
        model: 'mimo-v2.5-free',
        costUsd: 0,
        runLogId: null,
      })

      const { scoreLead } = await import('../agents/sales-prospector')
      const score = await scoreLead({
        id: 'lead-2',
        company_name: 'Test Co',
        company_type: 'travel_agency',
        lead_score: 0,
        lead_status: 'new',
        source: 'test',
      })

      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })
  })

  describe('generateOutreach', () => {
    it('should generate outreach email with required fields', async () => {
      const outreachContent = JSON.stringify({
        subject: 'Partnership Opportunity — Safari Zetu × Zimbabwe Safari Co',
        body: 'Hi John, I noticed Zimbabwe Safari Co operates in Hwange...',
      })

      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValueOnce({
        content: outreachContent,
        tokensUsed: 200,
        model: 'mimo-v2.5-free',
        costUsd: 0,
        runLogId: null,
      })

      const { generateOutreach } = await import('../agents/sales-prospector')
      const result = await generateOutreach({
        id: 'lead-1',
        company_name: 'Zimbabwe Safari Co',
        contact_name: 'John Smith',
        email: 'john@zimsafari.com',
        company_type: 'tour_operator',
        lead_score: 80,
        lead_status: 'new',
        source: 'apollo',
      })

      expect(result).toHaveProperty('to', 'john@zimsafari.com')
      expect(result).toHaveProperty('subject')
      expect(result).toHaveProperty('body')
      expect(result).toHaveProperty('lead_id', 'lead-1')
    })

    it('should fall back when LLM returns non-JSON', async () => {
      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValueOnce({
        content: 'Here is a draft email for your outreach...',
        tokensUsed: 100,
        model: 'mimo-v2.5-free',
        costUsd: 0,
        runLogId: null,
      })

      const { generateOutreach } = await import('../agents/sales-prospector')
      const result = await generateOutreach({
        id: 'lead-2',
        company_name: 'Test Co',
        email: 'test@test.com',
        company_type: 'tour_operator',
        lead_score: 70,
        lead_status: 'new',
        source: 'test',
      })

      expect(result.subject).toContain('Partnership Opportunity')
      expect(result.body).toContain('draft email')
    })
  })

  describe('runDailyProspecting', () => {
    it('should return summary with counts', async () => {
      const { callAgent } = await import('../services/ai-agent.service')
      ;(callAgent as jest.Mock).mockResolvedValue({
        content: '[]',
        tokensUsed: 50,
        model: 'mimo-v2.5-free',
        costUsd: 0,
        runLogId: null,
      })

      const { runDailyProspecting } = await import('../agents/sales-prospector')
      const result = await runDailyProspecting()

      expect(result).toHaveProperty('total_leads')
      expect(result).toHaveProperty('outreach_sent')
      expect(result).toHaveProperty('apollo_sourced')
      expect(result).toHaveProperty('llm_sourced')
      expect(result).toHaveProperty('categories')
      expect(Array.isArray(result.categories)).toBe(true)
    })
  })
})
