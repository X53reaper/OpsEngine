import { logger } from './ai-agent.service'

// ── BUFFER — Social Media Management (GraphQL API) ─────────────
// Post to Instagram, Facebook, TikTok, LinkedIn from one API
// Schedule content, track engagement, manage replies
// Docs: https://developers.buffer.com

const BUFFER_TOKEN = process.env.BUFFER_ACCESS_TOKEN || ''
const BUFFER_ORG_ID = process.env.BUFFER_ORG_ID || ''
const BUFFER_API = 'https://api.buffer.com'

export function isBufferConfigured(): boolean {
  return !!(BUFFER_TOKEN && BUFFER_ORG_ID)
}

interface BufferChannel {
  id: string
  service: string
  name: string
}

interface PostResult {
  success: boolean
  postId?: string
  status?: string
  error?: string
}

// ── GRAPHQL HELPER ─────────────────────────────────────────────
async function bufferQuery(query: string, variables?: Record<string, any>): Promise<any> {
  if (!isBufferConfigured()) throw new Error('Buffer not configured')

  const res = await fetch(BUFFER_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${BUFFER_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15000)
  })

  if (!res.ok) throw new Error(`Buffer API ${res.status}`)
  const data = await res.json() as any
  if (data.errors?.length) throw new Error(`Buffer GraphQL: ${data.errors[0].message}`)
  return data.data
}

// ── GET CONNECTED CHANNELS ─────────────────────────────────────
export async function getChannels(): Promise<BufferChannel[]> {
  try {
    const data = await bufferQuery(
      `{ channels(input: { organizationId: "${BUFFER_ORG_ID}" }) { id service name } }`
    )
    return data?.channels || []
  } catch (e: any) {
    logger.error(`Buffer getChannels failed: ${e.message}`)
    return []
  }
}

// ── CREATE A POST ──────────────────────────────────────────────
export async function createPost(options: {
  text: string
  channelIds?: string[]     // Post to specific channels, or all
  media?: string            // Image URL (must be publicly accessible)
  link?: string
  now?: boolean             // Post immediately instead of queueing
}): Promise<PostResult> {
  if (!isBufferConfigured()) {
    return { success: false, error: 'Buffer not configured' }
  }

  const channels = options.channelIds || (await getChannels()).map(c => c.id)
  if (channels.length === 0) {
    return { success: false, error: 'No channels connected' }
  }

  try {
    const input: any = {
      channelIds: channels,
      text: options.text
    }
    if (options.media) input.media = { photo: options.media }
    if (options.link) input.link = options.link

    const data = await bufferQuery(
      `mutation CreatePost($input: CreatePostInput!) {
        createPost(input: $input) {
          post { id status }
        }
      }`,
      { input }
    )

    const post = data?.createPost?.post
    if (post) {
      logger.info(`Buffer: Created post ${post.id} on ${channels.length} channels`)
      return { success: true, postId: post.id, status: post.status }
    }

    return { success: false, error: 'No post returned' }
  } catch (e: any) {
    logger.error(`Buffer createPost failed: ${e.message}`)
    return { success: false, error: e.message }
  }
}

// ── POST TO ALL PLATFORMS ──────────────────────────────────────
export async function postToAllPlatforms(content: {
  caption: string
  image?: string
  link?: string
}): Promise<{ posted: string[]; failed: string[] }> {
  const channels = await getChannels()
  const posted: string[] = []
  const failed: string[] = []

  for (const ch of channels) {
    const result = await createPost({
      text: content.caption,
      channelIds: [ch.id],
      media: content.image,
      link: content.link
    })
    if (result.success) posted.push(ch.service)
    else failed.push(ch.service)
  }

  logger.info(`Buffer: Posted to ${posted.length}/${channels.length} platforms`)
  return { posted, failed }
}

// ── SCHEDULE POST ──────────────────────────────────────────────
export async function schedulePost(options: {
  text: string
  channelIds?: string[]
  media?: string
  link?: string
  scheduledAt: Date          // When to post
}): Promise<PostResult> {
  if (!isBufferConfigured()) {
    return { success: false, error: 'Buffer not configured' }
  }

  const channels = options.channelIds || (await getChannels()).map(c => c.id)

  try {
    const input: any = {
      channelIds: channels,
      text: options.text,
      scheduledAt: options.scheduledAt.toISOString()
    }
    if (options.media) input.media = { photo: options.media }
    if (options.link) input.link = options.link

    const data = await bufferQuery(
      `mutation SchedulePost($input: SchedulePostInput!) {
        schedulePost(input: $input) {
          post { id status scheduledAt }
        }
      }`,
      { input }
    )

    const post = data?.schedulePost?.post
    if (post) {
      logger.info(`Buffer: Scheduled post ${post.id} for ${options.scheduledAt.toISOString()}`)
      return { success: true, postId: post.id, status: post.status }
    }

    return { success: false, error: 'No post returned' }
  } catch (e: any) {
    logger.error(`Buffer schedulePost failed: ${e.message}`)
    return { success: false, error: e.message }
  }
}

// ── GET POSTS (with metrics) ───────────────────────────────────
export async function getPosts(channelId: string, count: number = 10): Promise<any[]> {
  try {
    const data = await bufferQuery(
      `{ posts(input: { channelIds: ["${channelId}"], count: ${count} }) {
          edges {
            node {
              id text status createdAt sentAt
              metrics { reach impressions likes comments shares }
            }
          }
        }
      }`
    )
    return data?.posts?.edges?.map((e: any) => e.node) || []
  } catch (e: any) {
    logger.error(`Buffer getPosts failed: ${e.message}`)
    return []
  }
}

// ── GET ENGAGEMENT SUMMARY ─────────────────────────────────────
export async function getEngagementSummary(): Promise<{
  total_posts: number
  total_reach: number
  total_engagement: number
  by_platform: Record<string, { posts: number; engagement: number }>
}> {
  const channels = await getChannels()
  const summary = { total_posts: 0, total_reach: 0, total_engagement: 0, by_platform: {} as any }

  for (const ch of channels) {
    const posts = await getPosts(ch.id, 20)
    let engagement = 0
    for (const post of posts) {
      summary.total_reach += post.metrics?.reach || 0
      engagement += (post.metrics?.likes || 0) + (post.metrics?.comments || 0) + (post.metrics?.shares || 0)
    }
    summary.total_posts += posts.length
    summary.total_engagement += engagement
    summary.by_platform[ch.service] = { posts: posts.length, engagement }
  }

  return summary
}

// ── SAFARI CONTENT IDEAS ───────────────────────────────────────
export function getSafariContentIdeas(): Array<{ type: string; caption: string; image?: string }> {
  return [
    { type: 'photo', caption: '🌅 Morning game drive in Hwange — elephants at the waterhole. Book your safari at safarizetu.com' },
    { type: 'reel', caption: '🦁 Close encounter at Mana Pools. Would you brave this? #SafariZetu #ZimbabweSafari' },
    { type: 'carousel', caption: '5 animals you MUST see on your first African safari 🦏🐘🐃🐆🦁 — save this!' },
    { type: 'reel', caption: 'Sunset over Lake Kariba — this is why you safari. safarizetu.com' },
    { type: 'photo', caption: 'Victoria Falls from the air — the smoke that thunders.' },
    { type: 'carousel', caption: 'What to pack for a safari: The complete checklist ✅' },
    { type: 'text', caption: 'Did you know? Zimbabwe has 1,199 verified safari operators across 47 destinations.' },
    { type: 'reel', caption: 'The sound of Africa 🎧 Turn your volume up. #WildSounds #SafariLife' },
    { type: 'photo', caption: 'Meet your guide: Patrick has led 500+ safaris in Hwange.' },
    { type: 'story', caption: 'Quick poll: Luxury lodge or camping safari? Vote now!' },
  ]
}
