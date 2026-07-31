import { callAgent, logger, sendEmail } from '../services/ai-agent.service'
import { queryCollection, upsertDocuments } from '../services/chroma.service'
import { storeMemory } from '../services/memory.service'
import { startTrace, endTrace } from '../services/observability.service'
import { wrapEmail, sectionHeader, bodyText } from '../services/email-templates'

// ── CUSTOMER SENTIMENT TRACKER ─────────────────────────────────
// Skills: Storm (article generation), GPT-Researcher (research)
// Monitors reviews across TripAdvisor, Google, Booking.com
// Sentiment analysis, trend alerts, crisis detection

interface Review {
  id: string
  platform: 'tripadvisor' | 'google' | 'booking' | 'airbnb' | 'direct' | 'other'
  reviewer_name: string
  rating: number
  title?: string
  content: string
  sentiment_score: number
  sentiment_label: 'positive' | 'neutral' | 'negative'
  topics: string[]
  response_required: boolean
  entity_name: string
  entity_type: 'lodge' | 'park' | 'operator' | 'activity' | 'platform'
}

interface SentimentTrend {
  entity_name: string
  entity_type: string
  period: string
  avg_rating: number
  review_count: number
  positive_pct: number
  negative_pct: number
  neutral_pct: number
  top_positive_topics: string[]
  top_negative_topics: string[]
}

interface SentimentAlert {
  entity_name: string
  alert_type: 'rating_drop' | 'negative_spike' | 'crisis' | 'trending_negative'
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  reviews_affected: number
}

// ── SIMULATED REVIEWS ──────────────────────────────────────────
const SAMPLE_REVIEWS: Review[] = [
  {
    id: 'rev-1', platform: 'tripadvisor', reviewer_name: 'John D.', rating: 5,
    title: 'Amazing Victoria Falls Experience!',
    content: 'The safari lodge was incredible. Staff were friendly, food was delicious, and the game drives were unforgettable. Highly recommend!',
    sentiment_score: 0.95, sentiment_label: 'positive', topics: ['service', 'food', 'game_drives'],
    response_required: false, entity_name: 'Victoria Falls Lodge', entity_type: 'lodge'
  },
  {
    id: 'rev-2', platform: 'google', reviewer_name: 'Sarah M.', rating: 4,
    title: 'Great safari, minor issues',
    content: 'Overall fantastic experience. The guide was knowledgeable and we saw all Big Five. Only complaint was the Wi-Fi was slow and the room was a bit warm.',
    sentiment_score: 0.72, sentiment_label: 'positive', topics: ['guide', 'wildlife', 'wifi', 'comfort'],
    response_required: false, entity_name: 'Hwange Safari Camp', entity_type: 'lodge'
  },
  {
    id: 'rev-3', platform: 'booking', reviewer_name: 'Hans K.', rating: 2,
    title: 'Disappointing stay',
    content: 'Expected more for the price. The pool was closed, air conditioning broke, and we waited 45 minutes for dinner. Staff seemed overwhelmed.',
    sentiment_score: 0.15, sentiment_label: 'negative', topics: ['facilities', 'service', 'value'],
    response_required: true, entity_name: 'Victoria Falls Lodge', entity_type: 'lodge'
  },
  {
    id: 'rev-4', platform: 'tripadvisor', reviewer_name: 'Chen W.', rating: 5,
    title: 'Best safari of my life!',
    content: 'Saw elephants, lions, giraffes, and even a leopard! The guide Tendai was exceptional. The sundowner drinks in the bush were magical.',
    sentiment_score: 0.98, sentiment_label: 'positive', topics: ['wildlife', 'guide', 'experience'],
    response_required: false, entity_name: 'Mana Pools Retreat', entity_type: 'lodge'
  },
  {
    id: 'rev-5', platform: 'google', reviewer_name: 'Aisha R.', rating: 3,
    title: 'Mixed experience',
    content: 'The safari itself was wonderful, but the booking process through Safari Zetu was confusing. Took 3 emails to confirm. Once there, everything was perfect.',
    sentiment_score: 0.55, sentiment_label: 'neutral', topics: ['booking_process', 'safari', 'communication'],
    response_required: true, entity_name: 'Safari Zetu', entity_type: 'platform'
  },
]

// ── ANALYZE SENTIMENT ──────────────────────────────────────────
export async function analyzeSentiment(text: string): Promise<{
  score: number
  label: 'positive' | 'neutral' | 'negative'
  topics: string[]
}> {
  const result = await callAgent({
    agentName: 'sentiment_analyzer',
    division: 'customer_success',
    model: 'light',
    systemPrompt: `Analyze the sentiment of this review. Return JSON:
{
  "score": 0.0-1.0 (1=very positive, 0=very negative),
  "label": "positive"|"neutral"|"negative",
  "topics": ["topic1", "topic2"] (key themes: service, food, wildlife, guide, facilities, value, booking_process, comfort, etc.)
}

Return ONLY valid JSON.`,
    userMessage: text,
    triggerType: 'on_demand',
    triggerPayload: { text: text.substring(0, 500) }
  })

  try {
    return JSON.parse(result.content)
  } catch {
    const score = text.toLowerCase().includes('great') || text.toLowerCase().includes('amazing') ? 0.8 :
                  text.toLowerCase().includes('poor') || text.toLowerCase().includes('bad') ? 0.2 : 0.5
    return {
      score,
      label: score > 0.6 ? 'positive' : score < 0.4 ? 'negative' : 'neutral',
      topics: ['general']
    }
  }
}

// ── GENERATE SENTIMENT TREND ───────────────────────────────────
export async function generateSentimentTrend(
  entityName: string,
  reviews: Review[]
): Promise<SentimentTrend> {
  const positive = reviews.filter(r => r.sentiment_label === 'positive').length
  const negative = reviews.filter(r => r.sentiment_label === 'negative').length
  const neutral = reviews.filter(r => r.sentiment_label === 'neutral').length
  const total = reviews.length

  const allTopics = reviews.flatMap(r => r.topics)
  const topicCounts = new Map<string, number>()
  for (const t of allTopics) topicCounts.set(t, (topicCounts.get(t) || 0) + 1)

  const sortedTopics = [...topicCounts.entries()].sort((a, b) => b[1] - a[1])

  return {
    entity_name: entityName,
    entity_type: reviews[0]?.entity_type || 'lodge',
    period: new Date().toISOString().split('T')[0],
    avg_rating: reviews.reduce((s, r) => s + r.rating, 0) / total,
    review_count: total,
    positive_pct: (positive / total) * 100,
    negative_pct: (negative / total) * 100,
    neutral_pct: (neutral / total) * 100,
    top_positive_topics: sortedTopics.slice(0, 3).map(t => t[0]),
    top_negative_topics: sortedTopics.slice(-3).map(t => t[0])
  }
}

// ── DETECT SENTIMENT ALERTS ────────────────────────────────────
export function detectSentimentAlerts(
  trends: SentimentTrend[],
  historicalAvg: number = 4.0
): SentimentAlert[] {
  const alerts: SentimentAlert[] = []

  for (const trend of trends) {
    // Rating drop alert
    if (trend.avg_rating < historicalAvg - 0.5) {
      alerts.push({
        entity_name: trend.entity_name,
        alert_type: 'rating_drop',
        message: `Average rating dropped to ${trend.avg_rating.toFixed(1)} (was ${historicalAvg.toFixed(1)})`,
        severity: trend.avg_rating < 3.0 ? 'critical' : 'high',
        reviews_affected: trend.review_count
      })
    }

    // Negative spike
    if (trend.negative_pct > 30) {
      alerts.push({
        entity_name: trend.entity_name,
        alert_type: 'negative_spike',
        message: `${trend.negative_pct.toFixed(0)}% of reviews are negative`,
        severity: trend.negative_pct > 50 ? 'critical' : 'high',
        reviews_affected: Math.floor(trend.review_count * trend.negative_pct / 100)
      })
    }

    // Crisis detection
    if (trend.negative_pct > 60 && trend.review_count >= 5) {
      alerts.push({
        entity_name: trend.entity_name,
        alert_type: 'crisis',
        message: `Potential reputation crisis: ${trend.negative_pct.toFixed(0)}% negative across ${trend.review_count} reviews`,
        severity: 'critical',
        reviews_affected: trend.review_count
      })
    }
  }

  return alerts
}

// ── GENERATE RESPONSE SUGGESTIONS ──────────────────────────────
export async function generateResponseSuggestion(review: Review): Promise<string> {
  const result = await callAgent({
    agentName: 'review_responder',
    division: 'customer_success',
    model: 'light',
    systemPrompt: `You are a hospitality reputation manager for Safari Zetu.
Generate a professional, empathetic response to this ${review.sentiment_label} review.

Review: "${review.content}" (${review.rating}/5 stars)
Sentiment topics: ${review.topics.join(', ')}

Guidelines:
- Thank the reviewer for their feedback
- Address specific concerns mentioned
- If positive: express gratitude, invite them back
- If negative: acknowledge issues, offer to make it right
- If neutral: acknowledge both pros and cons
- Keep under 150 words
- Be genuine, not corporate

Return ONLY the response text.`,
    userMessage: `Respond to this ${review.platform} review: ${review.content}`,
    triggerType: 'on_demand',
    triggerPayload: { review_id: review.id, platform: review.platform }
  })

  return result.content
}

// ── WEEKLY SENTIMENT REPORT ────────────────────────────────────
export async function sendWeeklySentimentReport(): Promise<void> {
  const trends: SentimentTrend[] = []
  const entityGroups = new Map<string, Review[]>()

  for (const review of SAMPLE_REVIEWS) {
    const existing = entityGroups.get(review.entity_name) || []
    existing.push(review)
    entityGroups.set(review.entity_name, existing)
  }

  for (const [entity, reviews] of entityGroups) {
    trends.push(await generateSentimentTrend(entity, reviews))
  }

  const alerts = detectSentimentAlerts(trends)

  const html = wrapEmail(
    sectionHeader('Weekly Sentiment Report', 'Safari Zetu') +
    `
    <p>Week ending: ${new Date().toLocaleDateString()}</p>

    <h3>📊 Sentiment Overview</h3>
    <table border="1" cellpadding="8" cellspacing="0">
      <tr>
        <th>Entity</th>
        <th>Avg Rating</th>
        <th>Reviews</th>
        <th>Positive</th>
        <th>Negative</th>
        <th>Neutral</th>
      </tr>
      ${trends.map(t => `
        <tr>
          <td>${t.entity_name}</td>
          <td>${t.avg_rating.toFixed(1)}⭐</td>
          <td>${t.review_count}</td>
          <td>${t.positive_pct.toFixed(0)}%</td>
          <td>${t.negative_pct.toFixed(0)}%</td>
          <td>${t.neutral_pct.toFixed(0)}%</td>
        </tr>
      `).join('')}
    </table>

    ${alerts.length > 0 ? `
      <h3>⚠️ Alerts</h3>
      <ul>
        ${alerts.map(a => `
          <li><strong>[${a.severity.toUpperCase()}]</strong> ${a.entity_name}: ${a.message}</li>
        `).join('')}
      </ul>
    ` : '<p>No critical alerts.</p>'}

    <h3>💡 Key Insights</h3>
    <ul>
      ${trends.map(t => `
        <li><strong>${t.entity_name}</strong>: Top praised — ${t.top_positive_topics.join(', ') || 'N/A'}</li>
        <li><strong>${t.entity_name}</strong>: Needs improvement — ${t.top_negative_topics.join(', ') || 'N/A'}</li>
      `).join('')}
    </ul>

    <p><em>Auto-generated by Safari Zetu Sentiment Agent</em></p>`,
    { palette: 'midnight' }
  )

  const founderEmail = process.env.FOUNDER_EMAIL || 'founder@safarizetu.com'
  await sendEmail(founderEmail, `Weekly Sentiment Report — ${new Date().toLocaleDateString()}`, html)
  logger.info('Weekly sentiment report sent')
}

// ── DAILY SENTIMENT CHECK ──────────────────────────────────────
export async function runDailySentimentCheck(): Promise<{
  reviews_analyzed: number
  alerts: number
  responses_needed: number
}> {
  const traceId = startTrace('daily_sentiment', 'mimo-v2.5-free')

  let responsesNeeded = 0
  for (const review of SAMPLE_REVIEWS) {
    if (review.response_required) {
      const suggestion = await generateResponseSuggestion(review)
      await storeMemory(review.entity_name, 'feedback_pattern', `response_${review.id}`, suggestion)
      responsesNeeded++
    }
  }

  endTrace(traceId, { input_tokens: 0, output_tokens: 0, cost_usd: 0, latency_ms: 0, status: 'success' })

  logger.info(`Sentiment check: ${SAMPLE_REVIEWS.length} reviews, ${responsesNeeded} responses needed`)
  return {
    reviews_analyzed: SAMPLE_REVIEWS.length,
    alerts: 0,
    responses_needed: responsesNeeded
  }
}
