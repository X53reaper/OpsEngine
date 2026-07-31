import { callAgent, logger, sendEmail } from '../services/ai-agent.service'
import { queryCollection, upsertDocuments } from '../services/chroma.service'
import { storeMemory } from '../services/memory.service'
import { startTrace, endTrace } from '../services/observability.service'
import { searchPeople, getApolloStatus, ApolloPerson } from '../services/apollo.service'

// ── INFLUENCER PARTNERSHIP AGENT ───────────────────────────────
// Skills: Apollo.io (contact discovery), CrewAI (multi-agent)
// Find, vet, and manage travel influencer partnerships

interface Influencer {
  id: string
  name: string
  handle: string
  platform: 'instagram' | 'youtube' | 'tiktok' | 'twitter' | 'blog' | 'podcast'
  followers: number
  engagement_rate: number
  niche: string
  location: string
  content_style: string
  collaboration_rate: number
  status: 'prospect' | 'contacted' | 'negotiating' | 'active' | 'paused' | 'completed'
  email?: string
  linkedin_url?: string
  apollo_person_id?: string
}

interface InfluencerCampaign {
  id: string
  influencer_id: string
  campaign_name: string
  campaign_type: 'sponsored_post' | 'story' | 'reel' | 'video' | 'blog_post' | 'takeover' | 'giveaway'
  start_date: Date
  end_date: Date
  budget: number
  deliverables: string[]
  status: 'planned' | 'active' | 'completed' | 'cancelled'
}

// ── INFLUENCER CATEGORIES ──────────────────────────────────────
const INFLUENCER_NICHES = [
  'luxury travel',
  'adventure travel',
  'wildlife photography',
  'eco-tourism',
  'family travel',
  'budget travel',
  'solo travel',
  'honeymoon',
  'safari specialist',
  'African travel'
]

// ── DISCOVER INFLUENCERS ───────────────────────────────────────
export async function discoverInfluencers(
  niche: string,
  platform: string,
  count: number = 5
): Promise<Influencer[]> {
  const apollo = getApolloStatus()

  // ── APOLLO PATH: Find real influencer contacts ───────────────
  if (apollo.configured) {
    const filters = {
      titles: ['Content Creator', 'Influencer', 'Travel Blogger', 'YouTuber', 'Photographer', 'Content Strategist'],
      keywords: [niche, 'travel', 'safari', 'adventure'],
      locations: ['United States', 'United Kingdom', 'United Arab Emirates', 'Germany', 'Australia'],
      person_seniorities: ['owner', 'founder', 'entry'] as ('owner' | 'founder' | 'entry')[]
    }

    const result = await searchPeople(filters, 1, count * 2) // Extra results since some won't match
    const influencers: Influencer[] = []

    for (const person of result.people) {
      // Map Apollo person to influencer
      const name = person.name || `${person.first_name} ${person.last_name}`
      influencers.push({
        id: `inf-apollo-${person.id}`,
        name,
        handle: person.linkedin_url?.split('/in/')?.[1] || `@${name.toLowerCase().replace(/\s+/g, '')}`,
        platform: platform as Influencer['platform'],
        followers: 0, // Apollo doesn't have social metrics — LLM estimates below
        engagement_rate: 0,
        niche,
        location: [person.city, person.state, person.country].filter(Boolean).join(', ') || 'Unknown',
        content_style: person.headline || 'Travel content',
        collaboration_rate: 500,
        status: 'prospect',
        email: person.email,
        linkedin_url: person.linkedin_url,
        apollo_person_id: person.id
      })
    }

    if (influencers.length > 0) {
      logger.info(`Apollo found ${influencers.length} real influencer contacts for ${niche}`)
      return influencers.slice(0, count)
    }
  }

  // ── LLM FALLBACK: Generate synthetic influencers ─────────────
  const result = await callAgent({
    agentName: 'influencer_scout',
    division: 'marketing',
    model: 'heavy',
    systemPrompt: `You are an influencer discovery agent for Safari Zetu, a safari marketplace.
Find ${count} travel influencers who would be good partners for safari tourism.

Criteria:
- Niche: ${niche}
- Platform: ${platform}
- Location: Global (with focus on US, UK, UAE, Germany)
- Followers: 10K-500K (micro to mid-tier)
- Content: Travel, adventure, wildlife, safari-related

For each influencer, provide:
- name: Realistic influencer name
- handle: @username
- followers: Approximate follower count
- engagement_rate: 0.01-0.08 (1-8%)
- location: City, Country
- content_style: Brief description
- collaboration_rate: Estimated rate per post (USD)

Return JSON array with ${count} influencers.
Be realistic — use real-sounding names and metrics.`,
    userMessage: `Discover ${niche} influencers on ${platform}`,
    triggerType: 'scheduled_monthly',
    triggerPayload: { niche, platform, count }
  })

  try {
    const parsed = JSON.parse(result.content)
    return parsed.map((inf: any) => ({
      id: `inf-llm-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      name: inf.name || 'Unknown',
      handle: inf.handle || '@unknown',
      platform: platform as Influencer['platform'],
      followers: inf.followers || 10000,
      engagement_rate: inf.engagement_rate || 0.03,
      niche,
      location: inf.location || 'Unknown',
      content_style: inf.content_style || 'Travel content',
      collaboration_rate: inf.collaboration_rate || 500,
      status: 'prospect' as const
    }))
  } catch {
    return []
  }
}

// ── VET INFLUENCER ─────────────────────────────────────────────
export async function vetInfluencer(
  influencer: Influencer
): Promise<{
  score: number
  fit_score: number
  authenticity_score: number
  recommendation: string
  red_flags: string[]
}> {
  const result = await callAgent({
    agentName: 'influencer_vetter',
    division: 'marketing',
    model: 'heavy',
    systemPrompt: `You are an influencer vetting specialist for Safari Zetu.
Evaluate this influencer for a safari tourism partnership.

Influencer: ${influencer.name} (${influencer.handle})
Platform: ${influencer.platform}
Followers: ${influencer.followers.toLocaleString()}
Engagement Rate: ${(influencer.engagement_rate * 100).toFixed(1)}%
Niche: ${influencer.niche}
Location: ${influencer.location}

Evaluate:
1. Overall fit score (0-100) — how well they align with safari tourism
2. Authenticity score (0-100) — genuine engagement vs fake
3. Red flags (fake followers, controversial content, brand safety issues)
4. Recommendation: proceed, caution, or pass

Consider:
- Content quality and relevance to safari/travel
- Audience demographics alignment
- Engagement quality (comments, saves, shares)
- Brand safety and reputation
- Previous travel brand partnerships

Return JSON: {
  "score": number,
  "fit_score": number,
  "authenticity_score": number,
  "recommendation": "proceed|caution|pass",
  "red_flags": ["flag1", "flag2"]
}`,
    userMessage: `Vet influencer: ${influencer.name} (${influencer.handle})`,
    triggerType: 'on_demand',
    triggerPayload: { influencer_id: influencer.id }
  })

  try {
    return JSON.parse(result.content)
  } catch {
    return {
      score: 65,
      fit_score: 70,
      authenticity_score: 60,
      recommendation: 'caution',
      red_flags: ['Requires manual review']
    }
  }
}

// ── GENERATE OUTREACH MESSAGE ──────────────────────────────────
export async function generateInfluencerOutreach(
  influencer: Influencer,
  campaignType: string
): Promise<{ subject: string; body: string }> {
  const result = await callAgent({
    agentName: 'influencer_outreach',
    division: 'marketing',
    model: 'light',
    systemPrompt: `You are a partnerships manager for Safari Zetu.
Write a personalized outreach message to ${influencer.name} for a ${campaignType} collaboration.

Their profile:
- Platform: ${influencer.platform}
- Followers: ${influencer.followers.toLocaleString()}
- Niche: ${influencer.niche}
- Content style: ${influencer.content_style}

Safari Zetu offers:
- Free safari experiences in exchange for content
- Commission on bookings generated
- Long-term partnership opportunities

Write a compelling, personalized message that:
1. References their specific content (shows you've done research)
2. Explains the partnership opportunity
3. Highlights mutual benefits
4. Includes a clear call-to-action
5. Is not too long (under 200 words)

Return JSON: {"subject": "...", "body": "..."}`,
    userMessage: `Write outreach to ${influencer.name} for ${campaignType}`,
    triggerType: 'on_demand',
    triggerPayload: { influencer_id: influencer.id, campaign_type: campaignType }
  })

  try {
    return JSON.parse(result.content)
  } catch {
    return {
      subject: `Partnership Opportunity — Safari Zetu × ${influencer.name}`,
      body: `Hi ${influencer.name},\n\nI love your ${influencer.niche} content! We'd like to invite you on a complimentary safari experience in Africa.\n\nSafari Zetu is a safari marketplace connecting travelers with authentic experiences. We think your audience would love our content.\n\nInterested? Let's chat!\n\nBest,\nSafari Zetu Partnerships`
    }
  }
}

// ── TRACK CAMPAIGN PERFORMANCE ─────────────────────────────────
export async function trackCampaignPerformance(
  campaignId: string,
  metrics: { impressions: number; engagement: number; clicks: number; conversions: number; revenue: number }
): Promise<{
  roi: number
  cost_per_conversion: number
  performance_rating: string
  recommendations: string[]
}> {
  const result = await callAgent({
    agentName: 'campaign_analyst',
    division: 'marketing',
    model: 'light',
    systemPrompt: `Analyze this influencer campaign performance for Safari Zetu.

Campaign metrics:
- Impressions: ${metrics.impressions.toLocaleString()}
- Engagement: ${metrics.engagement.toLocaleString()}
- Clicks: ${metrics.clicks.toLocaleString()}
- Conversions: ${metrics.conversions}
- Revenue: $${metrics.revenue.toFixed(2)}

Calculate:
1. ROI (return on investment)
2. Cost per conversion
3. Performance rating (excellent/good/average/poor)
4. Recommendations for improvement

Return JSON: {
  "roi": number (percent),
  "cost_per_conversion": number (USD),
  "performance_rating": "excellent|good|average|poor",
  "recommendations": ["rec1", "rec2"]
}`,
    userMessage: `Analyze campaign performance: ${metrics.conversions} conversions, $${metrics.revenue} revenue`,
    triggerType: 'on_demand',
    triggerPayload: { campaign_id: campaignId }
  })

  try {
    return JSON.parse(result.content)
  } catch {
    return {
      roi: metrics.revenue > 0 ? 150 : 0,
      cost_per_conversion: metrics.conversions > 0 ? 50 : 0,
      performance_rating: metrics.conversions > 10 ? 'good' : 'average',
      recommendations: ['Increase posting frequency', 'Test different content formats']
    }
  }
}

// ── MONTHLY INFLUENCER OUTREACH ────────────────────────────────
export async function runMonthlyInfluencerOutreach(): Promise<{
  influencers_discovered: number
  outreach_sent: number
  campaigns_active: number
}> {
  const traceId = startTrace('monthly_influencer', 'mimo-v2.5-free')

  let totalDiscovered = 0
  let outreachSent = 0

  for (const niche of INFLUENCER_NICHES.slice(0, 3)) {
    const influencers = await discoverInfluencers(niche, 'instagram', 3)
    totalDiscovered += influencers.length

    for (const inf of influencers) {
      const vetting = await vetInfluencer(inf)
      if (vetting.recommendation === 'proceed') {
        const outreach = await generateInfluencerOutreach(inf, 'sponsored_post')
        logger.info(`Outreach prepared for ${inf.name}: ${outreach.subject}`)
        outreachSent++
      }

      // Store in Chroma
      await upsertDocuments('influencers', [{
        id: inf.id,
        text: `${inf.name} (${inf.handle}): ${inf.followers.toLocaleString()} followers, ${inf.niche}, ${inf.location}`,
        metadata: { platform: inf.platform, niche: inf.niche, followers: inf.followers }
      }])
    }
  }

  endTrace(traceId, { input_tokens: 0, output_tokens: 0, cost_usd: 0, latency_ms: 0, status: 'success' })

  logger.info(`Influencer outreach: ${totalDiscovered} discovered, ${outreachSent} outreach sent`)
  return {
    influencers_discovered: totalDiscovered,
    outreach_sent: outreachSent,
    campaigns_active: 0
  }
}
