import dotenv from 'dotenv'
dotenv.config()

import { createServer } from 'http'
import { logger, isDbConnected, sendEmail, pool } from './services/ai-agent.service'
import { startScheduler } from './scheduler/cron'
import { startMailingScheduler } from './scheduler/mailing-cron'
import { loadSafariCatalog, loadPartnershipData } from './services/chroma.service'
import { getMetrics, generatePerformanceReport, initLangfuse, isLangfuseEnabled } from './services/observability.service'
import { handleWebhook } from './webhook/receiver'
import { processUploadedImages, getPendingDrafts, approveAndPost, approveAllPending, rejectDraft } from './pipeline/marketing-pipeline.service'
import { processImagesIntoMemories, getPendingMemoryStories, approveMemoryStory, rejectMemoryStory, researchOnDemand } from './pipeline/memory-storytelling.service'
import { getResearchDomains, getContentPrinciples } from './services/neuroscience-research.service'
import { recordEngagement, analyzePerformance, getLearningStatus } from './services/learning-engine.service'
import { scrapeCompetitorContent, fullCompetitorScan, getCompetitiveLandscape, getCompetitorDB } from './services/competitor-intelligence.service'
import { storeMemory, retrieveMemory, buildTravelerProfile } from './services/memory.service'
import { queryCollection } from './services/chroma.service'
import { callAgent } from './services/ai-agent.service'
import { buildPersonProfile, generatePersonalizedEmail, generatePersonalizedSMS, generatePersonalizedAd, updateProfileFromInteraction, batchPersonalize } from './services/personalization-engine.service'
import { getDiversityReport } from './services/content-diversity.engine'
import { analyzeImage } from './services/image-analysis.service'
import { loadAllSkills, getAllSkills, getSkill, saveSkill, deleteSkill, buildSkillContext } from './services/skill-manager.service'
import { draftPartnershipOutreach } from './agents/division3-partnerships'
import { verifyEmail, isNeverBounceConfigured } from './services/neverbounce.service'

async function main() {
  logger.info('Safari Zetu Ops Engine starting...')

  // Load domain skills
  const skillsLoaded = loadAllSkills()
  logger.info(`Skills loaded: ${skillsLoaded} domain knowledge files`)

  // Load RAG data into vector store
  await loadSafariCatalog()
  await loadPartnershipData()
  logger.info('RAG data loaded: safari catalog + partnerships')

  // Initialize Langfuse observability
  initLangfuse()

  // Start the cron schedulers
  startScheduler()
  startMailingScheduler()

  // ── HTTP SERVER (health + webhooks) ─────────────────────────
  const server = createServer(async (req, res) => {
    // Health check — live ping to DB
    if (req.url === '/health' && req.method === 'GET') {
      let dbStatus = 'mock-mode'
      let dbOk = false
      try {
        if (isDbConnected()) {
          await pool.query('SELECT 1')
          dbStatus = 'connected'
          dbOk = true
        }
      } catch {
        dbStatus = 'error'
      }
      const healthStatus = dbOk ? 200 : 503
      res.writeHead(healthStatus, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        status: dbOk ? 'ok' : 'degraded',
        service: 'safarizetu-ops-engine',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        db: dbStatus,
        langfuse: isLangfuseEnabled() ? 'connected' : 'in-memory-only'
      }))
      return
    }

    // Webhook receiver
    if (req.url === '/webhook/safari-zetu' && req.method === 'POST') {
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', async () => {
        try {
          const signature = (req.headers['x-safari-zetu-signature'] || req.headers['x-webhook-signature']) as string
          const payload = JSON.parse(body)
          await handleWebhook(payload.event, payload.data, signature, body)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ received: true }))
        } catch (error: any) {
          logger.error(`Webhook error: ${error.message}`)
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: error.message }))
        }
      })
      return
    }

    // Metrics endpoint
    if (req.url === '/metrics' && req.method === 'GET') {
      const metrics = getMetrics()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(metrics))
      return
    }

    // ── CONTENT PIPELINE ENDPOINTS ─────────────────────────────
    // Helper to parse JSON body
    const parseBody = (): Promise<any> => new Promise((resolve, reject) => {
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', () => { try { resolve(JSON.parse(body || '{}')) } catch { reject(new Error('Invalid JSON')) } })
    })

    // POST /api/upload — Upload images, create content drafts for all platforms
    if (req.url === '/api/upload' && req.method === 'POST') {
      try {
        const { images, platforms } = await parseBody()
        if (!images || !Array.isArray(images) || images.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'images array required (URLs or base64)' }))
          return
        }
        const result = await processUploadedImages(images, platforms)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (e: any) {
        logger.error(`Upload error: ${e.message}`)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // POST /api/analyze — Quick image analysis (no content creation)
    if (req.url === '/api/analyze' && req.method === 'POST') {
      try {
        const { image_url, context } = await parseBody()
        if (!image_url) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'image_url required' }))
          return
        }
        const analysis = await analyzeImage(image_url, context)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(analysis))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // GET /api/content/pending — List drafts waiting for approval
    if (req.url === '/api/content/pending' && req.method === 'GET') {
      try {
        const drafts = await getPendingDrafts()
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ drafts, count: drafts.length }))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // POST /api/content/approve/:id — Approve and auto-post a draft
    const approveMatch = req.url?.match(/^\/api\/content\/approve\/(.+)$/)
    if (approveMatch && req.method === 'POST') {
      try {
        const draftId = approveMatch[1]
        const result = await approveAndPost(draftId)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // POST /api/content/approve-all — Approve and post all pending
    if (req.url === '/api/content/approve-all' && req.method === 'POST') {
      try {
        const result = await approveAllPending()
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // POST /api/content/reject/:id — Reject a draft
    const rejectMatch = req.url?.match(/^\/api\/content\/reject\/(.+)$/)
    if (rejectMatch && req.method === 'POST') {
      try {
        const draftId = rejectMatch[1]
        const { reason } = await parseBody()
        await rejectDraft(draftId, reason)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ rejected: draftId }))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // GET /api/content/diversity — Content diversity report
    if (req.url === '/api/content/diversity' && req.method === 'GET') {
      try {
        const report = await getDiversityReport()
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(report))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // ── MEMORY STORYTELLING ENDPOINTS ───────────────────────────
    // POST /api/memories/upload — Upload images → memory stories (not marketing)
    if (req.url === '/api/memories/upload' && req.method === 'POST') {
      try {
        const { images, platforms } = await parseBody()
        if (!images || !Array.isArray(images) || images.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'images array required (URLs or base64)' }))
          return
        }
        const result = await processImagesIntoMemories(images, platforms)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (e: any) {
        logger.error(`Memory upload error: ${e.message}`)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // GET /api/memories/pending — List memory stories waiting for approval
    if (req.url === '/api/memories/pending' && req.method === 'GET') {
      try {
        const stories = await getPendingMemoryStories()
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ stories, count: stories.length }))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // POST /api/memories/approve/:id — Approve memory story → auto-post
    const memApproveMatch = req.url?.match(/^\/api\/memories\/approve\/(.+)$/)
    if (memApproveMatch && req.method === 'POST') {
      try {
        const draftId = memApproveMatch[1]
        const result = await approveMemoryStory(draftId)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // POST /api/memories/reject/:id — Reject a memory story
    const memRejectMatch = req.url?.match(/^\/api\/memories\/reject\/(.+)$/)
    if (memRejectMatch && req.method === 'POST') {
      try {
        const draftId = memRejectMatch[1]
        const { reason } = await parseBody()
        await rejectMemoryStory(draftId, reason)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ rejected: draftId }))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // ── GENERIC APPROVAL QUEUE ENDPOINTS ─────────────────────────
    // GET /api/approval/pending — List ALL pending items (partnership, proposals, etc.)
    if (req.url === '/api/approval/pending' && req.method === 'GET') {
      try {
        const { rows: items } = await pool.query(
          `SELECT * FROM approval_queue WHERE status = 'pending'
           ORDER BY
             CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
             created_at ASC
           LIMIT 50`
        )
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ items, count: items.length }))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // POST /api/approval/approve/:id — Approve item → send if partnership_email
    const approvalMatch = req.url?.match(/^\/api\/approval\/approve\/(.+)$/)
    if (approvalMatch && req.method === 'POST') {
      try {
        const itemId = approvalMatch[1]
        const { rows } = await pool.query(
          `UPDATE approval_queue SET status = 'approved', reviewed_at = NOW() WHERE id = $1 RETURNING *`,
          [itemId]
        )
        if (rows.length === 0) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Item not found' }))
          return
        }
        const item = rows[0]

        // If it's a partnership email, send it now and log to outreach_log
        let sendResult = null
        if (item.item_type === 'partnership_email' && item.reference_id) {
          const { rows: partners } = await pool.query(
            `SELECT * FROM partnership_pipeline WHERE id = $1`,
            [item.reference_id]
          )
          const partner = partners[0]
          if (partner?.contact_email) {
            // Verify email with NeverBounce if configured
            if (isNeverBounceConfigured()) {
              const verification = await verifyEmail(partner.contact_email)
              if (verification.status === 'invalid' || verification.status === 'disposable') {
                logger.warn(`Partner email ${partner.contact_email} is ${verification.status} — skipping send`)
                sendResult = { skipped: true, reason: `Email ${verification.status}` }
              }
            }

            if (!sendResult?.skipped) {
              // Extract subject from the email content (first line or "Re:" pattern)
              const lines = item.full_content.split('\n').filter((l: string) => l.trim())
              const subjectMatch = item.full_content.match(/subject:\s*(.+)/i)
              const subject = subjectMatch ? subjectMatch[1].trim() : `Partnership: Safari Zetu × ${partner.company_name}`

              try {
                const messageId = await sendEmail(
                  partner.contact_email,
                  subject,
                  item.full_content
                )

                // Log to outreach_log
                await pool.query(
                  `INSERT INTO outreach_log (entity_type, entity_id, email_to, email_subject, email_body, email_type, resend_message_id, status, approved_at, sent_at, agent_name)
                   VALUES ('partner', $1, $2, $3, $4, 'partnership_outreach', $5, 'sent', NOW(), NOW(), 'outreach_email_drafter')`,
                  [item.reference_id, partner.contact_email, subject, item.full_content, messageId]
                )

                // Update partnership status
                await pool.query(
                  `UPDATE partnership_pipeline SET status = 'outreach_sent', first_contact_at = COALESCE(first_contact_at, NOW()), last_contact_at = NOW(), updated_at = NOW() WHERE id = $1`,
                  [item.reference_id]
                )

                sendResult = { sent: true, to: partner.contact_email, messageId }
                logger.info(`Partnership outreach sent to ${partner.contact_email} (${partner.company_name})`)
              } catch (sendErr: any) {
                sendResult = { sent: false, error: sendErr.message }
                logger.error(`Failed to send partnership email: ${sendErr.message}`)
              }
            }
          } else {
            sendResult = { skipped: true, reason: 'No contact email on file' }
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ approved: itemId, type: item.item_type, send: sendResult }))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // POST /api/approval/reject/:id — Reject an approval queue item
    const approvalRejectMatch = req.url?.match(/^\/api\/approval\/reject\/(.+)$/)
    if (approvalRejectMatch && req.method === 'POST') {
      try {
        const itemId = approvalRejectMatch[1]
        const { reason } = await parseBody()
        await pool.query(
          `UPDATE approval_queue SET status = 'rejected', reviewed_at = NOW(), reviewer_notes = $1 WHERE id = $2`,
          [reason || null, itemId]
        )
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ rejected: itemId }))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // POST /api/approval/approve-all — Approve all pending items
    if (req.url === '/api/approval/approve-all' && req.method === 'POST') {
      try {
        const { rows } = await pool.query(
          `UPDATE approval_queue SET status = 'approved', reviewed_at = NOW() WHERE status = 'pending' RETURNING id`
        )
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ approved_count: rows.length }))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // POST /api/partners/draft-outreach/:id — Draft outreach email for a partner
    const draftOutreachMatch = req.url?.match(/^\/api\/partners\/draft-outreach\/(.+)$/)
    if (draftOutreachMatch && req.method === 'POST') {
      try {
        const partnerId = draftOutreachMatch[1]
        const { rows: partners } = await pool.query(
          `SELECT * FROM partnership_pipeline WHERE id = $1`, [partnerId]
        )
        if (partners.length === 0) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Partner not found' }))
          return
        }
        await draftPartnershipOutreach(partners[0])
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ drafted: true, partner: partners[0].company_name }))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // POST /api/research — Research travel psychology on demand
    if (req.url === '/api/research' && req.method === 'POST') {
      try {
        const { topic } = await parseBody()
        if (!topic) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'topic required' }))
          return
        }
        const result = await researchOnDemand(topic)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // GET /api/research/domains — Get all psychology research domains
    if (req.url === '/api/research/domains' && req.method === 'GET') {
      try {
        const domains = getResearchDomains()
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(domains))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // GET /api/research/principles — Get content psychology principles
    if (req.url === '/api/research/principles' && req.method === 'GET') {
      try {
        const principles = getContentPrinciples()
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(principles))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // ── LEARNING ENGINE ENDPOINTS ────────────────────────────────
    // POST /api/learning/engagement — Record content engagement data
    if (req.url === '/api/learning/engagement' && req.method === 'POST') {
      try {
        const data = await parseBody()
        if (!data.platform || !data.content_type) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'platform and content_type required' }))
          return
        }
        await recordEngagement({
          platform: data.platform,
          content_type: data.content_type || 'memory_story',
          memory_type: data.memory_type || 'unknown',
          tone: data.tone || 'unknown',
          topic: data.topic || 'unknown',
          psychology_used: data.psychology_used || [],
          impressions: data.impressions || 0,
          likes: data.likes || 0,
          comments: data.comments || 0,
          shares: data.shares || 0,
          saves: data.saves || 0,
          clicks: data.clicks || 0,
          reach: data.reach || 0,
          booked: data.booked || false,
          recorded_at: new Date()
        })
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ recorded: true }))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // GET /api/learning/analyze — Analyze performance and get adaptive strategy
    if (req.url === '/api/learning/analyze' && req.method === 'GET') {
      try {
        const result = await analyzePerformance()
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // GET /api/learning/status — Learning engine status and confidence
    if (req.url === '/api/learning/status' && req.method === 'GET') {
      try {
        const status = await getLearningStatus()
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(status))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // ── COMPETITOR INTELLIGENCE ENDPOINTS ────────────────────────
    // GET /api/competitors — List known competitors
    if (req.url === '/api/competitors' && req.method === 'GET') {
      try {
        const competitors = getCompetitorDB()
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ competitors, count: competitors.length }))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // POST /api/competitors/scan — Full competitor scan (all known competitors)
    if (req.url === '/api/competitors/scan' && req.method === 'POST') {
      try {
        const result = await fullCompetitorScan()
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // POST /api/competitors/scrape/:handle — Scrape specific competitor
    const scrapeMatch = req.url?.match(/^\/api\/competitors\/scrape\/(.+)$/)
    if (scrapeMatch && req.method === 'POST') {
      try {
        const handle = decodeURIComponent(scrapeMatch[1])
        const contents = await scrapeCompetitorContent(handle)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ competitor: handle, content: contents, count: contents.length }))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // GET /api/competitors/landscape — Current competitive landscape
    if (req.url === '/api/competitors/landscape' && req.method === 'GET') {
      try {
        const landscape = await getCompetitiveLandscape()
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(landscape))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // ── PERSONALIZATION ENDPOINTS ────────────────────────────────
    // POST /api/personalize/profile — Build/get person profile
    if (req.url === '/api/personalize/profile' && req.method === 'POST') {
      try {
        const { email } = await parseBody()
        if (!email) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'email required' }))
          return
        }
        const profile = await buildPersonProfile(email)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ profile }))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // POST /api/personalize/email — Generate personalized email
    if (req.url === '/api/personalize/email' && req.method === 'POST') {
      try {
        const { email, purpose, context } = await parseBody()
        if (!email || !purpose) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'email and purpose required' }))
          return
        }
        const profile = await buildPersonProfile(email)
        if (!profile) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Profile not found' }))
          return
        }
        const content = await generatePersonalizedEmail(profile, purpose, context)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ content }))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // POST /api/personalize/sms — Generate personalized SMS
    if (req.url === '/api/personalize/sms' && req.method === 'POST') {
      try {
        const { email, purpose, context } = await parseBody()
        if (!email || !purpose) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'email and purpose required' }))
          return
        }
        const profile = await buildPersonProfile(email)
        if (!profile) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Profile not found' }))
          return
        }
        const content = await generatePersonalizedSMS(profile, purpose, context)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ content }))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // POST /api/personalize/ad — Generate personalized ad for segment
    if (req.url === '/api/personalize/ad' && req.method === 'POST') {
      try {
        const { segment, platform, focus_interest } = await parseBody()
        if (!segment || !platform) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'segment and platform required' }))
          return
        }
        const content = await generatePersonalizedAd(segment, platform, focus_interest)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ content }))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // POST /api/personalize/interaction — Record interaction to update profile
    if (req.url === '/api/personalize/interaction' && req.method === 'POST') {
      try {
        const { email, type, content_topic, content_tone, content_memory_type } = await parseBody()
        if (!email || !type) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'email and type required' }))
          return
        }
        await updateProfileFromInteraction(email, {
          type,
          content_topic,
          content_tone,
          content_memory_type,
          timestamp: new Date()
        })
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ updated: true }))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // POST /api/personalize/batch — Batch personalize for multiple people
    if (req.url === '/api/personalize/batch' && req.method === 'POST') {
      try {
        const { emails, purpose, context } = await parseBody()
        if (!emails || !Array.isArray(emails) || !purpose) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'emails array and purpose required' }))
          return
        }
        const results = await batchPersonalize(emails, purpose, context)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ results, count: results.length }))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // ── SKILL MANAGEMENT ENDPOINTS ────────────────────────────────
    // GET /api/skills — List all loaded skills
    if (req.url === '/api/skills' && req.method === 'GET') {
      try {
        const skills = getAllSkills()
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ skills, count: skills.length }))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // GET /api/skills/:category/:name — Get a specific skill
    const skillMatch = req.url?.match(/^\/api\/skills\/([^/]+)\/([^/]+)$/)
    if (skillMatch && req.method === 'GET') {
      try {
        const skill = getSkill(skillMatch[1], skillMatch[2])
        if (!skill) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Skill not found' }))
          return
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ skill }))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // POST /api/skills — Create or update a skill
    if (req.url === '/api/skills' && req.method === 'POST') {
      try {
        const { category, name, content } = await parseBody()
        if (!category || !name || !content) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'category, name, and content required' }))
          return
        }
        saveSkill(category, name, content)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ saved: true, skill: `${category}/${name}` }))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // DELETE /api/skills/:category/:name — Delete a skill
    const skillDeleteMatch = req.url?.match(/^\/api\/skills\/([^/]+)\/([^/]+)$/)
    if (skillDeleteMatch && req.method === 'DELETE') {
      try {
        const deleted = deleteSkill(skillDeleteMatch[1], skillDeleteMatch[2])
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ deleted }))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // POST /api/skills/context — Get skill context for a task
    if (req.url === '/api/skills/context' && req.method === 'POST') {
      try {
        const { task_type, keywords, max_tokens } = await parseBody()
        const context = buildSkillContext(task_type || 'memory_story', keywords || [], max_tokens || 3000)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ context, length: context.length }))
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // POST /api/chat — Safari concierge chat (memory-aware, profile-building, complaint-detecting)
    if (req.url === '/api/chat' && req.method === 'POST') {
      try {
        const { messages, userId, sessionId } = await parseBody()
        if (!messages || !Array.isArray(messages)) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'messages array required' }))
          return
        }

        const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop()?.content || ''
        const chatUserId = userId || sessionId || `anon-${Date.now()}`

        // 1. Load memory context — what does this user care about?
        let memoryContext = ''
        let travelerProfile = null
        try {
          const memories = await retrieveMemory(chatUserId, undefined, 10)
          if (memories.length > 0) {
            const prefs = memories.filter(m => m.category === 'traveler_preference')
            const bookings = memories.filter(m => m.category === 'booking_history')
            const context = memories.filter(m => m.category === 'conversation_context')

            memoryContext = [
              prefs.length ? `Traveler preferences: ${prefs.map(m => `${m.key}=${m.value}`).join(', ')}` : '',
              bookings.length ? `Past bookings: ${bookings.map(m => m.value).join('; ')}` : '',
              context.length ? `Recent context: ${context.map(m => m.value).join('; ')}` : '',
            ].filter(Boolean).join('\n')
          }

          // Build profile if userId provided
          if (userId) {
            travelerProfile = await buildTravelerProfile(userId)
          }
        } catch (e: any) {
          logger.warn(`Memory load failed: ${e.message}`)
        }

        // 2. Vector search — find relevant lodges/parks for this query
        let vectorContext = ''
        try {
          const results = await queryCollection('safari-catalog', lastUserMessage, 3)
          if (results.length > 0) {
            vectorContext = results
              .map(r => `[${r.metadata?.type || 'info'}] ${r.text}`)
              .join('\n')
          }
        } catch (e: any) {
          logger.warn(`Vector search failed: ${e.message}`)
        }

        // 3. Complaint detection — check sentiment before sending to LLM
        let complaintFlag = null
        try {
          const detectResult = await callAgent({
            agentName: 'complaint_detector',
            division: 'operations',
            model: 'light',
            systemPrompt: `Analyze this message for complaints or dissatisfaction. Return JSON only:
{"sentiment":"positive|neutral|negative|urgent","complaint_detected":true|false,"severity":"low|medium|high|critical","issue_summary":"one sentence if complaint"}
LOW = general negative sentiment. MEDIUM = expressed disappointment. HIGH = specific complaint. CRITICAL = safety/health/financial dispute.`,
            userMessage: lastUserMessage,
            triggerType: 'complaint_detection',
            maxTokens: 150,
          })
          const jsonMatch = detectResult.content.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            complaintFlag = JSON.parse(jsonMatch[0])
          }
        } catch (e: any) {
          logger.warn(`Complaint detection failed: ${e.message}`)
        }

        // 4. Build enhanced system prompt with all context
        const profileSnippet = travelerProfile ? `
RETURNING TRAVELER:
- Interests: ${travelerProfile.preferences?.['preferred_destination'] || 'unknown'}
- Travel style: ${travelerProfile.communicationStyle}
- Past bookings: ${travelerProfile.pastBookings.length > 0 ? travelerProfile.pastBookings.join(', ') : 'none'}
- Welcome them back if they've visited before.` : ''

        const memorySnippet = memoryContext ? `\n\nREMEMBERED CONTEXT (from past conversations):\n${memoryContext}` : ''

        const vectorSnippet = vectorContext ? `\n\nRELEVANT CATALOG RESULTS:\n${vectorContext}` : ''

        const complaintSnippet = complaintFlag?.complaint_detected ?
          `\n\n⚠️ COMPLAINT DETECTED (${complaintFlag.severity}): ${complaintFlag.issue_summary}. Acknowledge empathetically, offer specific resolution. If HIGH/CRITICAL, say you'll connect them with the team immediately.` : ''

        const systemPrompt = `You are Safari Zetu's AI safari concierge — a friendly, knowledgeable expert on Zimbabwean wildlife experiences.

PERSONALITY:
- Warm, enthusiastic, professional. Like a trusted friend who happens to be a safari expert.
- Use "we" when referring to Safari Zetu. Use "you" for the guest.
- Keep responses concise (2-4 sentences max unless listing options). No walls of text.
- Never say "I don't know" — instead say "Let me connect you with our team for that specific detail."
- Use light emoji sparingly (🌍 🦁 🏞️) but don't overdo it.
${profileSnippet}

KNOWLEDGE:
- Zimbabwe destinations: Victoria Falls, Hwange, Mana Pools, Matobo, Great Zimbabwe, Eastern Highlands (Bvumba, Nyanga), Kariba, Chobe border area
- Activities: Game drives, walking safaris, canoeing, helicopter flights, bungee, fishing, cultural village visits, bird watching
- Safari tiers: Classic (budget-friendly, $200-350/night), Signature (mid-range, $400-700/night), Premium (luxury, $800+/night)
- Best seasons: May-Oct (dry, best wildlife), Nov-Apr (green season, fewer crowds, baby animals)
- Zimbabwe is safe for tourists, locals are warm and welcoming
- Safari Zetu is a curated marketplace connecting guests with verified local operators
${vectorSnippet}

RULES:
- Always respond helpfully. Never refuse to chat.
- If asked about pricing, give ranges (e.g. "Classic safaris start around $200-350/night, Signature $400-700, Premium $800+").
- If the user shares dates, group size, or interests, acknowledge and build on that.
- For complex itineraries, suggest they complete the full enquiry so our team can craft a custom plan.
- Never make up specific availability or book directly — always route to the enquiry flow for final confirmation.
- Keep responses under 150 words unless listing multiple options.
- If catalog results above match the user's query, reference specific lodges/parks by name.
${memorySnippet}${complaintSnippet}`

        // 5. Build conversation context
        const conversation = messages.map((m: any) => `${m.role}: ${m.content}`).join('\n')

        // 6. Call the LLM
        const { callAgent: callAgentFn } = await import('./services/ai-agent.service')
        const result = await callAgentFn({
          agentName: 'safari_concierge',
          division: 'growth',
          model: 'light',
          systemPrompt,
          userMessage: conversation,
          triggerType: 'chat',
          triggerPayload: { messages, userId: chatUserId, hasProfile: !!travelerProfile },
          maxTokens: 500,
        })

        // 7. Save conversation to memory
        try {
          await storeMemory(chatUserId, 'conversation_context', `chat-${Date.now()}`, lastUserMessage, {
            sessionId,
            timestamp: new Date().toISOString(),
          })

          // Extract and store preferences if mentioned
          const lowerMsg = lastUserMessage.toLowerCase()
          if (lowerMsg.includes('hwange') || lowerMsg.includes('victoria') || lowerMsg.includes('mana pools') || lowerMsg.includes('kariba')) {
            const dest = lowerMsg.includes('hwange') ? 'Hwange' :
                        lowerMsg.includes('victoria') ? 'Victoria Falls' :
                        lowerMsg.includes('mana pools') ? 'Mana Pools' : 'Kariba'
            await storeMemory(chatUserId, 'traveler_preference', 'preferred_destination', dest)
          }
          if (lowerMsg.includes('budget') || lowerMsg.includes('cheap') || lowerMsg.includes('affordable')) {
            await storeMemory(chatUserId, 'traveler_preference', 'budget_sensitivity', 'budget-conscious')
          }
          if (lowerMsg.includes('luxury') || lowerMsg.includes('premium') || lowerMsg.includes('high-end')) {
            await storeMemory(chatUserId, 'traveler_preference', 'budget_sensitivity', 'luxury')
          }
          if (lowerMsg.includes('honeymoon') || lowerMsg.includes('anniversary')) {
            await storeMemory(chatUserId, 'traveler_preference', 'occasion', lowerMsg.includes('honeymoon') ? 'honeymoon' : 'anniversary')
          }
          if (lowerMsg.includes('family') || lowerMsg.includes('kids') || lowerMsg.includes('children')) {
            await storeMemory(chatUserId, 'traveler_preference', 'group_type', 'family')
          }
        } catch (e: any) {
          logger.warn(`Memory save failed: ${e.message}`)
        }

        // 8. Track engagement
        try {
          await recordEngagement({
            platform: 'web_chat',
            content_type: 'concierge_response',
            memory_type: 'conversation',
            tone: 'warm',
            topic: lastUserMessage.substring(0, 50),
            psychology_used: complaintFlag?.complaint_detected ? ['empathy', 'resolution'] : ['recommendation'],
            impressions: 1,
            likes: 0,
            comments: 0,
            shares: 0,
            saves: 0,
            clicks: 0,
            reach: 1,
            booked: false,
            recorded_at: new Date(),
          })
        } catch (e: any) {
          // Non-critical, don't fail the request
        }

        // 9. Return response with optional escalation flag
        const response: any = { reply: result.content }
        if (complaintFlag?.complaint_detected && ['high', 'critical'].includes(complaintFlag.severity)) {
          response.escalation = {
            required: true,
            severity: complaintFlag.severity,
            summary: complaintFlag.issue_summary,
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(response))
      } catch (e: any) {
        logger.error(`Chat error: ${e.message}`)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // POST /api/booking-chat — Conversational booking bot
    if (req.url === '/api/booking-chat' && req.method === 'POST') {
      try {
        const { message, platform, userId, conversationId } = await parseBody()
        if (!message) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'message required' }))
          return
        }

        const { handleIncomingMessage } = await import('./agents/booking-bot')
        const result = await handleIncomingMessage({
          conversation_id: conversationId || `conv-${Date.now()}`,
          platform: platform || 'web',
          platform_user_id: userId || `user-${Date.now()}`,
          message,
          tourist_id: userId,
        })

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (e: any) {
        logger.error(`Booking chat error: ${e.message}`)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // POST /api/emails/preview — Preview email templates
    if (req.url === '/api/emails/preview' && req.method === 'POST') {
      try {
        const { template, data, palette } = await parseBody()
        let html = ''
        
        if (template === 'enquiry-acknowledgement') {
          const { enquiryAcknowledgementEmail } = await import('./services/email-templates')
          html = enquiryAcknowledgementEmail({
            touristName: data?.touristName || 'John',
            enquiryId: data?.enquiryId || 'ENQ-001',
            destination: data?.destination || 'Victoria Falls',
            travelDates: data?.travelDates || 'March 2026',
            partySize: data?.partySize || 2,
            enquiryUrl: data?.enquiryUrl || 'https://safarizetu.com/enquiry/test'
          })
        } else if (template === 'booking-confirmation') {
          const { bookingConfirmationEmail } = await import('./services/email-templates')
          html = bookingConfirmationEmail({
            touristName: data?.touristName || 'John',
            bookingId: data?.bookingId || 'BK-001',
            safariName: data?.safariName || 'Victoria Falls Adventure',
            operatorName: data?.operatorName || 'Safari Experts',
            travelDates: data?.travelDates || 'March 2026',
            partySize: data?.partySize || 2,
            totalAmount: data?.totalAmount || '$2,500',
            depositPaid: data?.depositPaid || '$500',
            balanceDue: data?.balanceDue || '$2,000',
            bookingUrl: data?.bookingUrl || 'https://safarizetu.com/bookings/test'
          })
        } else if (template === 'revenue-report') {
          const { revenueReportEmail } = await import('./services/email-templates')
          html = revenueReportEmail({
            operatorName: data?.operatorName || 'Safari Experts',
            reportPeriod: data?.reportPeriod || 'Week 24, 2026',
            totalRevenue: data?.totalRevenue || '$12,500',
            bookingsCount: data?.bookingsCount || 8,
            averageBookingValue: data?.averageBookingValue || '$1,562',
            topSafari: data?.topSafari || 'Victoria Falls Adventure',
            conversionRate: data?.conversionRate || '3.2%',
            commissionOwed: data?.commissionOwed || '$1,875'
          })
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Unknown template. Available: enquiry-acknowledgement, booking-confirmation, revenue-report' }))
          return
        }
        
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(html)
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // POST /api/newsletter/generate — Generate newsletter draft
    if (req.url === '/api/newsletter/generate' && req.method === 'POST') {
      try {
        const { generateNewsletter } = await import('./agents/newsletter-agent')
        const newsletter = await generateNewsletter()
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(newsletter))
      } catch (e: any) {
        logger.error(`Newsletter generation error: ${e.message}`)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // POST /api/competitor/research — Run competitor ad research
    if (req.url === '/api/competitor/research' && req.method === 'POST') {
      try {
        const { runCompetitorAdResearch } = await import('./agents/competitor-ad-agent')
        const result = await runCompetitorAdResearch()
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (e: any) {
        logger.error(`Competitor research error: ${e.message}`)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // POST /api/seo/research — Advanced SEO research pipeline
    if (req.url === '/api/seo/research' && req.method === 'POST') {
      try {
        const { keyword, language, country, brand, audience } = await parseBody()
        if (!keyword) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'keyword required' }))
          return
        }
        const { runSEOResearchPipeline } = await import('./agents/seo-research-agent')
        const result = await runSEOResearchPipeline(keyword, { language, country, brand, audience })
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (e: any) {
        logger.error(`SEO research error: ${e.message}`)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // POST /api/seo/factory — SEO content factory
    if (req.url === '/api/seo/factory' && req.method === 'POST') {
      try {
        const { keyword, brand, audience, country } = await parseBody()
        if (!keyword) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'keyword required' }))
          return
        }
        const { runSEOContentFactory } = await import('./agents/seo-content-factory')
        const result = await runSEOContentFactory(keyword, { brand, audience, country })
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (e: any) {
        logger.error(`SEO factory error: ${e.message}`)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // POST /api/telegram/route — Telegram command orchestrator
    if (req.url === '/api/telegram/route' && req.method === 'POST') {
      try {
        const { chat_id, user_id, text, has_media } = await parseBody()
        if (!text || !chat_id) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'chat_id and text required' }))
          return
        }
        const { routeTelegramCommand } = await import('./agents/telegram-orchestrator')
        const route = await routeTelegramCommand({
          chat_id,
          user_id,
          text,
          has_media: has_media || false,
          received_at: new Date().toISOString()
        })
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(route))
      } catch (e: any) {
        logger.error(`Telegram route error: ${e.message}`)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    // ── ADMIN PANEL ─────────────────────────────────────────────
    // GET /admin — serve admin HTML with ALL 29 agents
    if (req.url === '/admin' || req.url === '/admin/') {
      const adminHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>SafariZetu Ops Engine — Admin</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0a;color:#e0e0e0;min-height:100vh}
    .header{background:#111;border-bottom:1px solid #222;padding:16px 24px;display:flex;justify-content:space-between;align-items:center}
    .header h1{font-size:18px;color:#2D4231}.header .status{font-size:12px;color:#666}
    .header a{color:#B37038;text-decoration:none;font-size:13px;margin-left:16px}
    .container{max-width:1200px;margin:0 auto;padding:24px}
    .metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:24px}
    .card{background:#111;border:1px solid #222;border-radius:8px;padding:16px}
    .metric{text-align:center;padding:12px}.metric .value{font-size:28px;font-weight:700;color:#2D4231}
    .metric .label{font-size:10px;color:#888;margin-top:4px;text-transform:uppercase}
    .btn{padding:7px 14px;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;transition:all 0.2s}
    .btn-primary{background:#2D4231;color:#fff}.btn-primary:hover{background:#3a5a3f}
    .btn-gold{background:#B37038;color:#fff}.btn-gold:hover{background:#c9803f}
    .btn-danger{background:#8b2500;color:#fff}.btn-sm{padding:5px 10px;font-size:11px}
    .btn:disabled{opacity:0.5;cursor:not-allowed}
    .section{margin-bottom:32px}
    .section-title{font-size:15px;font-weight:600;color:#e0e0e0;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #222;display:flex;align-items:center;gap:8px}
    .section-title .count{background:#2D4231;color:#fff;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:700}
    .template-card{background:#0d0d0d;border:1px solid #1a1a1a;border-radius:8px;padding:14px;margin-bottom:10px;transition:border-color 0.2s}
    .template-card:hover{border-color:#2D4231}
    .template-num{display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;background:#2D4231;color:#fff;border-radius:50%;font-size:11px;font-weight:700;margin-right:8px}
    .template-name{font-size:14px;font-weight:600;color:#e0e0e0}
    .template-desc{font-size:11px;color:#888;margin:6px 0}
    .template-steps{font-size:10px;color:#666;margin:6px 0;padding:6px;background:#111;border-radius:4px}
    .template-steps code{color:#B37038}
    .template-actions{display:flex;gap:8px;margin-top:8px;align-items:center}
    .template-tag{display:inline-block;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:600}
    .tag-content{background:#1a2a1a;color:#4ade80}.tag-seo{background:#1a1a3a;color:#60a5fa}
    .tag-intel{background:#3a1a1a;color:#f87171}.tag-ops{background:#2a2a1a;color:#fbbf24}
    .tag-growth{background:#1a3a2a;color:#34d399}.tag-revenue{background:#3a2a1a;color:#fb923c}
    .agent-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px}
    .agent-item{background:#0d0d0d;border:1px solid #1a1a1a;border-radius:6px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;transition:border-color 0.2s}
    .agent-item:hover{border-color:#2D4231}
    .agent-label{font-size:12px;font-weight:600}.agent-desc{font-size:10px;color:#666}
    .tabs{display:flex;gap:4px;margin-bottom:16px}.tab{padding:7px 14px;background:#111;border:1px solid #222;border-radius:6px;cursor:pointer;font-size:12px;color:#888}
    .tab.active{background:#2D4231;color:#fff;border-color:#2D4231}
    .log{background:#0d0d0d;border:1px solid #1a1a1a;border-radius:6px;padding:12px;max-height:500px;overflow-y:auto;font-family:'Fira Code',monospace;font-size:11px;line-height:1.6}
    .log-entry{border-bottom:1px solid #1a1a1a;padding:5px 0}.log-entry:last-child{border:none}
    .log-time{color:#555}.log-agent{color:#B37038;font-weight:600}
    .log-status{padding:2px 6px;border-radius:3px;font-size:10px}
    .log-status.success{background:#1a3a1a;color:#4ade80}.log-status.running{background:#1a2a3a;color:#60a5fa}.log-status.failed{background:#3a1a1a;color:#f87171}
    .result-box{background:#0d0d0d;border:1px solid #1a1a1a;border-radius:6px;padding:14px;margin-top:12px;white-space:pre-wrap;font-size:11px;line-height:1.5;max-height:400px;overflow-y:auto;display:none}
    .result-box.visible{display:block}
    .spinner{display:inline-block;width:12px;height:12px;border:2px solid #333;border-top-color:#B37038;border-radius:50%;animation:spin .6s linear infinite;margin-right:6px}
    @keyframes spin{to{transform:rotate(360deg)}}
  </style>
</head>
<body>
  <div class="header">
    <div style="display:flex;align-items:center;gap:12px">
      <h1>SafariZetu Ops Engine</h1>
      <a href="/">Dashboard</a><a href="/health">Health</a><a href="/metrics">Metrics</a>
    </div>
    <div class="status" id="status">Connecting...</div>
  </div>
  <div class="container">
    <div class="metrics" id="metrics"></div>

    <div class="section">
      <div class="section-title">n8n Marketing Templates (Native TypeScript) <span class="count">6</span></div>
      <div id="n8n-templates"></div>
    </div>

    <div class="section">
      <div class="section-title">OpsEngine Original Agents <span class="count">23</span></div>
      <div class="agent-grid" id="original-agents"></div>
    </div>

    <div class="tabs" style="margin-top:20px">
      <div class="tab active" data-tab="runs">Run History</div>
      <div class="tab" data-tab="approvals">Approvals</div>
    </div>
    <div id="panel-runs"><div class="log" id="runs-log"><div style="color:#555;padding:20px;text-align:center">No runs yet. Click "Run" on any agent.</div></div></div>
    <div id="panel-approvals" style="display:none"><div class="log" id="approvals-log"></div><div style="margin-top:10px"><button class="btn btn-primary btn-sm" onclick="approveAll()">Approve All</button></div></div>
    <div class="result-box" id="agent-result"></div>
  </div>
  <script>
    const API = window.location.origin;
    const n8n = [
      {num:'01',name:'Newsletter Machine',agent:'newsletter-agent',cron:'Daily 7AM',desc:'3-5 story newsletter from safari/travel RSS feeds. AI curates, writes, formats.',steps:['Fetch RSS/API sources','AI selects top stories','Generate newsletter HTML','Store draft for approval'],tag:'Content',tagClass:'tag-content'},
      {num:'02',name:'Viral Content Multiplier',agent:'social-content',cron:'Thu 2AM',desc:'Repurposes content into Instagram, Facebook, TikTok, Pinterest, Twitter posts.',steps:['Receive source content','Analyze themes and hooks','Generate platform formats','Create posting calendar'],tag:'Content',tagClass:'tag-content'},
      {num:'03',name:'Competitor Ad Research',agent:'competitor-ad-agent',cron:'Monthly 1st',desc:'Analyzes competitor ads, extracts winning patterns, generates original concepts.',steps:['Scan competitor ad libraries','Extract winning hooks/formats','Generate 5+ original concepts','Create A/B test matrix'],tag:'Intel',tagClass:'tag-intel'},
      {num:'04',name:'SEO Content Factory',agent:'seo-content-factory',cron:'Tue/Thu 6AM',desc:'Keyword research -> brief -> article -> humanize. Publication-ready SEO content.',steps:['Research keyword clusters','Generate content brief','Write 1500-2500 word article','Humanize to pass AI detection'],tag:'SEO',tagClass:'tag-seo'},
      {num:'05',name:'Telegram Orchestrator',agent:'telegram-orchestrator',cron:'On-demand',desc:'Routes Telegram commands to 9 specialist agents. Logs all actions.',steps:['Parse Telegram command','Route to specialist agent','Execute action','Log and respond'],tag:'Ops',tagClass:'tag-ops'},
      {num:'06',name:'Advanced SEO Research',agent:'seo-research-agent',cron:'Weekly Wed',desc:'Deep SEO: Google Search -> competitor analysis -> brief -> article -> Docs.',steps:['Google Search research','Scrape top 10 results','Generate content brief','Write and humanize article'],tag:'SEO',tagClass:'tag-seo'},
    ];
    const originals = [
      {name:'booking-bot',label:'Booking Bot',desc:'Handles incoming booking enquiries, generates quotes',cron:'Real-time',cat:'ops'},
      {name:'billing-agent',label:'Billing Agent',desc:'Usage tracking, invoice generation, payment reminders',cron:'Daily + Monthly',cat:'revenue'},
      {name:'contract-generator',label:'Contract Generator',desc:'Auto-generates partnership contracts with legal terms',cron:'Webhook',cat:'ops'},
      {name:'doc-generator',label:'Document Generator',desc:'Weekly ops docs, user guides, changelogs, FAQs',cron:'Daily 3AM',cat:'ops'},
      {name:'division1-growth',label:'Growth Division',desc:'SEO content creation + operator activation emails',cron:'Daily',cat:'growth'},
      {name:'division3-partnerships',label:'Partnerships Division',desc:'Research + outreach to tour operators and lodges',cron:'Sun 6PM',cat:'growth'},
      {name:'division4-feedback',label:'Feedback Division',desc:'Triage customer feedback, generate code fixes, notify founder',cron:'On-demand',cat:'ops'},
      {name:'sales-prospector',label:'Sales Prospector',desc:'Apollo.io lead gen, NeverBounce verify, cold outreach',cron:'Mon 1AM',cat:'growth'},
      {name:'influencer-manager',label:'Influencer Outreach',desc:'Find, vet, and reach out to travel influencers',cron:'Fri 9AM',cat:'growth'},
      {name:'social-content',label:'Social Content',desc:'Content calendar for Instagram, Facebook, TikTok, Pinterest',cron:'Thu 2AM',cat:'content'},
      {name:'sentiment-tracker',label:'Sentiment Tracker',desc:'Monitor brand sentiment, detect alerts, suggest responses',cron:'Daily',cat:'intel'},
      {name:'market-researcher',label:'Market Researcher',desc:'Quarterly deep market analysis and competitor reports',cron:'Quarterly',cat:'intel'},
      {name:'dynamic-pricing',label:'Dynamic Pricing',desc:'Monitor competitor prices, generate pricing recommendations',cron:'Daily',cat:'revenue'},
      {name:'revenue-analytics',label:'Revenue Analytics',desc:'Weekly revenue reports and key metric calculations',cron:'Mon',cat:'revenue'},
      {name:'revenue-splitter',label:'Revenue Splitter',desc:'Calculate partner payouts and detect anomalies',cron:'Monthly 1st',cat:'revenue'},
      {name:'operator-scorer',label:'Operator Scorer',desc:'Rate operators on quality, sustainability, value',cron:'Monthly 1st',cat:'ops'},
      {name:'inventory-manager',label:'Inventory Manager',desc:'Track safari availability, predict demand, detect shortages',cron:'Daily',cat:'ops'},
      {name:'onboarding-flow',label:'Onboarding Flow',desc:'New operator onboarding sequences and nudges',cron:'On-demand',cat:'ops'},
      {name:'chatbot-trainer',label:'Chatbot Trainer',desc:'Analyze failed conversations, generate training data',cron:'Weekly',cat:'ops'},
      {name:'security-monitor',label:'Security Monitor',desc:'Threat scanning, rate limiting, IP blocking',cron:'Hourly',cat:'ops'},
      {name:'feature-flags',label:'Feature Flags',desc:'Manage feature toggles and A/B experiments',cron:'On-demand',cat:'ops'},
      {name:'localizer',label:'Localizer',desc:'Translate content for different markets and cultures',cron:'Weekly',cat:'content'},
      {name:'sustainability-tracker',label:'Sustainability Tracker',desc:'ESG scoring, sustainability reports, improvement recs',cron:'Quarterly',cat:'ops'},
      {name:'browser-test',label:'Browser Test',desc:'Automated browser testing for web features',cron:'On-demand',cat:'ops'},
    ];
    const catColors = {ops:'tag-ops',growth:'tag-growth',revenue:'tag-revenue',content:'tag-content',intel:'tag-intel'};

    // Render n8n templates
    const n8nC = document.getElementById('n8n-templates');
    n8n.forEach(t => {
      n8nC.innerHTML += '<div class="template-card"><div><span class="template-num">'+t.num+'</span><span class="template-name">'+t.name+'</span> <span class="template-tag '+t.tagClass+'">'+t.tag+'</span></div><div class="template-desc">'+t.desc+'</div><div class="template-steps"><strong>Steps:</strong> '+t.steps.map((s,i) => '<code>'+(i+1)+'</code> '+s).join(' &rarr; ')+'</div><div class="template-actions"><button class="btn btn-gold btn-sm" onclick="triggerAgent(this,\''+t.agent+'\')">Run Now</button><span style="font-size:10px;color:#555">'+t.cron+'</span></div></div>';
    });

    // Render original agents
    const oC = document.getElementById('original-agents');
    originals.forEach(a => {
      oC.innerHTML += '<div class="agent-item"><div><div class="agent-label">'+a.label+'</div><div class="agent-desc">'+a.desc+' | '+a.cron+'</div></div><button class="btn btn-gold btn-sm" onclick="triggerAgent(this,\''+a.name+'\')">Run</button></div>';
    });

    // Tab switching
    document.querySelectorAll('.tab').forEach(t => {
      t.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        document.getElementById('panel-runs').style.display = t.dataset.tab === 'runs' ? 'block' : 'none';
        document.getElementById('panel-approvals').style.display = t.dataset.tab === 'approvals' ? 'block' : 'none';
        if(t.dataset.tab === 'runs') loadRuns();
        if(t.dataset.tab === 'approvals') loadApprovals();
      });
    });

    async function triggerAgent(btn, name) {
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
      const rb = document.getElementById('agent-result');
      rb.className = 'result-box visible'; rb.textContent = 'Running '+name+'...';
      try {
        const res = await fetch(API+'/api/admin/trigger/'+name, {method:'POST', signal:AbortSignal.timeout(120000)});
        const data = await res.json();
        rb.textContent = JSON.stringify(data, null, 2); btn.innerHTML = 'Run Again';
        loadRuns();
      } catch(e) { rb.textContent = 'Error: '+e.message; btn.innerHTML = 'Retry'; }
      btn.disabled = false;
    }

    async function loadRuns() {
      const log = document.getElementById('runs-log');
      try {
        const res = await fetch(API+'/api/admin/runs');
        const data = await res.json();
        if(!data.runs||data.runs.length===0){log.innerHTML='<div style="color:#555;padding:20px;text-align:center">No runs yet.</div>';return;}
        log.innerHTML = data.runs.map(r => '<div class="log-entry"><span class="log-time">'+new Date(r.started_at).toLocaleString()+'</span> <span class="log-agent">'+r.agent_name+'</span> <span class="log-status '+(r.status||'running')+'">'+(r.status||'running')+'</span>'+(r.result_summary?' <span style="color:#666">'+r.result_summary.substring(0,100)+'</span>':'')+'</div>').join('');
      } catch(e) { log.innerHTML='<div style="color:#f87171">Error</div>'; }
    }

    async function loadApprovals() {
      const log = document.getElementById('approvals-log');
      try {
        const res = await fetch(API+'/api/approval/pending');
        const data = await res.json();
        if(!data.items||data.items.length===0){log.innerHTML='<div style="color:#555;padding:20px;text-align:center">No pending approvals.</div>';return;}
        log.innerHTML = data.items.map(i => '<div class="log-entry"><span class="log-agent">'+i.item_type+'</span> <span style="color:#666">'+(i.title||i.content||'').substring(0,100)+'</span> <button class="btn btn-primary btn-sm" style="margin-left:8px" onclick="approveItem(this,\\''+i.id+'\\')">Approve</button> <button class="btn btn-danger btn-sm" onclick="rejectItem(this,\\''+i.id+'\\')">Reject</button></div>').join('');
      } catch(e) { log.innerHTML='<div style="color:#f87171">Error</div>'; }
    }

    async function approveItem(btn,id){btn.disabled=true;btn.textContent='...';await fetch(API+'/api/approval/approve/'+id,{method:'POST'});btn.parentElement.remove();}
    async function rejectItem(btn,id){btn.disabled=true;btn.textContent='...';await fetch(API+'/api/approval/reject/'+id,{method:'POST'});btn.parentElement.remove();}
    async function approveAll(){await fetch(API+'/api/approval/approve-all',{method:'POST'});loadApprovals();}

    async function loadMetrics() {
      try{const r=await fetch(API+'/health');const d=await r.json();document.getElementById('status').textContent='DB: '+(d.db||'mock')+' | Langfuse: '+(d.langfuse||'off');}catch(e){document.getElementById('status').textContent='Offline';}
      try{const r=await fetch(API+'/metrics');const d=await r.json();document.getElementById('metrics').innerHTML='<div class="card metric"><div class="value">'+(d.total_runs||d.total_traces||0)+'</div><div class="label">Runs</div></div><div class="card metric"><div class="value">'+(d.total_tokens||0)+'</div><div class="label">Tokens</div></div><div class="card metric"><div class="value">$'+(d.total_cost_usd||0).toFixed(2)+'</div><div class="label">Cost</div></div><div class="card metric"><div class="value">'+(d.avg_latency_ms||0)+'</div><div class="label">Latency ms</div></div>';}catch(e){}
    }
    loadMetrics(); setInterval(loadMetrics,15000);
  </script>
</body>
</html>`;
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(adminHtml)
      return
    }

    // GET /api/admin/runs — list recent agent runs
    if (req.url === '/api/admin/runs' && req.method === 'GET') {
      try {
        if (isDbConnected()) {
          const result = await pool.query(
            'SELECT * FROM agent_run_log ORDER BY started_at DESC LIMIT 50'
          )
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ runs: result.rows }))
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ runs: [], mode: 'mock-db', message: 'Run logs not persisted in mock mode' }))
        }
      } catch (e: any) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ runs: [], error: e.message }))
      }
      return
    }

    // POST /api/admin/trigger/:agentName — manually trigger an agent
    const triggerMatch = req.url?.match(/^\/api\/admin\/trigger\/(.+)$/)
    if (triggerMatch && req.method === 'POST') {
      const agentName = triggerMatch[1]
      try {
        let result: any
        switch (agentName) {
          case 'newsletter-agent': {
            const { generateNewsletter } = await import('./agents/newsletter-agent')
            result = await generateNewsletter()
            break
          }
          case 'competitor-ad-agent': {
            const { runCompetitorAdResearch } = await import('./agents/competitor-ad-agent')
            result = await runCompetitorAdResearch()
            break
          }
          case 'seo-research-agent': {
            const { runSEOResearchPipeline } = await import('./agents/seo-research-agent')
            result = await runSEOResearchPipeline('Victoria Falls safari', { language: 'en', country: 'US', brand: 'SafariZetu', audience: 'luxury travelers' })
            break
          }
          case 'seo-content-factory': {
            const { runSEOContentFactory } = await import('./agents/seo-content-factory')
            result = await runSEOContentFactory('Hwange National Park safari', { brand: 'SafariZetu', audience: 'adventure travelers' })
            break
          }
          case 'telegram-orchestrator': {
            const { routeTelegramCommand } = await import('./agents/telegram-orchestrator')
            result = await routeTelegramCommand({ chat_id: 'admin-test', user_id: 'admin', text: '/research Victoria Falls', has_media: false, received_at: new Date().toISOString() })
            break
          }
          case 'social-content': {
            const { generateContent } = await import('./agents/social-content')
            result = await generateContent('instagram', 'Victoria Falls', 'adventure')
            break
          }
          case 'sales-prospector': {
            const { runDailyProspecting } = await import('./agents/sales-prospector')
            result = await runDailyProspecting()
            break
          }
          case 'influencer-manager': {
            const { runMonthlyInfluencerOutreach } = await import('./agents/influencer-manager')
            result = await runMonthlyInfluencerOutreach()
            break
          }
          case 'division1-growth': {
            const { generateSeoContent } = await import('./agents/division1-growth')
            await generateSeoContent('Victoria Falls luxury safari', 'Victoria Falls', ['victoria falls safari', 'luxury safari zimbabwe'])
            result = { status: 'completed', topic: 'Victoria Falls luxury safari' }
            break
          }
          case 'division3-partnerships': {
            const { draftPartnershipOutreach } = await import('./agents/division3-partnerships')
            await draftPartnershipOutreach({ company_name: 'Test Partners', partner_type: 'tour_operator' })
            result = { status: 'completed', partner: 'Test Partners' }
            break
          }
          case 'market-researcher': {
            const { runQuarterlyResearch } = await import('./agents/market-researcher')
            result = await runQuarterlyResearch()
            break
          }
          case 'sentiment-tracker': {
            const { runDailySentimentCheck } = await import('./agents/sentiment-tracker')
            result = await runDailySentimentCheck()
            break
          }
          case 'security-monitor': {
            const { runHourlySecurityCheck } = await import('./agents/security-monitor')
            result = await runHourlySecurityCheck()
            break
          }
          case 'billing-agent': {
            const { runMonthlyBilling } = await import('./agents/billing-agent')
            result = await runMonthlyBilling()
            break
          }
          case 'operator-scorer': {
            const { runMonthlyScoring } = await import('./agents/operator-scorer')
            result = await runMonthlyScoring()
            break
          }
          case 'revenue-splitter': {
            const { runMonthlyRevenueSplitting } = await import('./agents/revenue-splitter')
            result = await runMonthlyRevenueSplitting()
            break
          }
          case 'contract-generator': {
            const { generateContract } = await import('./agents/contract-generator')
            result = await generateContract({ partner_name: 'Test Partner', partner_type: 'lodge', contact_email: 'test@example.com', commission_pct: 15 })
            break
          }
          case 'doc-generator': {
            const { generateAllDocs } = await import('./agents/doc-generator')
            result = await generateAllDocs()
            break
          }
          case 'booking-bot': {
            const { handleIncomingMessage } = await import('./agents/booking-bot')
            result = await handleIncomingMessage({ conversation_id: 'admin-test', platform: 'web', platform_user_id: 'admin', message: 'I want to book a Victoria Falls safari for 2 people in December' })
            break
          }
          case 'chatbot-trainer': {
            const { runWeeklyTraining } = await import('./agents/chatbot-trainer')
            result = await runWeeklyTraining()
            break
          }
          case 'division4-feedback': {
            const { triageFeedback } = await import('./agents/division4-feedback')
            result = await triageFeedback({ id: 'test-1', source: 'admin', title: 'Booking form confusing', body: 'The booking form was confusing to use', author_name: 'Admin Test' })
            break
          }
          case 'dynamic-pricing': {
            const { runDailyPricing } = await import('./agents/dynamic-pricing')
            result = await runDailyPricing()
            break
          }
          case 'feature-flags': {
            const { generateFeatureFlagsReport } = await import('./agents/feature-flags')
            result = await generateFeatureFlagsReport()
            break
          }
          case 'inventory-manager': {
            const { runDailyInventoryCheck } = await import('./agents/inventory-manager')
            result = await runDailyInventoryCheck()
            break
          }
          case 'localizer': {
            const { runWeeklyLocalization } = await import('./agents/localizer')
            result = await runWeeklyLocalization()
            break
          }
          case 'onboarding-flow': {
            const { sendOnboardingNudges } = await import('./agents/onboarding-flow')
            result = await sendOnboardingNudges()
            break
          }
          case 'revenue-analytics': {
            const { sendWeeklyRevenueEmail } = await import('./agents/revenue-analytics')
            await sendWeeklyRevenueEmail()
            result = { status: 'completed', agent: 'revenue-analytics' }
            break
          }
          case 'sustainability-tracker': {
            const { runQuarterlySustainability } = await import('./agents/sustainability-tracker')
            result = await runQuarterlySustainability()
            break
          }
          case 'browser-test': {
            result = { status: 'completed', message: 'Browser test agent — runs Playwright tests. Use npm test instead.' }
            break
          }
          default:
            res.writeHead(404, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Unknown agent: '+agentName+'. Available: newsletter-agent, competitor-ad-agent, seo-research-agent, seo-content-factory, telegram-orchestrator, social-content, sales-prospector, influencer-manager, division1-growth, division3-partnerships, market-researcher, sentiment-tracker, security-monitor, billing-agent, operator-scorer, revenue-splitter, contract-generator, doc-generator' }))
            return
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ agent: agentName, status: 'completed', result }))
      } catch (e: any) {
        logger.error(`Admin trigger ${agentName} failed: ${e.message}`)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ agent: agentName, status: 'failed', error: e.message }))
      }
      return
    }

    // Default 404
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found' }))
  })

  const PORT = parseInt(process.env.PORT || '3000')
  server.listen(PORT, () => {
    logger.info(`Safari Zetu Ops Engine HTTP server running on port ${PORT}`)
    logger.info(`Health: http://localhost:${PORT}/health`)
    logger.info(`Webhook: http://localhost:${PORT}/webhook/safari-zetu`)
  })

  logger.info('Safari Zetu Ops Engine is running')
  logger.info('Integrated: Mem0 memory, Chroma vector search, Browser-Use, Langfuse observability, Apollo.io')

  // Graceful shutdown
  const shutdown = () => {
    logger.info('Shutting down gracefully...')
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(1), 5000)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((error) => {
  logger.error('Fatal startup error:', error)
  process.exit(1)
})
