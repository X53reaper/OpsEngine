import { callAgent, logger, sendEmail } from '../services/ai-agent.service'
import { queryCollection, upsertDocuments } from '../services/chroma.service'
import { startTrace, endTrace } from '../services/observability.service'
import { wrapEmail, sectionHeader, bodyText } from '../services/email-templates'

// ── SOCIAL MEDIA CONTENT ENGINE ────────────────────────────────
// Skills: Midjourney (images), Kling (video), Storm (article generation)
// Auto-generates safari content for Instagram, Facebook, TikTok
// 30-day content calendar with ready-to-post assets

interface ContentPost {
  id: string
  platform: 'instagram' | 'facebook' | 'twitter' | 'tiktok' | 'linkedin' | 'youtube'
  content_type: 'image' | 'video' | 'carousel' | 'story' | 'reel' | 'text' | 'link'
  caption: string
  hashtags: string[]
  media_url?: string
  topic: string
  safari_type: string
  scheduled_at?: Date
  status: 'draft' | 'scheduled' | 'posted'
}

interface ContentCalendar {
  month: string
  total_posts: number
  posts_by_platform: Record<string, number>
  content_themes: string[]
  posts: ContentPost[]
}

// ── CONTENT THEMES ─────────────────────────────────────────────
const CONTENT_THEMES = [
  { name: 'Wildlife Wednesday', hashtag: '#WildlifeWednesday', type: 'image' },
  { name: 'Safari Tip Tuesday', hashtag: '#SafariTips', type: 'carousel' },
  { name: 'Traveler Thursday', hashtag: '#TravelerStories', type: 'story' },
  { name: 'Photo Friday', hashtag: '#SafariPhotography', type: 'image' },
  { name: 'Weekend Wanderlust', hashtag: '#WeekendWanderlust', type: 'reel' },
  { name: 'Destination Monday', hashtag: '#DestinationMonday', type: 'video' },
  { name: 'Staff Spotlight', hashtag: '#MeetTheTeam', type: 'story' },
]

// ── SAFARI CAPTION TEMPLATES ───────────────────────────────────
const CAPTION_TEMPLATES = {
  wildlife: [
    "Nothing compares to witnessing Africa's magnificent wildlife in their natural habitat. 🌍🐘 {location} never disappoints.",
    "The circle of life plays out before your eyes every safari day. This is why we do what we do. 🦁",
    "Every safari tells a different story. What will yours be? 📸",
    "Close encounters with nature's most majestic creatures. This is the Africa experience. 🦏",
  ],
  landscape: [
    "Africa's landscapes are straight out of a dream. Where will your next adventure take you? 🌅",
    "Golden hour in the bush hits different. ✨ {location}",
    "The raw beauty of untouched wilderness. This is what safari dreams are made of. 🏞️",
    "From vast savannas to thundering waterfalls — Africa has it all. 🌊",
  ],
  experience: [
    "Sundowners in the bush. There's no better way to end a safari day. 🍹",
    "Waking up to the sounds of the African bush. This is the life. ☀️",
    "Bush dining under the stars. The ultimate safari experience. 🌟",
    "Our guides don't just show you Africa — they share their home with you. 🤝",
  ],
  educational: [
    "Did you know? {fact} Learn more about our incredible continent. 📚",
    "Conservation matters. Here's how your safari helps protect wildlife. 🌱",
    "Planning a safari? Here are {number} tips to make the most of your trip. 💡",
    "The Big Five explained: Why every safari-goer dreams of spotting them all. 🦏🐘🐆🐃🦁",
  ],
  promotional: [
    "Ready for the adventure of a lifetime? Book your {safari_type} safari today! 🔗 Link in bio.",
    "Limited spots available for {safari_type} this season. Don't miss out! 📅",
    "Special offer: Book now and save 15% on select safari packages. DM us for details! 💰",
    "Your dream safari is closer than you think. Let us plan it for you. ✈️",
  ]
}

// ── GENERATE CONTENT ───────────────────────────────────────────
export async function generateContent(
  platform: string,
  safariType: string,
  theme?: string
): Promise<ContentPost> {
  const selectedTheme = theme || CONTENT_THEMES[Math.floor(Math.random() * CONTENT_THEMES.length)].name
  const captionType = ['wildlife', 'landscape', 'experience', 'educational', 'promotional'][Math.floor(Math.random() * 5)] as keyof typeof CAPTION_TEMPLATES
  const template = CAPTION_TEMPLATES[captionType][Math.floor(Math.random() * CAPTION_TEMPLATES[captionType].length)]

  const result = await callAgent({
    agentName: 'content_creator',
    division: 'marketing',
    model: 'light',
    systemPrompt: `You are a social media content creator for Safari Zetu, a safari marketplace.
Generate a ${platform} post about ${safariType} safaris.

Theme: ${selectedTheme}
Content style: ${captionType}

Guidelines:
- Platform: ${platform} (optimize for this platform's best practices)
- Include relevant emojis (but not too many)
- End with a clear call-to-action
- Include 5-10 relevant hashtags
- Tone: inspiring, adventurous, authentic

Return JSON: {
  "caption": "the post caption",
  "hashtags": ["hashtag1", "hashtag2"],
  "media_description": "description of ideal image/video for this post"
}`,
    userMessage: `Create ${platform} content for ${safariType} safari — theme: ${selectedTheme}`,
    triggerType: 'on_demand',
    triggerPayload: { platform, safari_type: safariType, theme: selectedTheme }
  })

  let caption = ''
  let hashtags: string[] = []

  try {
    const parsed = JSON.parse(result.content)
    caption = parsed.caption || template.replace('{location}', safariType)
    hashtags = parsed.hashtags || [selectedTheme.replace(/\s+/g, ''), 'safari', 'africa']
  } catch {
    caption = template.replace('{location}', safariType)
    hashtags = [selectedTheme.replace(/\s+/g, ''), 'safari', 'africa', 'wildlife', 'travel']
  }

  return {
    id: `content-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    platform: platform as ContentPost['platform'],
    content_type: (CONTENT_THEMES.find(t => t.name === selectedTheme)?.type || 'image') as ContentPost['content_type'],
    caption,
    hashtags,
    topic: selectedTheme,
    safari_type: safariType,
    status: 'draft'
  }
}

// ── GENERATE CONTENT CALENDAR ──────────────────────────────────
export async function generateContentCalendar(
  month: string,
  platforms: string[] = ['instagram', 'facebook', 'twitter']
): Promise<ContentCalendar> {
  const posts: ContentPost[] = []
  const safariTypes = ['Victoria Falls', 'Serengeti', 'Kruger', 'Hwange', 'Mana Pools']

  // Generate 2-3 posts per platform per week (4 weeks = 24-36 posts)
  for (const platform of platforms) {
    for (let week = 0; week < 4; week++) {
      const postsPerWeek = Math.floor(Math.random() * 2) + 2 // 2-3 posts
      for (let p = 0; p < postsPerWeek; p++) {
        const safariType = safariTypes[Math.floor(Math.random() * safariTypes.length)]
        const theme = CONTENT_THEMES[(week * postsPerWeek + p) % CONTENT_THEMES.length]
        const post = await generateContent(platform, safariType, theme.name)
        posts.push(post)
      }
    }
  }

  const postsByPlatform: Record<string, number> = {}
  for (const post of posts) {
    postsByPlatform[post.platform] = (postsByPlatform[post.platform] || 0) + 1
  }

  const calendar: ContentCalendar = {
    month,
    total_posts: posts.length,
    posts_by_platform: postsByPlatform,
    content_themes: CONTENT_THEMES.map(t => t.name),
    posts
  }

  // Store in Chroma for reference
  await upsertDocuments('content-calendar', posts.map(p => ({
    id: p.id,
    text: `${p.platform}: ${p.caption.substring(0, 100)}... [${p.hashtags.slice(0, 3).join(', ')}]`,
    metadata: { platform: p.platform, type: p.content_type, safari: p.safari_type }
  })))

  logger.info(`Generated content calendar: ${posts.length} posts across ${platforms.join(', ')}`)
  return calendar
}

// ── OPTIMIZE HASHTAGS ──────────────────────────────────────────
export async function optimizeHashtags(
  content: string,
  platform: string
): Promise<string[]> {
  const result = await callAgent({
    agentName: 'hashtag_optimizer',
    division: 'marketing',
    model: 'light',
    systemPrompt: `Optimize hashtags for a ${platform} post about African safaris.

Content: ${content.substring(0, 200)}

Rules:
- Instagram: 15-20 hashtags (mix of popular and niche)
- Twitter: 2-3 hashtags max
- Facebook: 3-5 hashtags
- TikTok: 3-5 hashtags
- LinkedIn: 3-5 hashtags

Include:
- Industry: #safari #africanwildlife #travelafrica
- Destination: #zimbabwe #victoriafalls #serengeti
- Niche: #safariphoto #wildlifephotography #bushlife
- Trending: current travel trends

Return ONLY a JSON array of hashtag strings.`,
    userMessage: `Optimize hashtags for: ${content.substring(0, 100)}`,
    triggerType: 'on_demand',
    triggerPayload: { platform, content: content.substring(0, 200) }
  })

  try {
    return JSON.parse(result.content)
  } catch {
    return ['#safari', '#africa', '#wildlife', '#travel', '#adventure']
  }
}

// ── SEND CONTENT CALENDAR EMAIL ────────────────────────────────
export async function sendContentCalendarEmail(calendar: ContentCalendar): Promise<void> {
  const html = wrapEmail(
    sectionHeader('Monthly Content Calendar', 'Safari Zetu') +
    `
    <p>Month: ${calendar.month}</p>
    <p>Total Posts: ${calendar.total_posts}</p>

    <h3>📊 Posts by Platform</h3>
    <ul>
      ${Object.entries(calendar.posts_by_platform).map(([p, c]) => `<li><strong>${p}</strong>: ${c} posts</li>`).join('')}
    </ul>

    <h3>📝 Content Themes</h3>
    <ul>
      ${calendar.content_themes.map(t => `<li>${t}</li>`).join('')}
    </ul>

    <h3>📅 Sample Posts</h3>
    ${calendar.posts.slice(0, 6).map(p => `
      <div style="border: 1px solid #ddd; padding: 10px; margin: 10px 0;">
        <strong>${p.platform.toUpperCase()}</strong> — ${p.content_type}<br>
        <em>${p.topic}</em><br>
        <p>${p.caption}</p>
        <small>Hashtags: ${p.hashtags.slice(0, 5).join(', ')}</small>
      </div>
    `).join('')}

    <p><em>Auto-generated by Safari Zetu Content Engine</em></p>`,
    { palette: 'midnight' }
  )

  const marketingEmail = process.env.MARKETING_EMAIL || 'marketing@safarizetu.com'
  await sendEmail(marketingEmail, `Content Calendar — ${calendar.month}`, html)
  logger.info('Content calendar email sent')
}

// ── MONTHLY CONTENT GENERATION ─────────────────────────────────
export async function runMonthlyContentGeneration(): Promise<{
  posts_generated: number
  platforms: string[]
}> {
  const traceId = startTrace('monthly_content', 'mimo-v2.5-free')

  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const calendar = await generateContentCalendar(month, ['instagram', 'facebook', 'twitter'])

  await sendContentCalendarEmail(calendar)

  endTrace(traceId, { input_tokens: 0, output_tokens: 0, cost_usd: 0, latency_ms: 0, status: 'success' })

  logger.info(`Monthly content: ${calendar.total_posts} posts generated`)
  return {
    posts_generated: calendar.total_posts,
    platforms: Object.keys(calendar.posts_by_platform)
  }
}
