import { logger, pool } from './ai-agent.service'
import { callAgent } from './ai-agent.service'
import { generateMemoryCaption } from './neuroscience-research.service'
import { buildSkillContext } from './skill-manager.service'

// ── PERSONALIZATION ENGINE ─────────────────────────────────────
// Takes a person's data (from Apollo, email interactions, SMS,
// browsing behavior) and creates content that feels like it was
// written specifically for them — because it was.
//
// Not "Dear [Name]" personalization. Real personalization:
// knowing what they care about, what triggered their interest,
// and speaking to THAT specific thing.

interface PersonProfile {
  id: string
  name: string
  email: string
  company?: string
  role?: string
  location?: string
  
  // Behavioral data (from interactions)
  interests: string[]          // What they clicked on, asked about
  engagement_level: string     // "cold", "warm", "hot"
  last_interaction: Date
  interaction_count: number
  
  // Psychology profile (built over time)
  preferred_tone: string       // What tone resonates with them
  preferred_memory_type: string
  psychological_triggers: string[]  // What makes THEM act
  travel_style: string         // "luxury", "adventure", "family", "solo", "honeymoon"
  
  // Context
  budget_range?: string
  travel_dates?: string
  group_size?: number
  special_occasions?: string[]  // "anniversary", "birthday", "retirement"
}

interface PersonalizedContent {
  person_id: string
  channel: string              // "email", "sms", "social_dm", "ad"
  subject_line?: string        // For emails
  body: string
  cta: string
  psychology_used: string[]
  personalization_tokens: string[]
  confidence: number
}

// ── BUILD PERSON PROFILE ───────────────────────────────────────
// Gathers data from multiple sources to build a complete picture
export async function buildPersonProfile(email: string): Promise<PersonProfile | null> {
  try {
    // Try to find existing profile
    const { rows } = await pool.query(
      `SELECT * FROM person_profiles WHERE email = $1`,
      [email]
    )

    if (rows.length > 0) {
      return rows[0] as PersonProfile
    }

    // Build new profile from available data
    const profile: PersonProfile = {
      id: `person-${Date.now()}`,
      name: '',
      email,
      interests: [],
      engagement_level: 'cold',
      last_interaction: new Date(),
      interaction_count: 0,
      preferred_tone: 'inspiring',
      preferred_memory_type: 'The Quiet Moment',
      psychological_triggers: [],
      travel_style: 'adventure'
    }

    // Try to enrich with Apollo data
    try {
      const apolloData = await enrichFromApollo(email)
      if (apolloData) {
        profile.name = apolloData.name || ''
        profile.company = apolloData.company
        profile.role = apolloData.role
        profile.location = apolloData.location
      }
    } catch { /* Apollo not available */ }

    // Save profile
    await saveProfile(profile)
    return profile
  } catch (e: any) {
    logger.error(`Failed to build profile for ${email}: ${e.message}`)
    return null
  }
}

// ── UPDATE PROFILE FROM INTERACTION ────────────────────────────
// Every interaction teaches the system more about this person
export async function updateProfileFromInteraction(
  email: string,
  interaction: {
    type: string               // "email_open", "email_click", "sms_reply", "page_view", "inquiry", "booking"
    content_topic?: string
    content_tone?: string
    content_memory_type?: string
    timestamp: Date
  }
): Promise<void> {
  try {
    let profile = await buildPersonProfile(email)
    if (!profile) return

    // Update engagement level
    profile.interaction_count++
    profile.last_interaction = interaction.timestamp

    if (profile.interaction_count >= 10) profile.engagement_level = 'hot'
    else if (profile.interaction_count >= 3) profile.engagement_level = 'warm'
    else profile.engagement_level = 'cold'

    // Learn preferences from what they engage with
    if (interaction.content_topic) {
      profile.interests.push(interaction.content_topic)
      // Keep last 20 interests
      profile.interests = [...new Set(profile.interests)].slice(-20)
    }

    if (interaction.content_tone) {
      // Track which tones get engagement
      const toneCounts: Record<string, number> = {}
      for (const i of profile.interests) {
        toneCounts[i] = (toneCounts[i] || 0) + 1
      }
      profile.preferred_tone = interaction.content_tone
    }

    if (interaction.content_memory_type) {
      profile.preferred_memory_type = interaction.content_memory_type
    }

    // Update psychological triggers based on interaction type
    if (interaction.type === 'booking') {
      profile.psychological_triggers.push('conversion_ready')
    } else if (interaction.type === 'email_click') {
      profile.psychological_triggers.push('curiosity_driven')
    } else if (interaction.type === 'sms_reply') {
      profile.psychological_triggers.push('relationship_oriented')
    }

    profile.psychological_triggers = [...new Set(profile.psychological_triggers)].slice(-10)

    await saveProfile(profile)
    logger.info(`Updated profile for ${email}: ${profile.engagement_level}, ${profile.interests.length} interests`)
  } catch (e: any) {
    logger.error(`Failed to update profile: ${e.message}`)
  }
}

// ── GENERATE PERSONALIZED EMAIL ────────────────────────────────
// Creates an email that feels like a friend wrote it
export async function generatePersonalizedEmail(
  profile: PersonProfile,
  purpose: string,            // "welcome", "follow_up", "re-engagement", "booking_reminder", "seasonal"
  context?: string
): Promise<PersonalizedContent> {
  // Load skills for this profile's travel style and interests
  const skillKeywords = [profile.travel_style, ...profile.interests.slice(0, 3)].filter(Boolean)
  const skillContext = buildSkillContext('email', skillKeywords, 2000)

  const systemPrompt = `You are Safari Zetu's personal email writer. You write emails that feel like they were written by a human who knows this person — not a marketing automation.

${skillContext ? skillContext + '\n\n' : ''}
This person's profile:
- Name: ${profile.name || 'there'}
- Travel style: ${profile.travel_style}
- Engagement level: ${profile.engagement_level}
- Interests: ${profile.interests.join(', ') || 'general safari'}
- Preferred tone: ${profile.preferred_tone}
- Preferred memory type: ${profile.preferred_memory_type}
- Psychological triggers: ${profile.psychological_triggers.join(', ') || 'unknown'}
- Budget range: ${profile.budget_range || 'not specified'}
- Special occasions: ${profile.special_occasions?.join(', ') || 'none known'}
- Last interaction: ${profile.last_interaction.toISOString()}
- Total interactions: ${profile.interaction_count}

Email purpose: ${purpose}

WRITING RULES:
1. NO subject lines like "Safari Deals!" or "Don't Miss Out!"
2. Subject lines should feel personal: "That place you were asking about" or "Quick thought for you"
3. Open with something relevant to THEIR interests, not a generic greeting
4. Write in first person, like a human who actually cares
5. Reference specific things they've shown interest in
6. Use the psychology that works for THEIR profile:
   - If curiosity_driven: use open loops, unfinished stories
   - If conversion_ready: use clarity, simple next steps
   - If relationship_oriented: use warmth, personal connection
   - If luxury_seeker: use exclusivity, craftsmanship
   - If adventure_first: use excitement, discovery
7. End with a gentle invitation, not a hard CTA
8. Keep it under 150 words
9. Sign off as a real person, not "The Safari Zetu Team"

Return JSON: { "subject": "...", "body": "...", "cta": "...", "psychology_used": [...] }`

  const userMessage = `Write a ${purpose} email to ${profile.name || 'this person'}.
${context ? `Additional context: ${context}` : ''}
${profile.special_occasions?.length ? `They have these occasions coming up: ${profile.special_occasions.join(', ')}` : ''}`

  try {
    const result = await callAgent({
      agentName: 'email_writer',
      division: 'growth',
      model: 'heavy',
      systemPrompt,
      userMessage,
      triggerType: 'personalized_email',
      triggerPayload: { purpose, travel_style: profile.travel_style },
      maxTokens: 800
    })

    const text = result.content
    const jsonMatch = text.match(/\{[\s\S]*\}/)

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        person_id: profile.id,
        channel: 'email',
        subject_line: parsed.subject,
        body: parsed.body,
        cta: parsed.cta || 'Reply to this email if you want to chat',
        psychology_used: parsed.psychology_used || [],
        personalization_tokens: extractPersonalizationTokens(parsed.body, profile),
        confidence: calculateConfidence(profile)
      }
    }

    // Fallback
    return {
      person_id: profile.id,
      channel: 'email',
      subject_line: `Thought you'd like this`,
      body: `Hi ${profile.name || 'there'},\n\nI remembered you were interested in ${profile.interests[0] || 'safari experiences'}. I came across something that made me think of you.\n\n${context || 'Would love to share when you have a moment.'}\n\nWarmly,\nSafari Zetu`,
      cta: 'Reply if you want to know more',
      psychology_used: ['personal_reference', 'memory_activated'],
      personalization_tokens: [profile.name, profile.interests[0]].filter(Boolean),
      confidence: 0.5
    }
  } catch (e: any) {
    logger.error(`Email generation failed: ${e.message}`)
    return {
      person_id: profile.id,
      channel: 'email',
      subject_line: 'Thinking of you',
      body: `Hi ${profile.name || 'there'},\n\nJust a quick note — I know you've been looking at ${profile.interests[0] || 'safari options'}. I'd love to help when you're ready.\n\nNo rush. Just know I'm here.`,
      cta: 'Reply anytime',
      psychology_used: ['low_pressure', 'availability'],
      personalization_tokens: [],
      confidence: 0.3
    }
  }
}

// ── GENERATE PERSONALIZED SMS ──────────────────────────────────
export async function generatePersonalizedSMS(
  profile: PersonProfile,
  purpose: string,
  context?: string
): Promise<PersonalizedContent> {
  const prompt = `Write a short SMS (max 160 chars) for ${profile.name || 'a traveler'}.

Their style: ${profile.travel_style}
Their interests: ${profile.interests.slice(0, 3).join(', ') || 'safari'}
Purpose: ${purpose}
${context ? `Context: ${context}` : ''}

Rules:
- Max 160 characters
- Feel like a friend texting, not a brand
- Reference something specific to them
- No links, no CTAs — just a warm touchpoint
- Sign off with a first name (use "Zetu" as the sender name)

Return JSON: { "body": "...", "psychology_used": [...] }`

  try {
    const result = await callAgent({
      agentName: 'sms_writer',
      division: 'growth',
      model: 'light',
      systemPrompt: 'You write SMS messages that feel like they come from a friend who knows about safari travel. Max 160 chars.',
      userMessage: prompt,
      triggerType: 'personalized_sms',
      triggerPayload: { purpose },
      maxTokens: 200
    })

    const text = result.content
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        person_id: profile.id,
        channel: 'sms',
        body: parsed.body?.substring(0, 160) || '',
        cta: '',
        psychology_used: parsed.psychology_used || ['personal_touch'],
        personalization_tokens: extractPersonalizationTokens(parsed.body || '', profile),
        confidence: calculateConfidence(profile)
      }
    }

    return {
      person_id: profile.id,
      channel: 'sms',
      body: `Hey ${profile.name?.split(' ')[0] || 'there'}, just remembered you were looking at ${profile.interests[0] || 'safari'}. Let me know when you're ready 🌍`,
      cta: '',
      psychology_used: ['personal_reference'],
      personalization_tokens: [],
      confidence: 0.4
    }
  } catch {
    return {
      person_id: profile.id,
      channel: 'sms',
      body: `Hey! Just checking in. Let me know if you want to chat about your trip 🦁`,
      cta: '',
      psychology_used: ['low_pressure'],
      personalization_tokens: [],
      confidence: 0.3
    }
  }
}

// ── GENERATE PERSONALIZED AD ───────────────────────────────────
// Creates ad copy tailored to a specific audience segment
export async function generatePersonalizedAd(
  audience_segment: string,
  platform: string,
  focus_interest?: string
): Promise<PersonalizedContent> {
  const prompt = `Create a ${platform} ad for Safari Zetu targeting "${audience_segment}" travelers.

${focus_interest ? `Focus on their interest: ${focus_interest}` : ''}

The ad should:
- Speak to their specific travel desires
- Use psychology that works for this segment
- Feel like a memory, not an ad
- Stop the scroll with specificity, not superlatives

Return JSON: { "body": "...", "cta": "...", "psychology_used": [...] }`

  try {
    const result = await callAgent({
      agentName: 'ad_writer',
      division: 'growth',
      model: 'heavy',
      systemPrompt: `You create ${platform} ads for Safari Zetu that don't feel like ads. You write the kind of content people actually stop scrolling for.

Audience psychology for "${audience_segment}":
- What they value: ${getAudienceValues(audience_segment)}
- What triggers them: ${getAudienceTriggers(audience_segment)}
- What turns them off: generic safari photos, "book now", superlatives`,
      userMessage: prompt,
      triggerType: 'personalized_ad',
      triggerPayload: { segment: audience_segment, platform },
      maxTokens: 500
    })

    const text = result.content
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        person_id: `segment-${audience_segment}`,
        channel: 'ad',
        body: parsed.body,
        cta: parsed.cta,
        psychology_used: parsed.psychology_used || [],
        personalization_tokens: [audience_segment],
        confidence: 0.7
      }
    }

    return {
      person_id: `segment-${audience_segment}`,
      channel: 'ad',
      body: getDefaultAdBody(audience_segment),
      cta: 'Learn more',
      psychology_used: ['aspiration', 'storytelling'],
      personalization_tokens: [audience_segment],
      confidence: 0.5
    }
  } catch {
    return {
      person_id: `segment-${audience_segment}`,
      channel: 'ad',
      body: getDefaultAdBody(audience_segment),
      cta: 'Learn more',
      psychology_used: [],
      personalization_tokens: [],
      confidence: 0.3
    }
  }
}

// ── BATCH PERSONALIZE ──────────────────────────────────────────
// Generate personalized content for multiple people at once
export async function batchPersonalize(
  emails: string[],
  purpose: string,
  context?: string
): Promise<PersonalizedContent[]> {
  const results: PersonalizedContent[] = []

  for (const email of emails) {
    const profile = await buildPersonProfile(email)
    if (profile) {
      const content = await generatePersonalizedEmail(profile, purpose, context)
      results.push(content)
    }
  }

  logger.info(`Batch personalized ${results.length} emails for purpose: ${purpose}`)
  return results
}

// ── HELPERS ────────────────────────────────────────────────────
async function enrichFromApollo(email: string): Promise<{ name?: string; company?: string; role?: string; location?: string } | null> {
  // Apollo enrichment would go here
  return null
}

async function saveProfile(profile: PersonProfile): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO person_profiles (id, email, name, company, role, location, interests, engagement_level, preferred_tone, preferred_memory_type, psychological_triggers, travel_style, interaction_count, last_interaction)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name,
         interests = EXCLUDED.interests,
         engagement_level = EXCLUDED.engagement_level,
         preferred_tone = EXCLUDED.preferred_tone,
         preferred_memory_type = EXCLUDED.preferred_memory_type,
         psychological_triggers = EXCLUDED.psychological_triggers,
         travel_style = EXCLUDED.travel_style,
         interaction_count = EXCLUDED.interaction_count,
         last_interaction = EXCLUDED.last_interaction`,
      [profile.id, profile.email, profile.name, profile.company, profile.role, profile.location,
       JSON.stringify(profile.interests), profile.engagement_level, profile.preferred_tone,
       profile.preferred_memory_type, JSON.stringify(profile.psychological_triggers),
       profile.travel_style, profile.interaction_count, profile.last_interaction]
    )
  } catch (e: any) {
    logger.error(`Failed to save profile: ${e.message}`)
  }
}

function extractPersonalizationTokens(text: string, profile: PersonProfile): string[] {
  const tokens: string[] = []
  if (profile.name && text.includes(profile.name)) tokens.push('name')
  for (const interest of profile.interests) {
    if (text.toLowerCase().includes(interest.toLowerCase())) tokens.push(`interest:${interest}`)
  }
  if (profile.company && text.includes(profile.company)) tokens.push('company')
  return tokens
}

function calculateConfidence(profile: PersonProfile): number {
  let confidence = 0.3 // Base
  if (profile.name) confidence += 0.1
  if (profile.interests.length > 0) confidence += 0.15
  if (profile.interaction_count > 5) confidence += 0.15
  if (profile.psychological_triggers.length > 0) confidence += 0.1
  if (profile.engagement_level === 'hot') confidence += 0.1
  return Math.min(confidence, 0.95)
}

function getAudienceValues(segment: string): string {
  const values: Record<string, string> = {
    luxury: 'exclusivity, craftsmanship, attention to detail, privacy',
    adventure: 'discovery, challenge, authentic experiences, adrenaline',
    family: 'safety, convenience, bonding, education',
    honeymoon: 'romance, privacy, once-in-a-lifetime, luxury',
    solo: 'freedom, self-discovery, safety, community',
    corporate: 'team building, unique venues, productivity, prestige'
  }
  return values[segment] || 'authentic experiences, value, quality'
}

function getAudienceTriggers(segment: string): string {
  const triggers: Record<string, string> = {
    luxury: 'exclusivity, craftsmanship, personalization',
    adventure: 'novelty, challenge, authentic local experiences',
    family: 'safety, convenience, educational value',
    honeymoon: 'romance, uniqueness, privacy',
    solo: 'freedom, self-growth, community',
    corporate: 'ROI, unique experiences, team bonding'
  }
  return triggers[segment] || 'authenticity, value'
}

function getDefaultAdBody(segment: string): string {
  const bodies: Record<string, string> = {
    luxury: 'This isn\'t a safari. It\'s the version of Africa that most people never see. Private guides. Empty landscapes. A pace that lets you actually feel it.',
    adventure: 'You\'ve seen the photos. Now imagine being there — the dust on your boots, the silence before dawn, the moment the bush wakes up.',
    family: 'Some trips you take. Some trips become the stories your kids tell their kids. This is the second kind.',
    honeymoon: 'You\'re planning the trip that starts your story together. Make it the one you\'ll still be talking about in 50 years.',
    solo: 'You don\'t need a group to see Africa. You need a guide, a plan, and the willingness to be surprised.',
    corporate: 'Your team doesn\'t need another conference room. They need a night under the stars and a challenge that brings them together.'
  }
  return bodies[segment] || 'Some places change how you see the world. This is one of them.'
}
