import { logger, pool } from './ai-agent.service'
import { callAgent } from './ai-agent.service'
import { getCompetitiveLandscape } from './competitor-intelligence.service'

// ── CONTINUOUS LEARNING ENGINE ─────────────────────────────────
// The system learns from what ACTUALLY works:
// - Buffer engagement (likes, comments, shares, reach)
// - Lead responses (Apollo contacts who engage)
// - Email opens/clicks (Resend)
// - SMS replies (Africa's Talking)
// - Content performance over time
//
// It adapts: which tones work, which topics resonate, which psychology
// principles drive real booking behavior, not just vanity metrics.

interface EngagementData {
  platform: string
  content_type: string
  memory_type: string
  tone: string
  topic: string
  psychology_used: string[]
  impressions: number
  likes: number
  comments: number
  shares: number
  saves: number
  clicks: number
  reach: number
  booked: boolean           // Did this lead to a booking?
  recorded_at: Date
}

interface LearningInsight {
  category: string          // "tone", "topic", "psychology", "timing", "format"
  finding: string
  confidence: number        // 0-1
  data_points: number
  recommendation: string
}

interface AudienceProfile {
  segment: string           // "luxury_seeker", "adventure_first", "family_planner", etc.
  triggers: string[]        // What makes them act
  preferred_tones: string[]
  preferred_topics: string[]
  psychological_profile: string
  conversion_rate: number
  sample_size: number
}

// ── RECORD ENGAGEMENT ──────────────────────────────────────────
export async function recordEngagement(data: EngagementData): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO content_performance 
       (platform, content_type, memory_type, tone, topic, psychology_used, 
        impressions, likes, comments, shares, saves, clicks, reach, booked, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        data.platform, data.content_type, data.memory_type, data.tone, data.topic,
        JSON.stringify(data.psychology_used), data.impressions, data.likes, data.comments,
        data.shares, data.saves, data.clicks, data.reach, data.booked, data.recorded_at
      ]
    )
    logger.info(`Recorded engagement: ${data.platform} ${data.memory_type} - ${data.impressions} impressions, ${data.likes} likes`)
  } catch (e: any) {
    logger.error(`Failed to record engagement: ${e.message}`)
  }
}

// ── ANALYZE PERFORMANCE ────────────────────────────────────────
// Finds patterns in what content actually drives bookings
export async function analyzePerformance(): Promise<{
  top_performing: LearningInsight[]
  audience_profiles: AudienceProfile[]
  content_strategy: string
}> {
  try {
    // Get last 90 days of performance data
    const { rows } = await pool.query(
      `SELECT * FROM content_performance 
       WHERE recorded_at > NOW() - INTERVAL '90 days'
       ORDER BY recorded_at DESC`
    )

    if (rows.length < 10) {
      return {
        top_performing: [],
        audience_profiles: [],
        content_strategy: 'Insufficient data. Keep posting to build learning base.'
      }
    }

    // Find patterns
    const insights = findPatterns(rows)
    const audiences = buildAudienceProfiles(rows)

    // Get competitor landscape for context
    let competitorLandscape = null
    try {
      competitorLandscape = await getCompetitiveLandscape()
    } catch { /* Competitor data unavailable */ }

    // Generate strategy recommendation (with competitor context)
    const strategy = await generateAdaptiveStrategy(insights, audiences, competitorLandscape)

    return {
      top_performing: insights,
      audience_profiles: audiences,
      content_strategy: strategy
    }
  } catch (e: any) {
    logger.error(`Performance analysis failed: ${e.message}`)
    return { top_performing: [], audience_profiles: [], content_strategy: 'Analysis unavailable.' }
  }
}

// ── FIND PATTERNS ──────────────────────────────────────────────
function findPatterns(rows: any[]): LearningInsight[] {
  const insights: LearningInsight[] = []

  // Group by dimension and calculate engagement rates
  const byDimension = (field: string) => {
    const groups: Record<string, any[]> = {}
    for (const row of rows) {
      const key = row[field] || 'unknown'
      if (!groups[key]) groups[key] = []
      groups[key].push(row)
    }
    return groups
  }

  const calcEngagement = (group: any[]) => {
    const totalEngagement = group.reduce((sum, r) => sum + (r.likes || 0) + (r.comments || 0) + (r.shares || 0) + (r.saves || 0), 0)
    const totalImpressions = group.reduce((sum, r) => sum + (r.impressions || 1), 0)
    const totalBooked = group.filter(r => r.booked).length
    return {
      engagement_rate: totalEngagement / Math.max(totalImpressions, 1),
      booking_rate: totalBooked / Math.max(group.length, 1),
      avg_clicks: group.reduce((sum, r) => sum + (r.clicks || 0), 0) / group.length,
      sample_size: group.length
    }
  }

  // Analyze tones
  const toneGroups = byDimension('tone')
  const toneInsights: LearningInsight[] = Object.entries(toneGroups)
    .map(([tone, data]) => {
      const stats = calcEngagement(data)
      return {
        category: 'tone',
        finding: `"${tone}" tone: ${(stats.engagement_rate * 100).toFixed(1)}% engagement, ${(stats.booking_rate * 100).toFixed(1)}% booking rate`,
        confidence: Math.min(stats.sample_size / 10, 1),
        data_points: stats.sample_size,
        recommendation: `Use "${tone}" tone ${stats.booking_rate > 0.05 ? 'more often' : stats.booking_rate < 0.01 ? 'less often' : 'as-is'}`
      }
    })
    .sort((a, b) => b.confidence - a.confidence)

  insights.push(...toneInsights)

  // Analyze memory types
  const memoryGroups = byDimension('memory_type')
  const memoryInsights: LearningInsight[] = Object.entries(memoryGroups)
    .map(([type, data]) => {
      const stats = calcEngagement(data)
      return {
        category: 'memory_type',
        finding: `"${type}" memory: ${(stats.engagement_rate * 100).toFixed(1)}% engagement, ${(stats.booking_rate * 100).toFixed(1)}% booking rate`,
        confidence: Math.min(stats.sample_size / 10, 1),
        data_points: stats.sample_size,
        recommendation: `"${type}" memories ${stats.booking_rate > 0.05 ? 'convert well' : 'build awareness'}`
      }
    })
    .sort((a, b) => b.confidence - a.confidence)

  insights.push(...memoryInsights)

  // Analyze psychology principles
  const psychGroups: Record<string, any[]> = {}
  for (const row of rows) {
    const psychs = JSON.parse(row.psychology_used || '[]')
    for (const p of psychs) {
      if (!psychGroups[p]) psychGroups[p] = []
      psychGroups[p].push(row)
    }
  }

  const psychInsights: LearningInsight[] = Object.entries(psychGroups)
    .map(([psych, data]) => {
      const stats = calcEngagement(data)
      return {
        category: 'psychology',
        finding: `"${psych}" principle: ${(stats.engagement_rate * 100).toFixed(1)}% engagement, ${(stats.booking_rate * 100).toFixed(1)}% booking rate`,
        confidence: Math.min(stats.sample_size / 5, 1),
        data_points: stats.sample_size,
        recommendation: `Psychology principle "${psych}" ${stats.booking_rate > 0.05 ? 'drives bookings' : 'builds interest'}`
      }
    })
    .sort((a, b) => b.confidence - a.confidence)

  insights.push(...psychInsights)

  // Analyze platforms
  const platformGroups = byDimension('platform')
  const platformInsights: LearningInsight[] = Object.entries(platformGroups)
    .map(([platform, data]) => {
      const stats = calcEngagement(data)
      return {
        category: 'platform',
        finding: `${platform}: ${(stats.engagement_rate * 100).toFixed(1)}% engagement, ${(stats.booking_rate * 100).toFixed(1)}% booking rate, avg ${stats.avg_clicks.toFixed(1)} clicks`,
        confidence: Math.min(stats.sample_size / 10, 1),
        data_points: stats.sample_size,
        recommendation: `${platform} ${stats.booking_rate > 0.05 ? 'is your conversion channel' : 'builds awareness'}`
      }
    })
    .sort((a, b) => b.confidence - a.confidence)

  insights.push(...platformInsights)

  // Analyze topics
  const topicGroups = byDimension('topic')
  const topicInsights: LearningInsight[] = Object.entries(topicGroups)
    .map(([topic, data]) => {
      const stats = calcEngagement(data)
      return {
        category: 'topic',
        finding: `"${topic}" topic: ${(stats.engagement_rate * 100).toFixed(1)}% engagement, ${(stats.booking_rate * 100).toFixed(1)}% booking rate`,
        confidence: Math.min(stats.sample_size / 10, 1),
        data_points: stats.sample_size,
        recommendation: `"${topic}" content ${stats.booking_rate > 0.05 ? 'converts' : 'engages'}`
      }
    })
    .sort((a, b) => b.confidence - a.confidence)

  insights.push(...topicInsights)

  return insights.slice(0, 20) // Top 20 insights
}

// ── BUILD AUDIENCE PROFILES ────────────────────────────────────
// Identifies who is engaging and what makes them book
function buildAudienceProfiles(rows: any[]): AudienceProfile[] {
  const profiles: AudienceProfile[] = []

  // Group by booking behavior
  const booked = rows.filter(r => r.booked)
  const notBooked = rows.filter(r => !r.booked)

  if (booked.length >= 3) {
    // Analyze what booking audiences respond to
    const bookedTones = countUnique(booked.map(r => r.tone))
    const bookedMemories = countUnique(booked.map(r => r.memory_type))
    const bookedTopics = countUnique(booked.map(r => r.topic))

    profiles.push({
      segment: 'booking_audience',
      triggers: [...new Set(booked.flatMap(r => JSON.parse(r.psychology_used || '[]')))],
      preferred_tones: topN(bookedTones, 3),
      preferred_topics: topN(bookedTopics, 3),
      psychological_profile: `Responds to ${topN(bookedMemories, 2).join(' and ')} memories with ${topN(bookedTones, 2).join(' and ')} tone`,
      conversion_rate: booked.length / rows.length,
      sample_size: booked.length
    })
  }

  if (notBooked.length >= 5) {
    // Analyze what non-converters engage with (awareness stage)
    const awareTones = countUnique(notBooked.map(r => r.tone))
    const awareMemories = countUnique(notBooked.map(r => r.memory_type))
    const awareTopics = countUnique(notBooked.map(r => r.topic))

    profiles.push({
      segment: 'awareness_audience',
      triggers: [...new Set(notBooked.flatMap(r => JSON.parse(r.psychology_used || '[]')))],
      preferred_tones: topN(awareTones, 3),
      preferred_topics: topN(awareTopics, 3),
      psychological_profile: `Engages with ${topN(awareMemories, 2).join(' and ')} memories but hasn't converted yet`,
      conversion_rate: 0,
      sample_size: notBooked.length
    })
  }

  return profiles
}

// ── GENERATE ADAPTIVE STRATEGY ─────────────────────────────────
// LLM analyzes the data and recommends what to do differently
async function generateAdaptiveStrategy(
  insights: LearningInsight[],
  audiences: AudienceProfile[],
  competitorLandscape?: { known_tactics: string[]; gaps_we_can_fill: string[]; our_advantage: string } | null
): Promise<string> {
  const systemPrompt = `You are Safari Zetu's Strategy Agent. You analyze performance data and audience psychology to recommend what content to create next.

You are NOT a marketer. You are a psychologist who understands that:
- Memories > marketing
- Anticipation > urgency
- Identity > impulse
- Stories > statistics

Based on the data, recommend:
1. Which tones to use more/less
2. Which memory types drive bookings vs awareness
3. Which psychology principles are working
4. What the audience profiles tell us about content strategy
5. Specific content angles to try next

Be specific. Give actionable recommendations, not generic advice.`

  const competitorContext = competitorLandscape ? `
COMPETITOR LANDSCAPE:
- Known competitor tactics: ${competitorLandscape.known_tactics.join(', ') || 'none tracked yet'}
- Our advantage: ${competitorLandscape.our_advantage}
- Gaps we can fill: ${competitorLandscape.gaps_we_can_fill.join(', ')}` : ''

  const dataSummary = `
PERFORMANCE INSIGHTS:
${insights.map(i => `- ${i.category}: ${i.finding} (confidence: ${(i.confidence * 100).toFixed(0)}%, data points: ${i.data_points})`).join('\n')}

AUDIENCE PROFILES:
${audiences.map(a => `- ${a.segment}: ${a.psychological_profile} (conversion: ${(a.conversion_rate * 100).toFixed(1)}%, sample: ${a.sample_size})`).join('\n')}
${audiences.map(a => `  Triggers: ${a.triggers.join(', ')}`).join('\n')}
${audiences.map(a => `  Preferred tones: ${a.preferred_tones.join(', ')}`).join('\n')}
${competitorContext}

What should Safari Zetu do differently to outmaneuver competitors?`

  try {
    const result = await callAgent({
      agentName: 'strategy_researcher',
      division: 'growth',
      model: 'heavy',
      systemPrompt,
      userMessage: dataSummary,
      triggerType: 'adaptive_strategy',
      triggerPayload: { insights: insights.length, audiences: audiences.length },
      maxTokens: 1500
    })

    return result.content.trim()
  } catch (e: any) {
    logger.error(`Strategy generation failed: ${e.message}`)
    return generateFallbackStrategy(insights)
  }
}

// ── FALLBACK STRATEGY ──────────────────────────────────────────
function generateFallbackStrategy(insights: LearningInsight[]): string {
  if (insights.length === 0) {
    return 'No data yet. Post more content to build the learning base. Focus on variety — different tones, memory types, and topics.'
  }

  const topInsights = insights.slice(0, 5)
  return `Based on ${insights.length} insights:
${topInsights.map(i => `- ${i.recommendation}`).join('\n')}

Keep testing. The system is learning what works for Safari Zetu's specific audience.`
}

// ── GET LEARNING STATUS ────────────────────────────────────────
export async function getLearningStatus(): Promise<{
  total_data_points: number
  days_of_data: number
  insights_generated: number
  confidence_level: string
  next_milestone: string
}> {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) as total, 
              MIN(recorded_at) as earliest,
              MAX(recorded_at) as latest
       FROM content_performance`
    )
    const total = parseInt(rows[0]?.total || '0')
    const earliest = rows[0]?.earliest
    const latest = rows[0]?.latest

    const daysOfData = earliest && latest
      ? Math.ceil((new Date(latest).getTime() - new Date(earliest).getTime()) / (1000 * 60 * 60 * 24))
      : 0

    let confidence = 'Low'
    let nextMilestone = 'Post 10 pieces of content to start learning'
    if (total >= 50) { confidence = 'High'; nextMilestone = 'Analyze audience segments' }
    else if (total >= 20) { confidence = 'Medium'; nextMilestone = 'Track booking conversions' }
    else if (total >= 10) { confidence = 'Building'; nextMilestone = 'Compare tones and memory types' }

    return {
      total_data_points: total,
      days_of_data: daysOfData,
      insights_generated: Math.min(total, 20),
      confidence_level: confidence,
      next_milestone: nextMilestone
    }
  } catch {
    return {
      total_data_points: 0,
      days_of_data: 0,
      insights_generated: 0,
      confidence_level: 'No data',
      next_milestone: 'Start recording engagement data'
    }
  }
}

// ── HELPERS ────────────────────────────────────────────────────
function countUnique(arr: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const item of arr) {
    counts[item] = (counts[item] || 0) + 1
  }
  return counts
}

function topN(counts: Record<string, number>, n: number): string[] {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key]) => key)
}
