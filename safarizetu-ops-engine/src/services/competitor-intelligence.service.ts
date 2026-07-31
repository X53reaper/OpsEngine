import { logger, pool } from './ai-agent.service'
import { callAgent } from './ai-agent.service'
import { scrapeSafariSites } from './browser-automation.service'
import { searchCompetitorIntelligence } from './serpapi.service'

// ── COMPETITOR INTELLIGENCE AGENT ──────────────────────────────
// Continuously researches what competitors are doing,
// what psychological tactics they use, and what works.
// Then recommends how Safari Zetu can do it BETTER —
// not copy, but outmaneuver.

interface Competitor {
  name: string
  handle: string
  platform: string
  url: string
  category: string          // "luxury_lodge", "tour_operator", "adventure_company", "safari_marketing"
}

interface CompetitorContent {
  competitor: string
  platform: string
  post_type: string         // "photo", "reel", "story", "ad", "email"
  headline: string
  body: string
  cta: string
  psychological_tactic: string
  engagement_estimate: string
  captured_at: Date
}

interface TacticAnalysis {
  tactic: string
  description: string
  competitors_using: string[]
  psychological_principle: string
  effectiveness: string     // "high", "medium", "low"
  safari_zetu_angle: string // How we do it better
}

// ── KNOWN COMPETITORS ──────────────────────────────────────────
const COMPETITOR_DB: Competitor[] = [
  { name: 'Wilderness Safaris', handle: '@wildernesssafaris', platform: 'instagram', url: 'https://instagram.com/wildernesssafaris', category: 'luxury_lodge' },
  { name: 'andBeyond', handle: '@andbeyondtravel', platform: 'instagram', url: 'https://instagram.com/andbeyondtravel', category: 'luxury_lodge' },
  { name: 'Natural Selection', handle: '@naturalselection_', platform: 'instagram', url: 'https://instagram.com/naturalselection_', category: 'luxury_lodge' },
  { name: 'Asilia Africa', handle: '@asiliaafrica', platform: 'instagram', url: 'https://instagram.com/asiliaafrica', category: 'tour_operator' },
  { name: 'Rovos Rail', handle: '@rovosrail', platform: 'instagram', url: 'https://instagram.com/rovosrail', category: 'luxury_lodge' },
  { name: 'Duma Africa', handle: 'dumaafrica', platform: 'instagram', url: 'https://instagram.com/dumaafrica', category: 'adventure_company' },
  { name: 'Tourism Zimbabwe', handle: '@touriszim', platform: 'instagram', url: 'https://instagram.com/touriszim', category: 'tour_operator' },
  { name: 'Victoria Falls Safari Lodge', handle: '@victoriafallssafari', platform: 'instagram', url: 'https://instagram.com/victoriafallssafari', category: 'luxury_lodge' },
  { name: 'Ilala Lodge', handle: '@ilalalodge', platform: 'instagram', url: 'https://instagram.com/ilalalodge', category: 'luxury_lodge' },
  { name: 'Bulawayo Kraal', handle: '@bulawayokraal', platform: 'instagram', url: 'https://instagram.com/bulawayokraal', category: 'luxury_lodge' },
]

// ── SCRAPE COMPETITOR CONTENT ──────────────────────────────────
// Uses SerpApi + Apify to find what competitors are posting
export async function scrapeCompetitorContent(competitorHandle: string): Promise<CompetitorContent[]> {
  const competitor = COMPETITOR_DB.find(c => c.handle === competitorHandle || c.name === competitorHandle)
  if (!competitor) {
    logger.warn(`Unknown competitor: ${competitorHandle}`)
    return []
  }

  try {
    // Search for recent posts from this competitor using SerpApi
    const searchResults = await searchCompetitorIntelligence(competitor.name)
    
    // Combine articles, news, and social results
    const allResults = [
      ...(searchResults.articles || []),
      ...(searchResults.news || []),
      ...(searchResults.social || [])
    ]
    
    if (allResults.length === 0) return []

    const contents: CompetitorContent[] = []

    // Analyze top search results for content patterns
    for (const result of allResults.slice(0, 8)) {
      try {
        // Scrape the URL for deeper content via Apify
        let scrapedContent = ''
        if (result.link) {
          const scraped = await scrapeSafariSites([result.link])
          scrapedContent = scraped[0]?.content || ''
        }
        
        const analysis = await analyzeCompetitorContent(
          competitor.name,
          result.title || '',
          result.snippet || '',
          scrapedContent.substring(0, 2000) || result.snippet || ''
        )

        contents.push({
          competitor: competitor.name,
          platform: competitor.platform,
          post_type: result.title?.toLowerCase().includes('reel') ? 'reel' : 
                     result.title?.toLowerCase().includes('story') ? 'story' : 
                     result.title?.toLowerCase().includes('ad') ? 'ad' : 'photo',
          headline: result.title || '',
          body: result.snippet || '',
          cta: extractCTA(scrapedContent),
          psychological_tactic: analysis.tactic,
          engagement_estimate: analysis.effectiveness,
          captured_at: new Date()
        })
      } catch (e: any) {
        logger.warn(`Failed to scrape competitor content: ${e.message}`)
      }
    }

    // Save to database
    await saveCompetitorContent(contents)
    logger.info(`Scraped ${contents.length} pieces from ${competitor.name}`)
    return contents
  } catch (e: any) {
    logger.error(`Competitor scraping failed for ${competitorHandle}: ${e.message}`)
    return []
  }
}

// ── ANALYZE COMPETITOR CONTENT PSYCHOLOGY ──────────────────────
async function analyzeCompetitorContent(
  competitorName: string,
  headline: string,
  description: string,
  fullContent: string
): Promise<{ tactic: string; effectiveness: string; counterStrategy: string }> {
  const prompt = `Analyze this competitor's travel content for psychological tactics:

Competitor: ${competitorName}
Headline: ${headline}
Description: ${description}
Content: ${fullContent.substring(0, 1000)}

Identify:
1. What psychological tactic are they using? (scarcity, social proof, FOMO, aspiration, storytelling, etc.)
2. How effective is it? (high/medium/low)
3. What is the underlying psychological principle?
4. How could Safari Zetu counter or do it better?

Return as JSON: { "tactic": "...", "effectiveness": "...", "principle": "...", "counterStrategy": "..." }`

  try {
    const result = await callAgent({
      agentName: 'competitor_analyst',
      division: 'growth',
      model: 'heavy',
      systemPrompt: 'You are a competitive intelligence analyst specializing in travel marketing psychology. You identify what competitors do, why it works psychologically, and how to do it better without copying.',
      userMessage: prompt,
      triggerType: 'competitor_analysis',
      triggerPayload: { competitor: competitorName },
      maxTokens: 500
    })

    const text = result.content
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        tactic: parsed.tactic || 'unknown',
        effectiveness: parsed.effectiveness || 'medium',
        counterStrategy: parsed.counterStrategy || ''
      }
    }

    return { tactic: 'storytelling', effectiveness: 'medium', counterStrategy: 'Use memory-based content instead' }
  } catch {
    return { tactic: 'unknown', effectiveness: 'medium', counterStrategy: '' }
  }
}

// ── FULL COMPETITOR SCAN ───────────────────────────────────────
// Scans ALL known competitors and builds a tactic database
export async function fullCompetitorScan(): Promise<{
  competitors_scanned: number
  tactics_found: TacticAnalysis[]
  recommendations: string[]
}> {
  logger.info('Starting full competitor scan...')

  const allContents: CompetitorContent[] = []
  const scannedNames: string[] = []

  // Scan a subset to avoid rate limits (5 per run)
  const toScan = COMPETITOR_DB.sort(() => Math.random() - 0.5).slice(0, 5)

  for (const competitor of toScan) {
    const contents = await scrapeCompetitorContent(competitor.handle)
    allContents.push(...contents)
    scannedNames.push(competitor.name)
    
    // Small delay between competitors
    await new Promise(r => setTimeout(r, 2000))
  }

  // Analyze all tactics found
  const tactics = await aggregateTactics(allContents)
  
  // Generate recommendations
  const recommendations = await generateCounterStrategies(tactics)

  logger.info(`Competitor scan complete: ${scannedNames.length} scanned, ${tactics.length} tactics found`)

  return {
    competitors_scanned: scannedNames.length,
    tactics_found: tactics,
    recommendations
  }
}

// ── AGGREGATE TACTICS ──────────────────────────────────────────
async function aggregateTactics(contents: CompetitorContent[]): Promise<TacticAnalysis[]> {
  const tacticCounts: Record<string, { count: number; competitors: Set<string> }> = {}

  for (const content of contents) {
    const tactic = content.psychological_tactic || 'unknown'
    if (!tacticCounts[tactic]) {
      tacticCounts[tactic] = { count: 0, competitors: new Set() }
    }
    tacticCounts[tactic].count++
    tacticCounts[tactic].competitors.add(content.competitor)
  }

  const tactics: TacticAnalysis[] = Object.entries(tacticCounts).map(([tactic, data]) => ({
    tactic,
    description: getTacticDescription(tactic),
    competitors_using: [...data.competitors],
    psychological_principle: getTacticPrinciple(tactic),
    effectiveness: data.count > 3 ? 'high' : data.count > 1 ? 'medium' : 'low',
    safari_zetu_angle: getSafariZetuAngle(tactic)
  }))

  return tactics.sort((a, b) => b.competitors_using.length - a.competitors_using.length)
}

// ── GENERATE COUNTER STRATEGIES ────────────────────────────────
async function generateCounterStrategies(tactics: TacticAnalysis[]): Promise<string[]> {
  if (tactics.length === 0) return ['No competitor data yet. Keep posting to build baseline.']

  const prompt = `Based on these competitor psychological tactics, recommend how Safari Zetu can differentiate:

${tactics.map(t => `- ${t.tactic}: Used by ${t.competitors_using.join(', ')}. Principle: ${t.psychological_principle}. We counter with: ${t.safari_zetu_angle}`).join('\n')}

Safari Zetu's advantage: We are a marketplace (many options), not a single lodge. We can offer variety, personalization, and memory-based content that individual lodges cannot.

Give 5 specific, actionable recommendations for content differentiation.`

  try {
    const result = await callAgent({
      agentName: 'strategy_researcher',
      division: 'growth',
      model: 'heavy',
      systemPrompt: 'You are Safari Zetu\'s competitive strategy advisor. You recommend how to outmaneuver competitors psychologically without copying them.',
      userMessage: prompt,
      triggerType: 'counter_strategy',
      triggerPayload: { tactics: tactics.length },
      maxTokens: 800
    })

    return result.content.split('\n').filter((l: string) => l.trim().length > 10).slice(0, 5)
  } catch {
    return tactics.map(t => `Counter "${t.tactic}" with ${t.safari_zetu_angle}`)
  }
}

// ── GET PSYCHOLOGICAL LANDSCAPE ────────────────────────────────
// What's the current competitive landscape?
export async function getCompetitiveLandscape(): Promise<{
  total_competitors: number
  known_tactics: string[]
  our_advantage: string
  gaps_we_can_fill: string[]
}> {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT psychological_tactic, COUNT(*) as count 
       FROM competitor_content 
       GROUP BY psychological_tactic 
       ORDER BY count DESC`
    )

    const tactics = rows.map((r: any) => r.psychological_tactic)

    return {
      total_competitors: COMPETITOR_DB.length,
      known_tactics: tactics,
      our_advantage: 'Marketplace model: personalized multi-lodge options, memory-based content, continuous learning from engagement',
      gaps_we_can_fill: [
        'Personalized content (competitors post generic)',
        'Memory-first storytelling (competitors sell features)',
        'Psychology-driven adaptation (competitors use same tone always)',
        'Cross-lodge comparison (single lodges cannot offer this)',
        'Learning from what actually books (competitors track vanity metrics)'
      ]
    }
  } catch {
    return {
      total_competitors: COMPETITOR_DB.length,
      known_tactics: [],
      our_advantage: 'Marketplace model with memory-based content',
      gaps_we_can_fill: ['Personalization', 'Adaptive psychology', 'Multi-lodge options']
    }
  }
}

// ── HELPERS ────────────────────────────────────────────────────
function extractCTA(content: string): string {
  const ctaPatterns = [
    /book\s+(?:now|your|a)/i,
    /contact\s+us/i,
    /visit\s+(?:our|the)/i,
    /learn\s+more/i,
    /enquire/i,
    /plan\s+(?:your|a)/i,
    /start\s+(?:your|planning)/i,
  ]
  for (const pattern of ctaPatterns) {
    const match = content.match(pattern)
    if (match) return match[0]
  }
  return 'implicit'
}

function getTacticDescription(tactic: string): string {
  const descriptions: Record<string, string> = {
    scarcity: 'Creating urgency through limited availability',
    social_proof: 'Showing others have booked/enjoyed',
    FOMO: 'Fear of missing out on an experience',
    aspiration: 'Appealing to who the customer wants to become',
    storytelling: 'Narrative-driven content that transports',
    authority: 'Positioning as expert/industry leader',
    reciprocity: 'Giving value before asking for booking',
    anchoring: 'Using price comparisons to frame value',
    emotional: 'Appealing to feelings over logic',
    urgency: 'Time-limited offers or seasons',
    exclusivity: 'Making the experience feel special/limited',
    identity: 'Appealing to self-image and values'
  }
  return descriptions[tactic] || 'Unknown tactic'
}

function getTacticPrinciple(tactic: string): string {
  const principles: Record<string, string> = {
    scarcity: 'Loss aversion (Kahneman & Tversky)',
    social_proof: 'Bandwagon effect (Cialdini)',
    FOMO: 'Loss aversion + social proof',
    aspiration: 'Self-actualization (Maslow)',
    storytelling: 'Narrative transportation (Green & Brock)',
    authority: 'Authority principle (Cialdini)',
    reciprocity: 'Reciprocity norm (Cialdini)',
    anchoring: 'Anchoring bias (Tversky & Kahneman)',
    emotional: 'Amygdala memory encoding (McGaugh)',
    urgency: 'Scarcity heuristic (Cialdini)',
    exclusivity: 'In-group bias (Tajfel)',
    identity: 'Self-concept theory (Rogers)'
  }
  return principles[tactic] || 'Unknown principle'
}

function getSafariZetuAngle(tactic: string): string {
  const angles: Record<string, string> = {
    scarcity: 'Use natural scarcity (seasons, migration patterns) not artificial urgency',
    social_proof: 'Share real traveler stories, not fake testimonials',
    FOMO: 'Show what they\'ll remember, not what they\'ll miss',
    aspiration: 'Focus on who they BECOME, not what they BUY',
    storytelling: 'Memory-first stories that transport, not sell',
    authority: 'Let the destinations speak, not the brand',
    reciprocity: 'Give them the psychology of why they want this trip',
    anchoring: 'Compare experiences, not prices',
    emotional: 'Deep sensory language that replays in their mind',
    urgency: 'Seasonal rhythms, not countdown timers',
    exclusivity: 'Every trip is unique because every person is unique',
    identity: 'This is who you are, not what you own'
  }
  return angles[tactic] || 'Differentiate through memory-based content'
}

async function saveCompetitorContent(contents: CompetitorContent[]): Promise<void> {
  try {
    for (const content of contents) {
      await pool.query(
        `INSERT INTO competitor_content (competitor, platform, post_type, headline, body, cta, psychological_tactic, engagement_estimate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [content.competitor, content.platform, content.post_type, content.headline, content.body, content.cta, content.psychological_tactic, content.engagement_estimate]
      )
    }
  } catch (e: any) {
    logger.error(`Failed to save competitor content: ${e.message}`)
  }
}

export function getCompetitorDB(): Competitor[] {
  return COMPETITOR_DB
}
