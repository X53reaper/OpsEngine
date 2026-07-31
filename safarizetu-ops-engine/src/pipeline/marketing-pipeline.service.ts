import { logger, pool } from '../services/ai-agent.service'
import { callAgent } from '../services/ai-agent.service'
import { analyzeImage, ImageAnalysis } from '../services/image-analysis.service'
import { pickFreshVariation, buildCaptionPrompt, logPostToHistory, getDiversityReport } from '../services/content-diversity.engine'
import { createPost, postToAllPlatforms, isBufferConfigured } from '../services/buffer.service'

// ── MARKETING CONTENT PIPELINE ─────────────────────────────────
// Upload → Analyze → Create → Approve → Post
// Each step is independent, no repetition, maximum excitement

interface PipelineImage {
  url: string
  filename: string
  uploaded_at: Date
}

interface ContentDraft {
  id: string
  image_url: string
  image_analysis: ImageAnalysis
  platform: string
  caption: string
  hashtags: string[]
  status: 'draft' | 'pending_approval' | 'approved' | 'published' | 'rejected'
  created_at: Date
}

interface PipelineResult {
  total_images: number
  drafts_created: number
  platforms: string[]
  diversity_report: string
  approval_queue_size: number
}

// ── PROCESS UPLOADED IMAGES ────────────────────────────────────
// Main pipeline: images → analyzed content drafts → approval queue
export async function processUploadedImages(
  imageUrls: string[],
  platforms: string[] = ['instagram', 'facebook', 'tiktok', 'linkedin']
): Promise<PipelineResult> {
  logger.info(`Processing ${imageUrls.length} uploaded images for ${platforms.length} platforms`)

  const allDrafts: ContentDraft[] = []

  for (const imageUrl of imageUrls) {
    // Step 1: Analyze the image with Gemini Vision
    const analysis = await analyzeImage(imageUrl)

    // Step 2: Pick fresh content variation (no repetition)
    const variation = await pickFreshVariation()

    // Step 3: Generate caption for each platform
    for (const platform of platforms) {
      const caption = await generateCaption(analysis, variation, platform)

      const draft: ContentDraft = {
        id: `draft-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        image_url: imageUrl,
        image_analysis: analysis,
        platform,
        caption: caption.text,
        hashtags: caption.hashtags,
        status: 'pending_approval',
        created_at: new Date()
      }

      allDrafts.push(draft)

      // Step 4: Save to approval queue
      await saveToApprovalQueue(draft)
    }

    // Step 5: Log to history for diversity tracking
    await logPostToHistory({
      format: variation.format,
      tone: variation.tone,
      topic: variation.topic,
      emotional_appeal: variation.emotional_appeal,
      platform: platforms[0],
      subject: analysis.subject
    })
  }

  // Step 6: Get diversity report
  const diversity = await getDiversityReport()

  logger.info(`Pipeline complete: ${allDrafts.length} drafts created from ${imageUrls.length} images`)

  return {
    total_images: imageUrls.length,
    drafts_created: allDrafts.length,
    platforms,
    diversity_report: diversity.recommendation,
    approval_queue_size: allDrafts.length
  }
}

// ── GENERATE CAPTION (via LLM) ─────────────────────────────────
async function generateCaption(
  analysis: ImageAnalysis,
  variation: { format: string; tone: string; topic: string; emotional_appeal: string; call_to_action: string },
  platform: string
): Promise<{ text: string; hashtags: string[] }> {
  const prompt = buildCaptionPrompt(analysis, variation, platform)

  try {
    const result = await callAgent({
      agentName: 'marketing_content',
      division: 'growth',
      model: 'light',
      systemPrompt: 'You are the Safari Zetu social media manager. You write captions that stop the scroll. Every caption must feel like it was written by a human who was actually there — not a marketing bot.',
      userMessage: prompt,
      triggerType: 'content_generation',
      triggerPayload: { image: analysis.subject, platform, tone: variation.tone },
      maxTokens: 500
    })

    const text = result.content.trim()
    // Extract hashtags from the caption
    const hashtagMatch = text.match(/#\w+/g)
    const hashtags = hashtagMatch || analysis.suggested_hashtags.slice(0, 8)

    return { text, hashtags }
  } catch (e: any) {
    logger.error(`Caption generation failed: ${e.message}`)
    return {
      text: `${analysis.subject} — ${analysis.mood}. ${variation.call_to_action} #SafariZetu #ZimbabweSafari`,
      hashtags: analysis.suggested_hashtags.slice(0, 8)
    }
  }
}

// ── SAVE TO APPROVAL QUEUE ─────────────────────────────────────
async function saveToApprovalQueue(draft: ContentDraft): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO approval_queue (item_type, reference_id, title, preview, full_content, priority, status)
       VALUES ('content', $1, $2, $3, $4, 'normal', 'pending')`,
      [
        draft.id,
        `${draft.platform.toUpperCase()}: ${draft.image_analysis.subject}`,
        draft.caption.substring(0, 200),
        JSON.stringify({
          image_url: draft.image_url,
          platform: draft.platform,
          caption: draft.caption,
          hashtags: draft.hashtags,
          analysis: {
            subject: draft.image_analysis.subject,
            mood: draft.image_analysis.mood,
            quality: draft.image_analysis.quality_score
          }
        })
      ]
    )
  } catch (e: any) {
    logger.error(`Failed to save to approval queue: ${e.message}`)
  }
}

// ── APPROVE AND POST ───────────────────────────────────────────
// Called when founder approves a draft → auto-posts via Buffer
export async function approveAndPost(draftId: string): Promise<{ success: boolean; posted_to: string[] }> {
  try {
    // Get the draft from approval queue
    const { rows } = await pool.query(
      `SELECT * FROM approval_queue WHERE id = $1 AND status = 'approved'`,
      [draftId]
    )

    if (rows.length === 0) {
      return { success: false, posted_to: [] }
    }

    const item = rows[0]
    const content = JSON.parse(item.full_content)

    if (!isBufferConfigured()) {
      logger.warn('Buffer not configured — cannot auto-post')
      return { success: false, posted_to: [] }
    }

    // Post via Buffer
    const result = await createPost({
      text: content.caption,
      media: content.image_url,
      channelIds: undefined // Post to all connected channels
    })

    if (result.success) {
      // Update status in approval queue
      await pool.query(
        `UPDATE approval_queue SET status = 'approved', reviewed_at = NOW() WHERE id = $1`,
        [draftId]
      )

      // Log to content queue as published
      await pool.query(
        `INSERT INTO content_queue (content_type, topic, title, draft_content, status, published_at)
         VALUES ('social_post', $1, $2, $3, 'published', NOW())`,
        [content.platform, content.caption.substring(0, 100), content.caption]
      )

      logger.info(`Approved and posted ${draftId} to Buffer`)
      return { success: true, posted_to: [content.platform] }
    }

    return { success: false, posted_to: [] }
  } catch (e: any) {
    logger.error(`approveAndPost failed: ${e.message}`)
    return { success: false, posted_to: [] }
  }
}

// ── APPROVE ALL PENDING ────────────────────────────────────────
export async function approveAllPending(): Promise<{ approved: number; posted: number }> {
  const { rows } = await pool.query(
    `SELECT id FROM approval_queue WHERE status = 'pending' AND item_type = 'content'`
  )

  let approved = 0
  let posted = 0

  for (const row of rows) {
    // Mark as approved
    await pool.query(
      `UPDATE approval_queue SET status = 'approved', reviewed_at = NOW() WHERE id = $1`,
      [row.id]
    )
    approved++

    // Post
    const result = await approveAndPost(row.id)
    if (result.success) posted++
  }

  logger.info(`Bulk approve: ${approved} approved, ${posted} posted`)
  return { approved, posted }
}

// ── REJECT DRAFT ───────────────────────────────────────────────
export async function rejectDraft(draftId: string, reason?: string): Promise<void> {
  await pool.query(
    `UPDATE approval_queue SET status = 'rejected', reviewer_notes = $1 WHERE id = $2`,
    [reason || 'Rejected by founder', draftId]
  )
  logger.info(`Rejected draft ${draftId}: ${reason}`)
}

// ── GET PENDING DRAFTS ─────────────────────────────────────────
export async function getPendingDrafts(): Promise<any[]> {
  const { rows } = await pool.query(
    `SELECT * FROM approval_queue WHERE status = 'pending' AND item_type = 'content' ORDER BY created_at DESC`
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
