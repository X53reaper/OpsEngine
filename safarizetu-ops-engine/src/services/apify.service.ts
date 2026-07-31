import { logger } from './ai-agent.service'

// ── APIFY — Web Scraping at Scale ──────────────────────────────
// Scrape safari sites, competitor pricing, park availability,
// extract structured data from any website

const APIFY_TOKEN = process.env.APIFY_TOKEN || ''
const APIFY_USER_ID = process.env.APIFY_USER_ID || ''
const APIFY_BASE = 'https://api.apify.com/v2'

export function isApifyConfigured(): boolean {
  return !!APIFY_TOKEN
}

interface ApifyRunResult {
  id: string
  status: string
  defaultDatasetId: string
}

interface ScrapeResult {
  url: string
  title: string
  description: string
  text: string
  html: string
  metadata: Record<string, any>
}

// ── RUN AN ACTOR (通用 scrape runner) ──────────────────────────
async function runActor(
  actorId: string,
  input: Record<string, any>,
  timeoutSecs: number = 60
): Promise<ApifyRunResult> {
  const runUrl = `${APIFY_BASE}/acts/${actorId}/runs?token=${APIFY_TOKEN}`

  const response = await fetch(runUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(timeoutSecs * 1000)
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Apify run failed ${response.status}: ${err}`)
  }

  const data = await response.json() as any
  return data.data as ApifyRunResult
}

// ── WAIT FOR RUN COMPLETION ────────────────────────────────────
async function waitForRun(runId: string, maxWaitSecs: number = 120): Promise<any> {
  const start = Date.now()
  const timeout = maxWaitSecs * 1000

  while (Date.now() - start < timeout) {
    const statusUrl = `${APIFY_BASE}/actor-runs/${runId}?token=${APIFY_TOKEN}`
    const response = await fetch(statusUrl, { signal: AbortSignal.timeout(10000) })
    const data = await response.json() as any
    const status = data.data?.status

    if (status === 'SUCCEEDED' || status === 'FAILED' || status === 'ABORTED') {
      return data.data
    }

    await new Promise(r => setTimeout(r, 3000))
  }

  throw new Error(`Apify run ${runId} timed out after ${maxWaitSecs}s`)
}

// ── GET DATASET ITEMS ──────────────────────────────────────────
async function getDatasetItems(datasetId: string, limit: number = 50): Promise<any[]> {
  const url = `${APIFY_BASE}/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=${limit}`
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) return []
  const data = await response.json() as any
  return Array.isArray(data) ? data : []
}

// ── SCRAPE WEBSITE ─────────────────────────────────────────────
export async function scrapeWebsite(
  urls: string[],
  options: { waitForSecs?: number; extractText?: boolean } = {}
): Promise<ScrapeResult[]> {
  if (!isApifyConfigured()) {
    logger.warn('Apify not configured — skipping scrape')
    return urls.map(url => ({
      url,
      title: '',
      description: '',
      text: '[Apify not configured]',
      html: '',
      metadata: { status: 'not_configured' }
    }))
  }

  try {
    const run = await runActor('apify/web-scraper', {
      startUrls: urls.map(url => ({ url })),
      maxPagesPerCrawl: urls.length,
      pageFunction: `async function pageFunction(context) {
        const { request, log } = context;
        const title = await context.page.title() || '';
        const description = await context.page.$eval('meta[name="description"]', el => el.getAttribute('content') || '').catch(() => '');
        const text = await context.page.evaluate(() => document.body?.innerText || '').catch(() => '');
        const html = await context.page.content().catch(() => '');
        return { url: request.url, title, description, text: text.substring(0, 10000), html: html.substring(0, 50000) };
      }`
    }, options.waitForSecs || 120)

    const completed = await waitForRun(run.id, options.waitForSecs || 120)
    if (completed.status !== 'SUCCEEDED') {
      throw new Error(`Apify run ended with status: ${completed.status}`)
    }

    const items = await getDatasetItems(completed.defaultDatasetId, urls.length)
    logger.info(`Apify scraped ${items.length} pages`)
    return items.map(item => ({
      url: item.url || '',
      title: item.title || '',
      description: item.description || '',
      text: item.text || '',
      html: item.html || '',
      metadata: { scraped_at: new Date().toISOString() }
    }))
  } catch (error: any) {
    logger.error(`Apify scrape failed: ${error.message}`)
    return urls.map(url => ({
      url,
      title: '',
      description: '',
      text: '',
      html: '',
      metadata: { error: error.message }
    }))
  }
}

// ── SCRAPE SAFARI OPERATORS ────────────────────────────────────
export async function scrapeSafariOperators(
  region: string = 'Zimbabwe'
): Promise<Array<{ name: string; website: string; description: string; contact: string }>> {
  if (!isApifyConfigured()) return []

  try {
    const run = await runActor('apify/web-scraper', {
      startUrls: [{
        url: `https://www.google.com/search?q=safari+operators+${region.toLowerCase()}+contact+email`
      }],
      maxPagesPerCrawl: 3,
      pageFunction: `async function pageFunction(context) {
        const links = await context.page.$$eval('a[href]', anchors => 
          anchors.map(a => ({ text: a.textContent?.trim(), href: a.href }))
        );
        return links.filter(l => l.href && !l.href.includes('google'));
      }`
    }, 60)

    const completed = await waitForRun(run.id, 60)
    if (completed.status !== 'SUCCEEDED') return []

    const items = await getDatasetItems(completed.defaultDatasetId, 30)
    return items.map(item => ({
      name: item.text || '',
      website: item.href || '',
      description: `Found via Apify scrape for ${region}`,
      contact: ''
    }))
  } catch (error: any) {
    logger.error(`Apify safari operator scrape failed: ${error.message}`)
    return []
  }
}

// ── MONITOR COMPETITOR PRICING ─────────────────────────────────
export async function scrapeCompetitorPricing(
  competitorUrls: string[]
): Promise<Array<{ competitor: string; averagePrice: number; currency: string; details: string }>> {
  if (!isApifyConfigured()) {
    return competitorUrls.map(url => ({
      competitor: new URL(url).hostname,
      averagePrice: 0,
      currency: 'USD',
      details: 'Apify not configured'
    }))
  }

  const results = await scrapeWebsite(competitorUrls, { waitForSecs: 120 })
  return results.map(result => ({
    competitor: result.title || new URL(result.url).hostname,
    averagePrice: 0, // Needs page-specific parsing
    currency: 'USD',
    details: result.text.substring(0, 500)
  }))
}
