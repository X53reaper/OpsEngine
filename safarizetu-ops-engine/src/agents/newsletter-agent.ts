import { callAgent, pool, logger } from '../services/ai-agent.service'
import { startTrace, endTrace } from '../services/observability.service'

// ── NEWSLETTER MACHINE ───────────────────────────────────────────
// Based on n8n Template 01 — Newsletter Machine
// Collects safari/travel news, selects 3-5 stories, writes a full
// newsletter draft in markdown, and stores it for human approval.

interface NewsletterStory {
  headline: string
  summary: string
  source_category: string
  fact_check_needed: boolean
}

interface NewsletterResult {
  subject: string
  preview: string
  stories: NewsletterStory[]
  newsletter_markdown: string
  fact_check_flags: string[]
}

interface NewsletterDraft {
  subject: string
  preview: string
  newsletter_markdown: string
  story_count: number
  generated_at: string
}

// ── SOURCE CATEGORIES ────────────────────────────────────────────
const NEWSLETTER_SOURCES = [
  'Zimbabwe Tourism Authority news',
  'African safari industry updates',
  'Wildlife conservation news Southern Africa',
  'Travel tech and booking platform news',
  'Safari operator success stories'
]

// ── SYSTEM PROMPT ────────────────────────────────────────────────
const NEWSLETTER_SYSTEM_PROMPT = `You are the senior newsletter editor for Safari Zetu — Zimbabwe's premium safari marketplace.

Your job is to write a complete, publication-ready newsletter draft.

AUDIENCE: Travel enthusiasts, safari planners, conservation supporters, and tourism professionals. Mix of first-time safari goers and seasoned Africa travellers.

TONE: Professional but warm. Authoritative without being stuffy. Write like a knowledgeable friend who works in the safari industry, not a corporate press release. Direct sentences. No filler.

TOPICS TO COVER (pick 3-5 stories per issue):
- Safari industry news (operator launches, new routes, pricing trends)
- Zimbabwe tourism (ZTA updates, infrastructure, visa changes)
- Wildlife conservation (anti-poaching, rewilding, research findings)
- Travel tech (booking platforms, AI tools, payment solutions)
- Operator success stories (real results, case studies)

OUTPUT FORMAT — return ONLY valid JSON:
{
  "subject": "Catchy but professional subject line (max 60 chars)",
  "preview": "Preview text for email client (max 120 chars)",
  "stories": [
    {
      "headline": "Story headline",
      "summary": "2-3 sentence summary of the story",
      "source_category": "one of the source categories from the list provided",
      "fact_check_needed": true/false
    }
  ],
  "newsletter_markdown": "Full newsletter body in markdown",
  "fact_check_flags": ["List any claims that need verification before publishing"]
}

NEWSLETTER STRUCTURE (in the markdown body):
1. Brief welcome line (1-2 sentences, reference the current week/season)
2. Each story: ## headline, summary paragraph, 1-sentence takeaway
3. Quick links or resources section (2-3 useful links)
4. Closing: invite replies, mention Safari Zetu

RULES:
- No AI slop. Never use: "delve into", "it's worth noting", "in today's fast-paced world", "let's explore", "a testament to", "game-changer", "leverage", "synergy", "at the end of the day"
- No hedging language ("might", "could potentially", "arguably")
- No excessive exclamation marks
- Each story summary must contain at least one concrete fact, number, or named entity
- Flag any statistic or claim you cannot verify with high confidence
- Output ONLY the JSON object — no preamble, no markdown fences around it`

// ── MAIN EXPORT ──────────────────────────────────────────────────
export async function generateNewsletter(): Promise<NewsletterDraft> {
  const traceId = startTrace('newsletter_machine', 'mimo-v2.5-free', { division: 'growth' })
  const startTime = Date.now()

  logger.info('Newsletter generation started', { sources: NEWSLETTER_SOURCES.length })

  try {
    const sourceList = NEWSLETTER_SOURCES.map((s, i) => `${i + 1}. ${s}`).join('\n')

    const result = await callAgent({
      agentName: 'newsletter_machine',
      division: 'growth',
      model: 'light',
      systemPrompt: NEWSLETTER_SYSTEM_PROMPT,
      userMessage: `Generate this week's Safari Zetu newsletter. Pick 3-5 of the most relevant and interesting stories from these source categories:

${sourceList}

Focus on stories that would matter to someone planning an African safari or interested in Zimbabwe tourism. Prioritise recent developments, concrete data, and actionable information over general awareness pieces.

Today's date: ${new Date().toISOString().split('T')[0]}

Return the JSON output now.`,
      triggerType: 'scheduled_newsletter',
      triggerPayload: { sources: NEWSLETTER_SOURCES },
      maxTokens: 3000
    })

    const parsed = parseNewsletterResponse(result.content)

    // Store the draft in content_performance
    await storeNewsletterDraft(parsed, result.tokensUsed, result.model, result.costUsd)

    const duration = Date.now() - startTime
    logger.info('Newsletter draft generated', {
      subject: parsed.subject,
      story_count: parsed.stories.length,
      fact_check_flags: parsed.fact_check_flags.length,
      duration_ms: duration,
      tokens_used: result.tokensUsed,
      cost_usd: result.costUsd
    })

    endTrace(traceId, {
      input_tokens: result.tokensUsed,
      output_tokens: 0,
      cost_usd: result.costUsd,
      latency_ms: duration,
      status: 'success'
    })

    return {
      subject: parsed.subject,
      preview: parsed.preview,
      newsletter_markdown: parsed.newsletter_markdown,
      story_count: parsed.stories.length,
      generated_at: new Date().toISOString()
    }

  } catch (error: any) {
    const duration = Date.now() - startTime
    logger.error('Newsletter generation failed', { error: error.message, duration_ms: duration })

    endTrace(traceId, {
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      latency_ms: duration,
      status: 'error',
      error: error.message
    })

    throw error
  }
}

// ── PARSE LLM RESPONSE ───────────────────────────────────────────
function parseNewsletterResponse(content: string): NewsletterResult {
  // Strip markdown fences if the LLM wrapped its JSON
  let cleaned = content.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }
  cleaned = cleaned.trim()

  let parsed: NewsletterResult
  try {
    parsed = JSON.parse(cleaned)
  } catch (parseError) {
    // Fallback: construct a minimal result from raw content
    logger.warn('Failed to parse newsletter JSON — using raw content fallback')
    parsed = {
      subject: extractLine(cleaned, 'subject') || 'Safari Zetu Weekly Digest',
      preview: extractLine(cleaned, 'preview') || 'This week in safari and Zimbabwe tourism',
      stories: [],
      newsletter_markdown: cleaned,
      fact_check_flags: ['Entire response needs review — JSON parse failed']
    }
  }

  // Validate required fields
  if (!parsed.subject || !parsed.newsletter_markdown) {
    throw new Error('LLM response missing required fields: subject and newsletter_markdown')
  }

  // Ensure arrays exist
  parsed.stories = parsed.stories || []
  parsed.fact_check_flags = parsed.fact_check_flags || []

  return parsed
}

// ── EXTRACT LINE HELPER ──────────────────────────────────────────
function extractLine(text: string, key: string): string | null {
  const match = text.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`))
  return match?.[1] || null
}

// ── STORE DRAFT IN DATABASE ──────────────────────────────────────
async function storeNewsletterDraft(
  parsed: NewsletterResult,
  tokensUsed: number,
  model: string,
  costUsd: number
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO content_performance (
        platform, content_type, title, content_body, metadata,
        tokens_used, model_used, cost_usd, status, generated_at
      ) VALUES (
        'newsletter', 'weekly_digest', $1, $2, $3,
        $4, $5, $6, 'pending_approval', NOW()
      )`,
      [
        parsed.subject,
        parsed.newsletter_markdown,
        JSON.stringify({
          preview: parsed.preview,
          stories: parsed.stories,
          fact_check_flags: parsed.fact_check_flags,
          story_count: parsed.stories.length
        }),
        tokensUsed,
        model,
        costUsd
      ]
    )
    logger.info('Newsletter draft stored in content_performance', { subject: parsed.subject })
  } catch (error: any) {
    // Log but don't fail — draft is still returned to caller
    logger.warn(`Could not persist newsletter draft: ${error.message}`)
  }
}
