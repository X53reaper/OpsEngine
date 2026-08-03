import dotenv from 'dotenv'
dotenv.config()

import { createServer } from 'http'
import { logger, isDbConnected } from './services/ai-agent.service'
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
    // Health check
    if (req.url === '/health' && req.method === 'GET') {
      const dbStatus = isDbConnected() ? 'connected' : 'mock-mode'
      const healthStatus = isDbConnected() ? 200 : 503
      res.writeHead(healthStatus, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        status: isDbConnected() ? 'ok' : 'degraded',
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
