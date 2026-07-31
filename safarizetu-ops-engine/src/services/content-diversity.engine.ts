import { logger, pool } from './ai-agent.service'

// ── CONTENT DIVERSITY ENGINE ───────────────────────────────────
// Ensures every post feels fresh — no two posts are the same
// Tracks history, varies format/tone/topic/style automatically

export interface PostHistory {
  id: string
  format: string              // "photo", "carousel", "reel", "story", "blog", "text"
  tone: string                // "inspiring", "educational", "funny", "adventurous", "emotional", "urgent"
  topic: string               // "wildlife", "landscape", "culture", "food", "accommodation", "adventure"
  emotional_appeal: string    // "wonder", "excitement", "peace", "nostalgia", "FOMO"
  platform: string            // "instagram", "facebook", "tiktok", "linkedin"
  subject: string             // "Elephant at waterhole"
  created_at: Date
}

// ── CONTENT VARIATIONS ─────────────────────────────────────────
const FORMATS = ['photo', 'carousel', 'reel', 'story', 'text', 'blog']
const TONES = [
  'inspiring',      // "Imagine waking up to this view..."
  'educational',    // "Did you know elephants can..."
  'funny',          // "When the leopard thinks it's hiding but..."
  'adventurous',    // "This is what 5am looks like in Hwange..."
  'emotional',      // "Some moments change you forever..."
  'urgent',         // "Only 3 spots left for December..."
  'mysterious',     // "Not everything in Africa is what it seems..."
  'nostalgic',      // "Remember when travel was an adventure..."
  'bold',           // "Forget the office. THIS is living."
  'playful'         // "POV: You just saw your first lion 🦁"
]
const TOPICS = [
  'wildlife', 'landscape', 'culture', 'food', 'accommodation',
  'adventure', 'people', 'conservation', 'history', 'nightlife'
]
const EMOTIONAL_APPEALS = [
  'wonder', 'excitement', 'peace', 'nostalgia', 'FOMO',
  'curiosity', 'belonging', 'freedom', 'achievement', 'connection'
]
const CALLS_TO_ACTION = [
  'Book your safari → link in bio',
  'Tag someone who needs this 🌍',
  'Save this for your bucket list ✨',
  'Would you go? Comment below 👇',
  'DM us "SAFARI" to start planning',
  'Link in bio for exclusive rates',
  'Share this with your travel buddy',
  'Follow @safarizetu for more',
  'Double-tap if this is your dream 🦁',
  'What animal do you want to see most?'
]

// ── GET RECENT POST HISTORY ────────────────────────────────────
async function getRecentHistory(count: number = 30): Promise<PostHistory[]> {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM content_queue 
       WHERE status IN ('approved', 'published') 
       ORDER BY created_at DESC 
       LIMIT $1`,
      [count]
    )
    return rows.map((r: any) => ({
      id: r.id,
      format: r.content_type || 'photo',
      tone: r.keywords?.[0] || 'inspiring',
      topic: r.keywords?.[1] || 'wildlife',
      emotional_appeal: r.keywords?.[2] || 'wonder',
      platform: r.keywords?.[3] || 'instagram',
      subject: r.title || '',
      created_at: r.created_at
    }))
  } catch {
    return [] // DB not available, skip diversity checks
  }
}

// ── PICK FRESH VARIATION ───────────────────────────────────────
// Ensures the new post is DIFFERENT from recent ones
export async function pickFreshVariation(recentCount: number = 10): Promise<{
  format: string
  tone: string
  topic: string
  emotional_appeal: string
  call_to_action: string
  reasoning: string
}> {
  const history = await getRecentHistory(recentCount)

  // What was used recently?
  const recentFormats = history.map(h => h.format)
  const recentTones = history.map(h => h.tone)
  const recentTopics = history.map(h => h.topic)
  const recentEmotions = history.map(h => h.emotional_appeal)

  // Score each option by how long since it was last used
  const pickLeastUsed = (options: string[], recent: string[]): string => {
    const scores = options.map(opt => {
      const lastIndex = recent.lastIndexOf(opt)
      return { option: opt, score: lastIndex === -1 ? 100 : recent.length - lastIndex }
    })
    // Add randomness: weight by score but allow surprise
    const totalScore = scores.reduce((sum, s) => sum + s.score, 0)
    let random = Math.random() * totalScore
    for (const s of scores) {
      random -= s.score
      if (random <= 0) return s.option
    }
    return scores[0].option
  }

  const format = pickLeastUsed(FORMATS, recentFormats)
  const tone = pickLeastUsed(TONES, recentTones)
  const topic = pickLeastUsed(TOPICS, recentTopics)
  const emotional_appeal = pickLeastUsed(EMOTIONAL_APPEALS, recentEmotions)
  const call_to_action = CALLS_TO_ACTION[Math.floor(Math.random() * CALLS_TO_ACTION.length)]

  // Ensure no format repetition in last 3 posts
  const last3Formats = history.slice(0, 3).map((h: any) => h.format)
  let finalFormat = format
  if (last3Formats.filter((f: string) => f === format).length >= 2) {
    const remaining = FORMATS.filter((f: string) => !last3Formats.includes(f))
    finalFormat = remaining.length > 0 ? remaining[0] : FORMATS[Math.floor(Math.random() * FORMATS.length)]
  }

  const reasoning = `Last ${history.length} posts used: ${[...new Set(recentFormats)].join(', ')} formats. Selected ${finalFormat} (not used in last ${recentFormats.indexOf(finalFormat) === -1 ? '10+' : recentFormats.length - recentFormats.indexOf(finalFormat)} posts). Tone: ${tone} (last used: ${recentTones.indexOf(tone) === -1 ? 'never' : `${recentTones.indexOf(tone)} posts ago`}).`

  return { format: finalFormat, tone, topic, emotional_appeal, call_to_action, reasoning }
}

// ── GENERATE CAPTION PROMPT ────────────────────────────────────
// Creates a unique, non-repetitive caption for each image
export function buildCaptionPrompt(imageAnalysis: {
  subject: string
  animals: string[]
  landscape: string
  mood: string
  location_guess: string
  storytelling_angle: string
  emotional_appeal: string
}, variation: {
  format: string
  tone: string
  topic: string
  emotional_appeal: string
  call_to_action: string
}, platform: string): string {
  const platformRules: Record<string, string> = {
    instagram: 'Max 300 characters. Lead with emotion. Use line breaks. 8-15 hashtags at the end.',
    facebook: 'Longer storytelling allowed. Ask a question to drive comments. 1-3 hashtags max.',
    tiktok: 'Short, punchy, hook in first 3 words. Use trending language. 3-5 hashtags.',
    linkedin: 'Professional tone. Tell a business story. No hashtags in first 2 lines. 3-5 hashtags at end.',
    twitter: 'Max 280 characters. Bold statement or question. 1-2 hashtags.'
  }

  return `Write a ${platform} post for Safari Zetu (Zimbabwe safari marketplace).

IMAGE ANALYSIS:
- Subject: ${imageAnalysis.subject}
- Animals: ${imageAnalysis.animals.join(', ') || 'none visible'}
- Landscape: ${imageAnalysis.landscape}
- Mood: ${imageAnalysis.mood}
- Location: ${imageAnalysis.location_guess}
- Story angle: ${imageAnalysis.storytelling_angle}

CONTENT RULES:
- Tone: ${variation.tone} (be genuinely ${variation.tone}, don't be generic)
- Topic: ${variation.topic}
- Emotional appeal: ${variation.emotional_appeal}
- Call to action: ${variation.call_to_action}

PLATFORM RULES: ${platformRules[platform] || platformRules.instagram}

CRITICAL DIVERSITY RULES:
- DO NOT start with "🌅" or "🦁" or any emoji as the first character
- DO NOT use "Discover the magic of..." or "Experience the..." 
- DO NOT use "Tag someone who..." (overused)
- DO NOT use "Book now" or "Visit our website"
- DO NOT sound like every other safari account
- BE SPECIFIC to THIS image and THIS moment
- Tell a STORY, don't just describe
- Make someone FEEL something

Return ONLY the caption text, nothing else.`
}

// ── LOG POST TO HISTORY ────────────────────────────────────────
export async function logPostToHistory(post: {
  format: string
  tone: string
  topic: string
  emotional_appeal: string
  platform: string
  subject: string
  contentId?: string
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO content_queue (content_type, topic, keywords, title, status, generated_at)
       VALUES ($1, $2, $3, $4, 'approved', NOW())`,
      [
        post.format,
        post.topic,
        [post.tone, post.topic, post.emotional_appeal, post.platform],
        post.subject
      ]
    )
  } catch { /* DB not available */ }
}

// ── GET DIVERSITY REPORT ───────────────────────────────────────
export async function getDiversityReport(): Promise<{
  total_posts: number
  format_breakdown: Record<string, number>
  tone_breakdown: Record<string, number>
  topic_breakdown: Record<string, number>
  last_posted: Record<string, string>
  recommendation: string
}> {
  const history = await getRecentHistory(50)

  const countBy = (field: keyof PostHistory) => {
    const counts: Record<string, number> = {}
    for (const h of history) {
      const val = String(h[field])
      counts[val] = (counts[val] || 0) + 1
    }
    return counts
  }

  const lastPosted: Record<string, string> = {}
  for (const h of history) {
    const key = `${h.format}:${h.tone}:${h.topic}`
    if (!lastPosted[key]) {
      lastPosted[key] = h.created_at.toISOString()
    }
  }

  const formatBreakdown = countBy('format')
  const mostUsedFormat = Object.entries(formatBreakdown).sort((a, b) => b[1] - a[1])[0]
  const recommendation = mostUsedFormat
    ? `Most used format is "${mostUsedFormat[0]}" (${mostUsedFormat[1]} times). Consider using ${FORMATS.find(f => f !== mostUsedFormat[0])} for variety.`
    : 'No posts yet — ready for fresh content!'

  return {
    total_posts: history.length,
    format_breakdown: formatBreakdown,
    tone_breakdown: countBy('tone'),
    topic_breakdown: countBy('topic'),
    last_posted: lastPosted,
    recommendation
  }
}
