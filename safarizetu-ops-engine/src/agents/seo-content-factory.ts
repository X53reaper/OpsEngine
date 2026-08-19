import { callAgent, logger, pool } from '../services/ai-agent.service'
import { upsertDocuments } from '../services/chroma.service'
import { startTrace, endTrace } from '../services/observability.service'

// ── SEO CONTENT FACTORY (Template 04) ────────────────────────
// Two-stage pipeline: Research → Write
// Produces SEO-optimized articles for Safari Zetu blog (Ghost CMS)
// Every article is fact-checked, human-reviewed before publish

// ── INTERFACES ─────────────────────────────────────────────────
export interface SEOArticle {
  title: string
  meta_title: string
  meta_description: string
  slug: string
  intro: string
  body_markdown: string
  conclusion: string
  faq: { question: string; answer: string }[]
  citations_to_verify: string[]
  ranking_criteria: string[]
  cms: 'Ghost'
  publish_mode: 'DRAFT_ONLY'
  approval_status: 'NEEDS_FACT_CHECK_AND_HUMAN_REVIEW'
}

// ── DEFAULT KEYWORDS ──────────────────────────────────────────
const DEFAULT_KEYWORDS = [
  'best safari experiences Zimbabwe',
  'Victoria Falls adventure guide',
  'Hwange National Park safari',
  'Gonarezhou wildlife safari',
  'Zimbabwe luxury safari lodges',
  'family safari Africa tips',
  'safari photography guide',
  'Zimbabwe travel safety 2025'
]

// ── RESEARCH REPORT INTERFACE ─────────────────────────────────
interface ResearchReport {
  search_intent: string
  reader_questions: string[]
  ranking_criteria: string[]
  source_summary: string
  recommended_outline: { heading: string; level: 'H2' | 'H3'; notes: string }[]
  fact_check_flags: string[]
}

// ── SLUG GENERATOR ────────────────────────────────────────────
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80)
}

// ── TRUNCATE META DESCRIPTION ─────────────────────────────────
function truncateMeta(text: string, max: number = 155): string {
  if (text.length <= max) return text
  return text.substring(0, max - 3).replace(/\s+\S*$/, '') + '...'
}

// ── CREATE RESEARCH REPORT ────────────────────────────────────
export async function createResearchReport(
  keyword: string,
  audience?: string,
  country?: string
): Promise<ResearchReport> {
  logger.info(`Creating research report for: "${keyword}"`)

  const audienceClause = audience ? `Audience: ${audience}.` : 'Audience: general safari travelers.'
  const countryClause = country ? `Focus country: ${country}.` : 'Focus country: Zimbabwe and Southern Africa.'

  const result = await callAgent({
    agentName: 'seo_research_analyst',
    division: 'growth',
    model: 'light',
    systemPrompt: `You are an SEO research analyst for Safari Zetu, a safari marketplace.
Create a research report for the keyword.

Rules:
- Analyze real search intent — what does the searcher actually want?
- Identify 5-8 specific questions real people ask about this topic
- List ranking criteria: what Google rewards for this type of query
- Summarize patterns from ranking content without copying
- Suggest an article outline with H2/H3 structure
- Flag anything that needs fact-checking (statistics, dates, claims)
- Never fabricate citations, statistics, or specific data points
- If unsure about a fact, mark it for human review

Return ONLY valid JSON matching this structure:
{
  "search_intent": "informational | transactional | navigational | mixed — with explanation",
  "reader_questions": ["question 1", "question 2", ...],
  "ranking_criteria": ["what Google rewards for this query type"],
  "source_summary": "patterns observed in top-ranking content",
  "recommended_outline": [
    { "heading": "H2 Title", "level": "H2", "notes": "what to cover" }
  ],
  "fact_check_flags": ["claims that need verification"]
}`,
    userMessage: `Keyword: "${keyword}"
${audienceClause}
${countryClause}

Create a thorough research report. Think about what a traveler actually searching this keyword wants to know.`,
    triggerType: 'on_demand',
    triggerPayload: { keyword, audience, country },
    maxTokens: 2500
  })

  try {
    const report = JSON.parse(result.content) as ResearchReport
    if (!report.search_intent || !report.reader_questions?.length) {
      throw new Error('Incomplete research report')
    }
    logger.info(`Research report complete: ${report.reader_questions.length} questions, ${report.ranking_criteria.length} criteria`)
    return report
  } catch {
    logger.warn(`Research parse failed for "${keyword}" — using structured fallback`)
    return {
      search_intent: `informational — user wants to learn about ${keyword}`,
      reader_questions: [
        `What is ${keyword}?`,
        `How do I plan a ${keyword} trip?`,
        `What is the best time for ${keyword}?`,
        `How much does ${keyword} cost?`,
        `What should I pack for ${keyword}?`,
        `Is ${keyword} safe?`,
        `What wildlife can I see?`,
        `Do I need a guide for ${keyword}?`
      ],
      ranking_criteria: [
        'Comprehensive overview with practical details',
        'First-hand experience or expert authority',
        'Up-to-date pricing and logistics',
        'Visual content and real photos',
        'Specific actionable tips'
      ],
      source_summary: 'Top results provide detailed guides with pricing, itineraries, and practical tips. Most include personal experience narratives.',
      recommended_outline: [
        { heading: `What is ${keyword}?`, level: 'H2', notes: 'Define and set context' },
        { heading: 'Why This Experience Matters', level: 'H2', notes: 'Emotional hook and unique value' },
        { heading: 'Planning Your Trip', level: 'H2', notes: 'Logistics, timing, booking' },
        { heading: 'Costs and Budgeting', level: 'H2', notes: 'Price ranges, value tips' },
        { heading: 'What to Expect', level: 'H2', notes: 'Day-by-day or detailed experience' },
        { heading: 'Tips and Advice', level: 'H2', notes: 'Practical recommendations' },
        { heading: 'Frequently Asked Questions', level: 'H2', notes: 'FAQ schema-ready' }
      ],
      fact_check_flags: ['Pricing should be verified', 'Season dates need confirmation']
    }
  }
}

// ── WRITE SEO ARTICLE ─────────────────────────────────────────
export async function writeSEOArticle(
  keyword: string,
  research: ResearchReport,
  brand?: string
): Promise<SEOArticle> {
  const brandName = brand || 'Safari Zetu'
  const audience = 'safari travelers researching Zimbabwe and Southern Africa'
  const country = 'Zimbabwe'

  logger.info(`Writing SEO article for: "${keyword}"`)

  const outlineText = research.recommended_outline
    .map(o => `${o.level}: ${o.heading} — ${o.notes}`)
    .join('\n')

  const questionsText = research.reader_questions.join('\n- ')
  const criteriaText = research.ranking_criteria.join('\n- ')

  const result = await callAgent({
    agentName: 'seo_editor',
    division: 'growth',
    model: 'heavy',
    systemPrompt: `You are a research-backed SEO editor for Safari Zetu.
Write an original, helpful article from this research report.

Brand: ${brandName}
Audience: ${audience}
Country: ${country}

Guidelines:
- Write 1500-2500 words of substantive, original content
- Use proper heading hierarchy: one H1 (title), multiple H2s, nested H3s where needed
- The intro must hook the reader with a specific, relatable scenario — no generic openers
- Every section must deliver actionable value, not filler
- FAQs must answer genuinely useful search queries from the research
- Meta title must be under 60 characters and include the primary keyword
- Meta description must be under 155 characters, compelling, and keyword-rich
- Slug must be URL-friendly (lowercase, hyphens, no special characters)
- Do not invent facts, statistics, or data points you cannot verify
- Label any unsupported claim with [REVIEW: claim needs verification]
- Never use these AI slop patterns: "In the realm of", "It's worth noting that", "Delve into", "Embark on", "A tapestry of", "In today's digital age"
- Write like a knowledgeable friend who has been on safari, not a marketing brochure
- Include specific details: park names, distances, realistic costs in USD
- Conclude with a clear, non-pushy next step

Return ONLY valid JSON matching this structure:
{
  "title": "Article title (H1)",
  "meta_title": "SEO title (max 60 chars)",
  "meta_description": "Meta description (max 155 chars)",
  "slug": "url-friendly-slug",
  "intro": "Hook paragraph — 2-3 sentences that draw the reader in",
  "body_markdown": "Full article body in Markdown with H2/H3 headings, 1500-2500 words",
  "conclusion": "Strong closing paragraph with soft CTA",
  "faq": [
    { "question": "Question?", "answer": "Concise answer." }
  ],
  "citations_to_verify": ["claims that need fact-checking"],
  "ranking_criteria": ["SEO signals this article targets"]
}`,
    userMessage: `Write an SEO article about: "${keyword}"

Research Report:
Intent: ${research.search_intent}

Outline:
${outlineText}

Reader Questions:
- ${questionsText}

Ranking Criteria:
- ${criteriaText}

Source Patterns: ${research.source_summary}

Fact-check flags: ${research.fact_check_flags.join(', ')}

Write the article now. Make it genuinely helpful for someone planning a safari.`,
    triggerType: 'on_demand',
    triggerPayload: { keyword, brand: brandName, audience, country },
    maxTokens: 4000
  })

  try {
    const article = JSON.parse(result.content)
    if (!article.title || !article.body_markdown) {
      throw new Error('Incomplete article — missing title or body')
    }

    const seoArticle: SEOArticle = {
      title: article.title,
      meta_title: truncateMeta(article.meta_title || article.title, 60),
      meta_description: truncateMeta(article.meta_description || article.title, 155),
      slug: article.slug || generateSlug(article.title),
      intro: article.intro || '',
      body_markdown: article.body_markdown || '',
      conclusion: article.conclusion || '',
      faq: Array.isArray(article.faq) ? article.faq : [],
      citations_to_verify: Array.isArray(article.citations_to_verify)
        ? article.citations_to_verify
        : [],
      ranking_criteria: Array.isArray(article.ranking_criteria)
        ? article.ranking_criteria
        : research.ranking_criteria,
      cms: 'Ghost',
      publish_mode: 'DRAFT_ONLY',
      approval_status: 'NEEDS_FACT_CHECK_AND_HUMAN_REVIEW'
    }

    const wordCount = seoArticle.body_markdown.split(/\s+/).length
    logger.info(`Article written: "${seoArticle.title}" (${wordCount} words, ${seoArticle.faq.length} FAQs)`)
    return seoArticle

  } catch {
    logger.error(`Article parse failed for "${keyword}" — returning minimal draft`)
    return {
      title: `${keyword} — Complete Guide | Safari Zetu`,
      meta_title: truncateMeta(`${keyword} Guide | Safari Zetu`, 60),
      meta_description: truncateMeta(`Plan your ${keyword} with expert tips, costs, and itineraries from Safari Zetu.`, 155),
      slug: generateSlug(keyword),
      intro: `Planning a ${keyword}? This guide covers everything you need to know — from timing and costs to what to expect on the ground.`,
      body_markdown: `# ${keyword}\n\n[ARTICLE NEEDS FULL GENERATION — agent parse failed]\n\nPlease regenerate this article by running the content factory again.`,
      conclusion: `Ready to plan your ${keyword}? Safari Zetu connects you with trusted operators and curated experiences across Zimbabwe.`,
      faq: [
        { question: `When is the best time for ${keyword}?`, answer: 'Contact Safari Zetu for current seasonal advice.' },
        { question: `How much does ${keyword} cost?`, answer: 'Pricing varies by group size and season. Request a quote from our operators.' }
      ],
      citations_to_verify: ['Full article needs regeneration'],
      ranking_criteria: research.ranking_criteria,
      cms: 'Ghost',
      publish_mode: 'DRAFT_ONLY',
      approval_status: 'NEEDS_FACT_CHECK_AND_HUMAN_REVIEW'
    }
  }
}

// ── RUN SEO CONTENT FACTORY ───────────────────────────────────
export async function runSEOContentFactory(
  keyword: string,
  options?: {
    brand?: string
    audience?: string
    country?: string
  }
): Promise<SEOArticle> {
  const traceId = startTrace('seo_content_factory', 'mimo-v2.5-free', {
    keyword,
    brand: options?.brand,
    audience: options?.audience,
    country: options?.country
  })

  const startTime = Date.now()

  try {
    // Stage 1: Research
    const research = await createResearchReport(
      keyword,
      options?.audience,
      options?.country
    )

    // Stage 2: Write
    const article = await writeSEOArticle(keyword, research, options?.brand)

    // Store in database
    const duration = Date.now() - startTime
    try {
      const wordCount = article.body_markdown.split(/\s+/).length
      await pool.query(
        `INSERT INTO content_performance
         (content_type, platform, title, slug, keywords, word_count, meta_title, meta_description, status, approval_status, agent_name, model_used, tokens_used, cost_usd, generation_time_ms, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())`,
        [
          'blog_article',
          'seo_blog',
          article.title,
          article.slug,
          [keyword],
          wordCount,
          article.meta_title,
          article.meta_description,
          'draft',
          article.approval_status,
          'seo_content_factory',
          'mimo-v2.5-free',
          0,
          0,
          duration
        ]
      )
    } catch (e: any) {
      logger.warn(`DB write failed (mock mode?): ${e.message}`)
    }

    // Store in Chroma for future reference
    try {
      await upsertDocuments('seo-articles', [{
        id: `seo-${article.slug}`,
        text: `${article.title}\n\n${article.intro}\n\n${article.body_markdown.substring(0, 2000)}`,
        metadata: {
          keyword,
          slug: article.slug,
          word_count: article.body_markdown.split(/\s+/).length,
          faq_count: article.faq.length,
          approval_status: article.approval_status,
          created_at: new Date().toISOString()
        }
      }])
    } catch (e: any) {
      logger.warn(`Chroma write failed: ${e.message}`)
    }

    endTrace(traceId, {
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      latency_ms: duration,
      status: 'success'
    })

    logger.info(`SEO Content Factory complete: "${article.title}" (${duration}ms)`)
    return article

  } catch (error: any) {
    const duration = Date.now() - startTime
    endTrace(traceId, {
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      latency_ms: duration,
      status: 'error',
      error: error.message
    })
    logger.error(`SEO Content Factory failed for "${keyword}": ${error.message}`)
    throw error
  }
}

// ── BATCH CONTENT GENERATION ──────────────────────────────────
export async function generateBatchContent(
  keywords?: string[],
  options?: { brand?: string; audience?: string; country?: string }
): Promise<{ generated: number; keywords: string[]; articles: SEOArticle[] }> {
  const traceId = startTrace('seo_content_batch', 'mimo-v2.5-free')

  const targetKeywords = keywords || DEFAULT_KEYWORDS
  const articles: SEOArticle[] = []
  const failed: string[] = []

  for (const keyword of targetKeywords) {
    try {
      const article = await runSEOContentFactory(keyword.trim(), options)
      articles.push(article)
      logger.info(`Batch: [${articles.length}/${targetKeywords.length}] "${keyword}" done`)
    } catch (e: any) {
      failed.push(keyword)
      logger.error(`Batch: "${keyword}" failed: ${e.message}`)
    }
  }

  endTrace(traceId, {
    input_tokens: 0,
    output_tokens: 0,
    cost_usd: 0,
    latency_ms: 0,
    status: failed.length === targetKeywords.length ? 'error' : 'success'
  })

  logger.info(`Batch complete: ${articles.length}/${targetKeywords.length} articles generated (${failed.length} failed)`)

  return {
    generated: articles.length,
    keywords: targetKeywords,
    articles
  }
}

// ── GET DEFAULT KEYWORDS ──────────────────────────────────────
export function getDefaultKeywords(): string[] {
  return [...DEFAULT_KEYWORDS]
}
