import { logger } from './ai-agent.service'

// ── SERPAPI — Google Search Results ────────────────────────────
// Real web search for lead research, market intel, competitor analysis

const SERPAPI_KEY = process.env.SERPAPI_KEY || ''
const SERPAPI_BASE = 'https://serpapi.com/search.json'

interface SearchResult {
  title: string
  link: string
  snippet: string
  position: number
}

interface SerpApiResponse {
  search_metadata: { status: string }
  organic_results: SearchResult[]
  knowledge_graph?: Record<string, any>
  answer_box?: { answer: string; title: string }
  related_questions?: Array<{ question: string; snippet: string; link: string }>
}

export function isSerpApiConfigured(): boolean {
  return !!SERPAPI_KEY
}

// ── GOOGLE SEARCH ──────────────────────────────────────────────
export async function googleSearch(
  query: string,
  options: { num?: number; country?: string; language?: string; device?: string } = {}
): Promise<SerpApiResponse> {
  if (!SERPAPI_KEY) {
    logger.warn('SerpApi not configured — skipping search')
    return { search_metadata: { status: 'not_configured' }, organic_results: [] }
  }

  const params = new URLSearchParams({
    q: query,
    api_key: SERPAPI_KEY,
    engine: 'google',
    num: String(options.num || 10),
    gl: options.country || 'us',
    hl: options.language || 'en'
  })

  if (options.device) params.set('device', options.device)

  try {
    const response = await fetch(`${SERPAPI_BASE}?${params}`, {
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) {
      throw new Error(`SerpApi error ${response.status}`)
    }

    const data = await response.json() as SerpApiResponse
    logger.info(`SerpApi search returned ${data.organic_results?.length || 0} results for: ${query.substring(0, 50)}`)
    return data
  } catch (error: any) {
    logger.error(`SerpApi search failed: ${error.message}`)
    return { search_metadata: { status: 'error' }, organic_results: [] }
  }
}

// ── SEARCH FOR LEADS ───────────────────────────────────────────
export async function searchForLeads(
  category: string,
  location: string = 'Zimbabwe'
): Promise<Array<{ company: string; website: string; snippet: string; source: string }>> {
  const queries: Record<string, string[]> = {
    tour_operator: [
      `safari tour operators ${location} contact email`,
      `wildlife tour companies ${location} partnership`
    ],
    travel_agency: [
      `travel agencies specializing African safari contact`,
      `luxury travel advisors ${location} partnership opportunities`
    ],
    corporate: [
      `corporate retreat safari venues ${location} booking`,
      `team building safari packages ${location} corporate`
    ],
    wedding_planner: [
      `safari wedding planners ${location} contact`,
      `honeymoon safari packages ${location} destination wedding`
    ],
    influencer: [
      `travel influencers Instagram safari content creator`,
      `safari travel blogger YouTube partnership`
    ]
  }

  const searchQueries = queries[category] || queries.tour_operator
  const results: Array<{ company: string; website: string; snippet: string; source: string }> = []

  for (const query of searchQueries) {
    const searchResult = await googleSearch(query, { num: 5 })
    for (const item of searchResult.organic_results || []) {
      results.push({
        company: item.title.split(' - ')[0].split(' | ')[0].trim(),
        website: item.link,
        snippet: item.snippet,
        source: 'serpapi'
      })
    }
  }

  logger.info(`SerpApi found ${results.length} lead candidates for ${category}`)
  return results
}

// ── COMPETITOR INTELLIGENCE ────────────────────────────────────
export async function searchCompetitorIntelligence(
  competitorName: string
): Promise<{ articles: SearchResult[]; news: SearchResult[]; social: SearchResult[] }> {
  const [articles, news, social] = await Promise.all([
    googleSearch(`${competitorName} safari tourism review`, { num: 5 }),
    googleSearch(`${competitorName} news 2026`, { num: 5 }),
    googleSearch(`${competitorName} social media Instagram Facebook`, { num: 5 })
  ])

  return {
    articles: articles.organic_results || [],
    news: news.organic_results || [],
    social: social.organic_results || []
  }
}

// ── MARKET RESEARCH ────────────────────────────────────────────
export async function searchMarketData(
  market: string,
  topic: string
): Promise<{ results: SearchResult[]; relatedQuestions: string[] }> {
  const searchResult = await googleSearch(
    `${topic} ${market} tourism statistics 2026`,
    { num: 10 }
  )

  return {
    results: searchResult.organic_results || [],
    relatedQuestions: (searchResult.related_questions || []).map(q => q.question)
  }
}

// ── PARK / DESTINATION RESEARCH ────────────────────────────────
export async function searchDestinationInfo(
  destination: string
): Promise<{ overview: string; highlights: string[]; practicalInfo: string }> {
  const result = await googleSearch(`${destination} Zimbabwe safari guide`, { num: 5 })

  const overview = result.organic_results?.[0]?.snippet || ''
  const highlights = result.organic_results?.slice(0, 3).map(r => r.snippet) || []
  const practicalInfo = result.answer_box?.answer || ''

  return { overview, highlights, practicalInfo }
}
