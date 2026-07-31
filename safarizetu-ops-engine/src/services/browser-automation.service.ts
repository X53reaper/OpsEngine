import { logger } from '../services/ai-agent.service'
import { isApifyConfigured, scrapeWebsite } from './apify.service'
import { isSerpApiConfigured, googleSearch, searchForLeads as serpApiSearchLeads } from './serpapi.service'

// ── BROWSER-USE SERVICE — Automated lead research ──────────────
// Uses Apify (real web scraping) + SerpApi (Google search) instead
// of simulated scraping. Falls back gracefully when not configured.

interface ScrapeResult {
  url: string
  title: string
  content: string
  metadata?: Record<string, any>
  scraped_at: Date
}

interface LeadResearchResult {
  company: string
  website: string
  description: string
  contact_email?: string
  partnership_potential: 'high' | 'medium' | 'low'
  category: 'airline' | 'lodge' | 'activity' | 'transport' | 'insurance' | 'other'
}

// ── SCRAPE SAFARI MARKETPLACE (Apify + SerpApi) ────────────────
export async function scrapeSafariSites(urls: string[]): Promise<ScrapeResult[]> {
  if (isApifyConfigured()) {
    // Real scraping via Apify
    const scraped = await scrapeWebsite(urls, { waitForSecs: 120 })
    return scraped.map(item => ({
      url: item.url,
      title: item.title,
      content: item.text || item.description,
      metadata: { source: 'apify', scraped_at: new Date().toISOString() },
      scraped_at: new Date()
    }))
  }

  if (isSerpApiConfigured()) {
    // Fallback: SerpApi search snippets (not full page scrape but useful)
    const results: ScrapeResult[] = []
    for (const url of urls) {
      const hostname = new URL(url).hostname.replace('www.', '')
      const searchResult = await googleSearch(`site:${hostname}`, { num: 3 })
      const snippets = searchResult.organic_results || []
      results.push({
        url,
        title: hostname,
        content: snippets.map(s => `${s.title}: ${s.snippet}`).join('\n') || `No data from SerpApi for ${hostname}`,
        metadata: { source: 'serpapi', scraped_at: new Date().toISOString() },
        scraped_at: new Date()
      })
    }
    return results
  }

  // Final fallback: return empty with status
  logger.warn('Neither Apify nor SerpApi configured — cannot scrape')
  return urls.map(url => ({
    url,
    title: new URL(url).hostname,
    content: '[No scraping service configured]',
    metadata: { status: 'not_configured' },
    scraped_at: new Date()
  }))
}

// ── RESEARCH POTENTIAL PARTNERS (SerpApi + Apify) ──────────────
export async function researchPartners(
  category: 'airline' | 'lodge' | 'activity' | 'transport' | 'insurance'
): Promise<LeadResearchResult[]> {
  const researchTargets: Record<string, string[]> = {
    airline: [
      'https://www.fastjet.com',
      'https://www.airzimbabwe.co.zw',
      'https://www.saairlink.co.za',
      'https://www.flykulula.com',
    ],
    lodge: [
      'https://www.wilderness-safaris.com',
      'https://www.andbeyond.com',
      'https://www.safaribookings.com',
    ],
    activity: [
      'https://www.rovosrail.com',
      'https://www.victoriafalls-guide.net',
    ],
    transport: [
      'https://www.hertzafrica.co.ke',
      'https://www.avis.co.za',
    ],
    insurance: [
      'https://www.safaristyle.com/travel-insurance',
    ]
  }

  const targets = researchTargets[category] || []

  // If Apify is configured, scrape the actual pages for richer data
  if (isApifyConfigured() && targets.length > 0) {
    const scraped = await scrapeWebsite(targets, { waitForSecs: 120 })
    return scraped.map(item => ({
      company: item.title || new URL(item.url).hostname.replace('www.', ''),
      website: item.url,
      description: item.description || item.text.substring(0, 300) || `Potential ${category} partner`,
      partnership_potential: 'medium' as const,
      category
    }))
  }

  // If SerpApi is configured, search for partner info
  if (isSerpApiConfigured()) {
    const results: LeadResearchResult[] = []
    const searchResult = await googleSearch(
      `${category} safari companies Zimbabwe partnership contact`,
      { num: 10 }
    )
    for (const item of searchResult.organic_results || []) {
      results.push({
        company: item.title.split(' - ')[0].split(' | ')[0].trim(),
        website: item.link,
        description: item.snippet,
        partnership_potential: 'medium',
        category
      })
    }
    return results
  }

  // Final fallback: return known targets
  return targets.map(url => {
    const hostname = new URL(url).hostname.replace('www.', '')
    return {
      company: hostname.split('.')[0].charAt(0).toUpperCase() + hostname.split('.')[0].slice(1),
      website: url,
      description: `Potential ${category} partner — requires web research`,
      partnership_potential: 'medium' as const,
      category
    }
  })
}

// ── MONITOR COMPETITOR PRICING (Apify scrape) ──────────────────
export async function monitorCompetitorPricing(
  competitorUrls: string[]
): Promise<Array<{ competitor: string; averagePrice: number; currency: string }>> {
  if (isApifyConfigured()) {
    const scraped = await scrapeWebsite(competitorUrls, { waitForSecs: 120 })
    return scraped.map(item => ({
      competitor: item.title || new URL(item.url).hostname,
      averagePrice: 0, // Would need page-specific price extraction
      currency: 'USD'
    }))
  }

  if (isSerpApiConfigured()) {
    const results: Array<{ competitor: string; averagePrice: number; currency: string }> = []
    for (const url of competitorUrls) {
      const hostname = new URL(url).hostname.replace('www.', '')
      const searchResult = await googleSearch(`${hostname} safari prices USD`, { num: 3 })
      results.push({
        competitor: hostname,
        averagePrice: 0, // Would need NLP to extract prices from snippets
        currency: 'USD'
      })
    }
    return results
  }

  return competitorUrls.map(url => ({
    competitor: new URL(url).hostname,
    averagePrice: 0,
    currency: 'USD'
  }))
}

// ── CHECK PARK AVAILABILITY (SerpApi search) ───────────────────
export async function checkParkAvailability(
  parkName: string,
  date: string
): Promise<{ available: boolean; capacity: number; restrictions?: string }> {
  if (isSerpApiConfigured()) {
    const searchResult = await googleSearch(
      `${parkName} park availability ${date} Zimbabwe`,
      { num: 5 }
    )
    const snippets = (searchResult.organic_results || []).map(r => r.snippet).join(' ').toLowerCase()
    const available = !snippets.includes('full') && !snippets.includes('closed') && !snippets.includes('unavailable')

    return {
      available,
      capacity: available ? 50 : 0,
      restrictions: available ? undefined : 'Check park website for current status'
    }
  }

  return {
    available: true,
    capacity: 50,
    restrictions: undefined
  }
}

// ── AUTOMATED LEAD GENERATION (SerpApi + Apify) ────────────────
export async function generateLeads(
  category: 'tour_operator' | 'travel_agency' | 'corporate' | 'wedding_planner'
): Promise<LeadResearchResult[]> {
  // Use SerpApi for real search-based lead discovery
  if (isSerpApiConfigured()) {
    const leads = await serpApiSearchLeads(category, 'Zimbabwe')
    return leads.map(lead => ({
      company: lead.company,
      website: lead.website,
      description: lead.snippet,
      partnership_potential: 'medium' as const,
      category: 'other' as const
    }))
  }

  // Final fallback: return search query targets
  const leadQueries: Record<string, string[]> = {
    tour_operator: ['safari tour operators Zimbabwe', 'wildlife tour companies Kenya'],
    travel_agency: ['travel agencies specializing safari Africa'],
    corporate: ['corporate retreat safari venues Africa'],
    wedding_planner: ['safari wedding venues Africa']
  }

  const queries = leadQueries[category] || []
  return queries.map(query => ({
    company: `Lead: ${query}`,
    website: '',
    description: `Search query: ${query}`,
    partnership_potential: 'medium' as const,
    category: 'other' as const
  }))
}
