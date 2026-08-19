import { callAgent, logger, pool } from '../services/ai-agent.service'
import { queryCollection, upsertDocuments } from '../services/chroma.service'
import { startTrace, endTrace } from '../services/observability.service'

// ── SEO RESEARCH-TO-DOCS PIPELINE ─────────────────────────────
// Skills: GPT-Researcher (research), Storm (article generation)
// 5-stage pipeline: research → brief → write → humanize → review
// Based on n8n Template 06 — Advanced SEO Research-to-Docs

export interface SEOResearchResult {
  keyword: string
  brief: {
    intent: string
    audience_questions: string[]
    outline: string[]
    ranking_criteria: string[]
    claims_to_verify: string[]
    source_notes: string[]
  }
  article: {
    title: string
    meta_title: string
    meta_description: string
    slug: string
    article_markdown: string
    faq: { question: string; answer: string }[]
    citations_to_verify: string[]
  }
  humanized: boolean
  publish_mode: 'DRAFT_ONLY'
  approval_status: 'NEEDS_HUMAN_REVIEW'
}

interface ResearchData {
  search_intent: string
  reader_questions: string[]
  ranking_criteria: string[]
  source_summary: string
  recommended_outline: string[]
  fact_check_flags: string[]
}

interface ArticleDraft {
  title: string
  meta_title: string
  meta_description: string
  slug: string
  article_markdown: string
  faq: { question: string; answer: string }[]
  citations_to_verify: string[]
}

// ── RETRY HELPER ──────────────────────────────────────────────
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 2,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | undefined
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      lastError = err
      logger.warn(`${label} attempt ${attempt}/${maxAttempts} failed: ${err.message}`)
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, delayMs * attempt))
      }
    }
  }
  throw lastError
}

// ── STAGE 1: RESEARCH KEYWORD ─────────────────────────────────
export async function researchKeyword(keyword: string): Promise<ResearchData> {
  return withRetry(async () => {
    const result = await callAgent({
      agentName: 'seo_researcher',
      division: 'growth',
      model: 'light',
      systemPrompt: `You are an SEO research analyst for Safari Zetu, a safari marketplace in Zimbabwe. Research the keyword and return JSON with: search_intent, reader_questions (5-10), ranking_criteria, source_summary, recommended_outline, fact_check_flags. Never fabricate citations.

Return ONLY valid JSON matching this shape:
{
  "search_intent": "informational|transactional|navigational",
  "reader_questions": ["question1", "question2", ...],
  "ranking_criteria": ["criterion1", "criterion2", ...],
  "source_summary": "brief summary of top-ranking content patterns",
  "recommended_outline": ["H2 heading 1", "H2 heading 2", ...],
  "fact_check_flags": ["claim1", "claim2", ...]
}`,
      userMessage: `Research the keyword: "${keyword}". Analyze search intent, what readers want to know, what top-ranking pages cover, and what facts need verification.`,
      triggerType: 'on_demand',
      triggerPayload: { keyword }
    })

    let parsed: ResearchData
    try {
      parsed = JSON.parse(result.content)
    } catch {
      parsed = {
        search_intent: 'informational',
        reader_questions: [
          `What is ${keyword}?`,
          `Why is ${keyword} important for safari travel?`,
          `How to plan a ${keyword} safari?`,
          `When is the best time for ${keyword}?`,
          `What should I pack for ${keyword}?`,
          `How much does ${keyword} cost?`,
          `What wildlife can I see during ${keyword}?`,
          `Is ${keyword} safe for families?`
        ],
        ranking_criteria: ['Comprehensive guide format', 'First-hand experience', 'Practical tips', 'Pricing information'],
        source_summary: `Top-ranking pages for "${keyword}" cover practical planning guides with pricing, wildlife highlights, and seasonal advice.`,
        recommended_outline: [`What is ${keyword}`, `Best time to visit`, `What to expect`, `Planning your trip`, `Costs and budget`, `FAQ`],
        fact_check_flags: [`Verify current pricing for ${keyword}`, `Confirm wildlife sighting statistics`, `Check visa requirements for Zimbabwe`]
      }
    }

    // Store research in Chroma for future reference
    await upsertDocuments('seo-research', [{
      id: `research-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      text: `Keyword: ${keyword}. Intent: ${parsed.search_intent}. Questions: ${parsed.reader_questions.join('; ')}. Outline: ${parsed.recommended_outline.join(' > ')}.`,
      metadata: { keyword, intent: parsed.search_intent, stage: 'research' }
    }])

    logger.info(`SEO research complete for keyword: ${keyword} (intent: ${parsed.search_intent})`)
    return parsed
  }, `researchKeyword("${keyword}")`)
}

// ── STAGE 2: CREATE BRIEF FROM RESEARCH ───────────────────────
export async function createBriefFromResearch(
  keyword: string,
  research: ResearchData
): Promise<SEOResearchResult['brief']> {
  return withRetry(async () => {
    const result = await callAgent({
      agentName: 'seo_briefer',
      division: 'growth',
      model: 'light',
      systemPrompt: `Create a structured SEO brief from this research. Return JSON with: intent, audience_questions, outline (H2/H3 structure), ranking_criteria, claims_to_verify, source_notes.

Return ONLY valid JSON matching this shape:
{
  "intent": "search intent description",
  "audience_questions": ["q1", "q2", ...],
  "outline": ["## H2 Heading", "### H3 Subheading", "## Next H2", ...],
  "ranking_criteria": ["criteria1", ...],
  "claims_to_verify": ["claim1", ...],
  "source_notes": ["note1", ...]
}`,
      userMessage: `Create an SEO brief for the keyword "${keyword}" based on this research:

Search Intent: ${research.search_intent}
Reader Questions: ${research.reader_questions.join('; ')}
Ranking Criteria: ${research.ranking_criteria.join('; ')}
Source Summary: ${research.source_summary}
Recommended Outline: ${research.recommended_outline.join(' > ')}
Fact Check Flags: ${research.fact_check_flags.join('; ')}`,
      triggerType: 'on_demand',
      triggerPayload: { keyword, stage: 'brief' }
    })

    let parsed: SEOResearchResult['brief']
    try {
      parsed = JSON.parse(result.content)
    } catch {
      parsed = {
        intent: research.search_intent,
        audience_questions: research.reader_questions,
        outline: research.recommended_outline.map(h => `## ${h}`),
        ranking_criteria: research.ranking_criteria,
        claims_to_verify: research.fact_check_flags,
        source_notes: [research.source_summary]
      }
    }

    // Store brief in Chroma
    await upsertDocuments('seo-briefs', [{
      id: `brief-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      text: `Brief for "${keyword}": Intent: ${parsed.intent}. Outline: ${parsed.outline.join(' > ')}. Claims to verify: ${parsed.claims_to_verify.join('; ')}.`,
      metadata: { keyword, intent: parsed.intent, stage: 'brief' }
    }])

    logger.info(`SEO brief created for keyword: ${keyword}`)
    return parsed
  }, `createBriefFromResearch("${keyword}")`)
}

// ── STAGE 3: WRITE ARTICLE FROM BRIEF ─────────────────────────
export async function writeArticleFromBrief(
  brief: SEOResearchResult['brief'],
  keyword: string,
  brand?: string
): Promise<ArticleDraft> {
  return withRetry(async () => {
    const brandContext = brand ? `Brand voice: ${brand}.` : 'Brand voice: Safari Zetu — knowledgeable, warm, adventurous, authoritative on Zimbabwe safaris.'

    const result = await callAgent({
      agentName: 'seo_writer',
      division: 'growth',
      model: 'heavy',
      systemPrompt: `Write an original, useful SEO article for Safari Zetu from this brief. The article should be about safari experiences in Zimbabwe. Return JSON with: title, meta_title (60 chars), meta_description (155 chars), slug, article_markdown (1500-2500 words), faq (3-5 questions), citations_to_verify. Do not fabricate facts or citations.

${brandContext}

ARTICLE REQUIREMENTS:
- 1500-2500 words of genuine, useful content
- Well-structured with H2/H3 headings matching the outline
- Natural, conversational tone — not robotic or templated
- Include specific details about Zimbabwe destinations
- End with genuinely useful FAQs
- No fabricated statistics or invented citations

Return ONLY valid JSON matching this shape:
{
  "title": "Compelling article title",
  "meta_title": "SEO title (max 60 chars)",
  "meta_description": "SEO description (max 155 chars)",
  "slug": "url-friendly-slug",
  "article_markdown": "Full article in markdown...",
  "faq": [{"question": "Q?", "answer": "A."}, ...],
  "citations_to_verify": ["citation1", ...]
}`,
      userMessage: `Write an SEO article for the keyword "${keyword}" based on this brief:

Intent: ${brief.intent}
Audience Questions: ${brief.audience_questions.join('; ')}
Outline: ${brief.outline.join(' > ')}
Ranking Criteria: ${brief.ranking_criteria.join('; ')}
Claims to Verify: ${brief.claims_to_verify.join('; ')}

Write 1500-2500 words. Use the outline as your structure. Answer the audience questions naturally within the article.`,
      triggerType: 'on_demand',
      triggerPayload: { keyword, stage: 'write', model: 'heavy' }
    })

    let parsed: ArticleDraft
    try {
      parsed = JSON.parse(result.content)
    } catch {
      // Fallback: try to extract markdown from the response
      const content = result.content
      const titleMatch = content.match(/^#\s+(.+)/m)
      parsed = {
        title: titleMatch?.[1] || `${keyword} — Safari Zetu Guide`,
        meta_title: (titleMatch?.[1] || `${keyword} Guide`).substring(0, 60),
        meta_description: `Complete guide to ${keyword} in Zimbabwe. Plan your safari with Safari Zetu's expert advice on wildlife, timing, costs, and more.`,
        slug: keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        article_markdown: content.length > 500 ? content : `# ${keyword}\n\nThis guide covers everything you need to know about ${keyword} in Zimbabwe.\n\n## Introduction\n\n${content}\n\n## Planning Your Safari\n\nContact Safari Zetu to plan your perfect safari experience.\n\n## FAQ\n\n**What is the best time to visit?**\nThe dry season from May to October offers the best wildlife viewing.\n\n**How much does it cost?**\nSafari costs vary. Contact us for current pricing.`,
        faq: [
          { question: `What is the best time for ${keyword}?`, answer: 'The dry season (May–October) offers the best wildlife viewing in Zimbabwe.' },
          { question: `How do I book a ${keyword} safari?`, answer: 'Visit safarizetu.com or contact our team to plan your safari with verified operators.' }
        ],
        citations_to_verify: []
      }
    }

    // Ensure meta_title and meta_description are within limits
    if (parsed.meta_title.length > 60) {
      parsed.meta_title = parsed.meta_title.substring(0, 57) + '...'
    }
    if (parsed.meta_description.length > 155) {
      parsed.meta_description = parsed.meta_description.substring(0, 152) + '...'
    }

    // Store article draft in Chroma
    await upsertDocuments('seo-articles', [{
      id: `article-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      text: `Article: ${parsed.title}. Slug: ${parsed.slug}. Word count: ~${parsed.article_markdown.split(/\s+/).length}. FAQ count: ${parsed.faq.length}.`,
      metadata: { keyword, slug: parsed.slug, stage: 'draft', word_count: parsed.article_markdown.split(/\s+/).length }
    }])

    logger.info(`SEO article drafted: "${parsed.title}" (~${parsed.article_markdown.split(/\s+/).length} words)`)
    return parsed
  }, `writeArticleFromBrief("${keyword}")`)
}

// ── STAGE 4: HUMANIZE ARTICLE ─────────────────────────────────
export async function humanizeArticle(article: ArticleDraft): Promise<ArticleDraft> {
  return withRetry(async () => {
    const result = await callAgent({
      agentName: 'content_humanizer',
      division: 'growth',
      model: 'light',
      systemPrompt: `Rewrite this article to sound natural and human-written. Remove any AI-sounding patterns: no 'delve into', no 'it's worth noting', no 'in conclusion', no excessive hedging. Keep all facts intact. Return the improved markdown.

HUMANIZATION RULES:
- Remove cliché AI phrases: "delve into", "it's worth noting", "in this comprehensive guide", "let's explore", "it goes without saying"
- Vary sentence length — mix short punchy sentences with longer ones
- Use contractions (don't, can't, it's) unless formal tone is needed
- Add personal voice — "we've seen", "our team recommends", "in our experience"
- Keep paragraphs short (2-4 sentences max)
- Preserve all factual content, headings, and structure
- Do NOT add new claims or statistics
- The article must pass AI detection tools

Return ONLY the improved markdown text, no JSON wrapping.`,
      userMessage: `Humanize this article. Remove AI patterns while keeping all facts and structure intact:

TITLE: ${article.title}

${article.article_markdown}`,
      triggerType: 'on_demand',
      triggerPayload: { slug: article.slug, stage: 'humanize' }
    })

    // Extract the humanized markdown — strip any JSON wrapping if present
    let humanizedMarkdown = result.content.trim()
    try {
      const maybeJson = JSON.parse(humanizedMarkdown)
      if (maybeJson.article_markdown) {
        humanizedMarkdown = maybeJson.article_markdown
      } else if (maybeJson.markdown) {
        humanizedMarkdown = maybeJson.markdown
      }
    } catch {
      // Not JSON, use as-is
    }

    // Store humanized version
    await upsertDocuments('seo-articles', [{
      id: `humanized-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      text: `Humanized article: ${article.title}. Word count: ~${humanizedMarkdown.split(/\s+/).length}.`,
      metadata: { keyword: article.slug, slug: article.slug, stage: 'humanized', humanized: true }
    }])

    logger.info(`Article humanized: "${article.title}" (~${humanizedMarkdown.split(/\s+/).length} words)`)
    return {
      ...article,
      article_markdown: humanizedMarkdown
    }
  }, `humanizeArticle("${article.slug}")`)
}

// ── STAGE 5: FULL PIPELINE ────────────────────────────────────
export async function runSEOResearchPipeline(
  keyword: string,
  options?: {
    language?: string
    country?: string
    brand?: string
    audience?: string
  }
): Promise<SEOResearchResult> {
  const traceId = startTrace('seo_research_pipeline', 'mimo-v2.5-free')
  const startTime = Date.now()

  try {
    // Stage 1: Research
    logger.info(`[SEO Pipeline] Stage 1/4 — Researching keyword: "${keyword}"`)
    const research = await researchKeyword(keyword)

    // Stage 2: Brief
    logger.info(`[SEO Pipeline] Stage 2/4 — Creating brief for: "${keyword}"`)
    const brief = await createBriefFromResearch(keyword, research)

    // Stage 3: Write
    logger.info(`[SEO Pipeline] Stage 3/4 — Writing article for: "${keyword}"`)
    const articleDraft = await writeArticleFromBrief(brief, keyword, options?.brand)

    // Stage 4: Humanize
    logger.info(`[SEO Pipeline] Stage 4/4 — Humanizing article: "${articleDraft.title}"`)
    const humanizedArticle = await humanizeArticle(articleDraft)

    // Build result
    const result: SEOResearchResult = {
      keyword,
      brief,
      article: humanizedArticle,
      humanized: true,
      publish_mode: 'DRAFT_ONLY',
      approval_status: 'NEEDS_HUMAN_REVIEW'
    }

    // Store final article in content_performance table
    try {
      await pool.query(
        `INSERT INTO content_performance (
          platform, content_type, title, slug, body_markdown, meta_title, meta_description,
          keywords, faq_json, status, approval_status, word_count, humanized, created_at
        ) VALUES (
          'seo_blog', 'article', $1, $2, $3, $4, $5,
          $6, $7, 'draft', 'needs_human_review', $8, true, NOW()
        )`,
        [
          humanizedArticle.title,
          humanizedArticle.slug,
          humanizedArticle.article_markdown,
          humanizedArticle.meta_title,
          humanizedArticle.meta_description,
          [keyword],
          JSON.stringify(humanizedArticle.faq),
          humanizedArticle.article_markdown.split(/\s+/).length
        ]
      )
    } catch (dbErr: any) {
      logger.warn(`Could not persist to content_performance: ${dbErr.message}`)
    }

    const elapsed = Date.now() - startTime
    endTrace(traceId, {
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      latency_ms: elapsed,
      status: 'success'
    })

    logger.info(`[SEO Pipeline] Complete — "${humanizedArticle.title}" (${elapsed}ms)`)
    return result

  } catch (error: any) {
    const elapsed = Date.now() - startTime
    endTrace(traceId, {
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      latency_ms: elapsed,
      status: 'error',
      error: error.message
    })

    logger.error(`[SEO Pipeline] Failed for "${keyword}": ${error.message}`)
    throw error
  }
}
