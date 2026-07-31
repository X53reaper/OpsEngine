import { logger, pool } from '../services/ai-agent.service'
import { analyzeImage, ImageAnalysis } from '../services/image-analysis.service'
import { pickFreshVariation, logPostToHistory, getDiversityReport } from '../services/content-diversity.engine'
import { generateMemoryCaption, CONTENT_PSYCHOLOGY, getResearchDomains } from '../services/neuroscience-research.service'
import { createPost, isBufferConfigured } from '../services/buffer.service'

// ── MEMORY STORYTELLING PIPELINE ───────────────────────────────
// Upload → Analyze → Create Memory Story → Approve → Post
//
// This is NOT a marketing pipeline. It's a memory pipeline.
// Every post feels like a memory someone is telling a friend.

interface MemoryDraft {
  id: string
  image_url: string
  image_analysis: ImageAnalysis
  platform: string
  caption: string
  psychology_used: string[]
  memory_type: string
  status: 'pending_approval' | 'approved' | 'published' | 'rejected'
  created_at: Date
}

interface MemoryPipelineResult {
  total_images: number
  drafts_created: number
  platforms: string[]
  memory_types: string[]
  psychology_applied: string[]
  diversity_report: string
}

// ── PROCESS IMAGES INTO MEMORY STORIES ─────────────────────────
export async function processImagesIntoMemories(
  imageUrls: string[],
  platforms: string[] = ['instagram', 'facebook', 'tiktok', 'linkedin']
): Promise<MemoryPipelineResult> {
  logger.info(`Processing ${imageUrls.length} images into memory stories for ${platforms.length} platforms`)

  const allDrafts: MemoryDraft[] = []
  const allPsychology: string[] = []
  const allMemoryTypes: string[] = []

  for (const imageUrl of imageUrls) {
    // Step 1: Analyze the image
    const analysis = await analyzeImage(imageUrl)

    // Step 2: Generate memory-based caption for each platform
    for (const platform of platforms) {
      const { caption, psychology_used, memory_type } = await generateMemoryCaption(analysis, platform)

      allPsychology.push(...psychology_used)
      allMemoryTypes.push(memory_type)

      const draft: MemoryDraft = {
        id: `mem-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        image_url: imageUrl,
        image_analysis: analysis,
        platform,
        caption,
        psychology_used,
        memory_type,
        status: 'pending_approval',
        created_at: new Date()
      }

      allDrafts.push(draft)

      // Step 3: Save to approval queue
      await saveMemoryToQueue(draft)
    }

    // Step 4: Log for diversity tracking
    await logPostToHistory({
      format: analysis.best_format,
      tone: analysis.emotional_appeal,
      topic: analysis.animals.length > 0 ? 'wildlife' : 'landscape',
      emotional_appeal: analysis.emotional_appeal,
      platform: platforms[0],
      subject: analysis.subject
    })
  }

  // Step 5: Get diversity report
  const diversity = await getDiversityReport()

  const uniquePsychology = [...new Set(allPsychology)]
  const uniqueMemoryTypes = [...new Set(allMemoryTypes)]

  logger.info(`Memory pipeline complete: ${allDrafts.length} stories, ${uniquePsychology.length} psychology principles applied, ${uniqueMemoryTypes.length} memory types used`)

  return {
    total_images: imageUrls.length,
    drafts_created: allDrafts.length,
    platforms,
    memory_types: uniqueMemoryTypes,
    psychology_applied: uniquePsychology,
    diversity_report: diversity.recommendation
  }
}

// ── SAVE MEMORY STORY TO QUEUE ─────────────────────────────────
async function saveMemoryToQueue(draft: MemoryDraft): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO approval_queue (item_type, reference_id, title, preview, full_content, priority, status)
       VALUES ('memory_story', $1, $2, $3, $4, 'normal', 'pending')`,
      [
        draft.id,
        `${draft.memory_type} | ${draft.platform.toUpperCase()}: ${draft.image_analysis.subject}`,
        draft.caption.substring(0, 200),
        JSON.stringify({
          image_url: draft.image_url,
          platform: draft.platform,
          caption: draft.caption,
          psychology_used: draft.psychology_used,
          memory_type: draft.memory_type,
          analysis: {
            subject: draft.image_analysis.subject,
            mood: draft.image_analysis.mood,
            location: draft.image_analysis.location_guess,
            quality: draft.image_analysis.quality_score
          }
        })
      ]
    )
  } catch (e: any) {
    logger.error(`Failed to save memory to queue: ${e.message}`)
  }
}

// ── APPROVE MEMORY STORY → AUTO-POST ───────────────────────────
export async function approveMemoryStory(draftId: string): Promise<{
  success: boolean
  posted_to: string[]
  memory_type: string
  psychology_used: string[]
}> {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM approval_queue WHERE id = $1 AND status = 'approved'`,
      [draftId]
    )

    if (rows.length === 0) {
      return { success: false, posted_to: [], memory_type: '', psychology_used: [] }
    }

    const item = rows[0]
    const content = JSON.parse(item.full_content)

    if (!isBufferConfigured()) {
      logger.warn('Buffer not configured — cannot auto-post')
      return { success: false, posted_to: [], memory_type: content.memory_type, psychology_used: content.psychology_used }
    }

    const result = await createPost({
      text: content.caption,
      media: content.image_url,
      channelIds: undefined
    })

    if (result.success) {
      await pool.query(
        `UPDATE approval_queue SET status = 'approved', reviewed_at = NOW() WHERE id = $1`,
        [draftId]
      )

      await pool.query(
        `INSERT INTO content_queue (content_type, topic, title, draft_content, status, published_at, keywords)
         VALUES ('memory_story', $1, $2, $3, 'published', NOW(), $4)`,
        [content.memory_type, content.caption.substring(0, 100), content.caption, content.psychology_used]
      )

      logger.info(`Approved and posted memory story: ${content.memory_type}`)
      return {
        success: true,
        posted_to: [content.platform],
        memory_type: content.memory_type,
        psychology_used: content.psychology_used
      }
    }

    return { success: false, posted_to: [], memory_type: content.memory_type, psychology_used: [] }
  } catch (e: any) {
    logger.error(`approveMemoryStory failed: ${e.message}`)
    return { success: false, posted_to: [], memory_type: '', psychology_used: [] }
  }
}

// ── GET PENDING MEMORY STORIES ─────────────────────────────────
export async function getPendingMemoryStories(): Promise<any[]> {
  const { rows } = await pool.query(
    `SELECT * FROM approval_queue WHERE status = 'pending' AND item_type = 'memory_story' ORDER BY created_at DESC`
  )
  return rows.map((r: any) => ({
    id: r.id,
    title: r.title,
    preview: r.preview,
    content: JSON.parse(r.full_content),
    priority: r.priority,
    created_at: r.created_at
  }))
}

// ── REJECT MEMORY STORY ────────────────────────────────────────
export async function rejectMemoryStory(draftId: string, reason?: string): Promise<void> {
  await pool.query(
    `UPDATE approval_queue SET status = 'rejected', reviewer_notes = $1 WHERE id = $2`,
    [reason || 'Rejected by founder', draftId]
  )
  logger.info(`Rejected memory story ${draftId}: ${reason}`)
}

// ── RESEARCH TRAVEL PSYCHOLOGY ON DEMAND ───────────────────────
// Agent researches a specific topic and returns insights
export async function researchOnDemand(topic: string): Promise<{
  insight: string
  application: string
  content_angle: string
  principles: string[]
  domains: string[]
}> {
    // Import here to avoid circular dependency
  const { researchTravelPsychology } = await import('../services/neuroscience-research.service')
  
  const result = await researchTravelPsychology(topic)
  
  const domains: string[] = []
  if (result.psychology_principles.some((p: string) => ['dopamine', 'amygdala', 'peak.end', 'default mode', 'neural replay'].includes(p))) domains.push('Neuroscience')
  if (result.psychology_principles.some((p: string) => ['sublime', 'homo viator', 'examined life'].includes(p))) domains.push('Philosophy')
  if (result.psychology_principles.some((p: string) => ['narrative transportation', 'embodied cognition', 'loss aversion', 'IKEA effect', 'self.actualization'].includes(p))) domains.push('Psychology')

  return {
    insight: result.insight,
    application: result.application,
    content_angle: result.content_angle,
    principles: result.psychology_principles,
    domains
  }
}
