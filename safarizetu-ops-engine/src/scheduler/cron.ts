import cron from 'node-cron'
import { pool, logger, fetchFromSafariZetu } from '../services/ai-agent.service'
import { generateSeoContent, sendOperatorActivation } from '../agents/division1-growth'
import { researchPartnership, draftPartnershipOutreach } from '../agents/division3-partnerships'
import { processPendingFeedback } from '../pipeline/feedback-pipeline'
import { runDailyProspecting } from '../agents/sales-prospector'
import { runDailyPricing } from '../agents/dynamic-pricing'
import { sendWeeklyRevenueEmail } from '../agents/revenue-analytics'
import { runDailyInventoryCheck } from '../agents/inventory-manager'
import { runDailySentimentCheck, sendWeeklySentimentReport } from '../agents/sentiment-tracker'
import { runMonthlyContentGeneration } from '../agents/social-content'
import { runMonthlyScoring } from '../agents/operator-scorer'
import { sendOnboardingNudges } from '../agents/onboarding-flow'
import { runHourlySecurityCheck } from '../agents/security-monitor'
import { runWeeklyTraining } from '../agents/chatbot-trainer'
import { runMonthlyRevenueSplitting } from '../agents/revenue-splitter'
import { initializeDefaultFlags } from '../agents/feature-flags'
import { runQuarterlyResearch } from '../agents/market-researcher'
import { runMonthlyInfluencerOutreach } from '../agents/influencer-manager'
import { runWeeklyLocalization } from '../agents/localizer'
import { runQuarterlySustainability } from '../agents/sustainability-tracker'
import { checkUsageLimits, runMonthlyBilling } from '../agents/billing-agent'
import { generateAllDocs } from '../agents/doc-generator'
import { callAgent } from '../services/ai-agent.service'
import { AGENT_PROMPTS } from '../agents/prompts'

export function startScheduler(): void {
  logger.info('Starting cron scheduler — All 4 Tiers (34 agents) included')

  // ── EVERY 5 MINUTES: Check new enquiries ─────────────────
  cron.schedule('*/5 * * * *', async () => {
    try {
      const { rows: enquiries } = await pool.query(
        `SELECT * FROM enquiry_log WHERE status = 'new' ORDER BY created_at DESC LIMIT 20`
      )
      if (enquiries.length > 0) {
        logger.info(`Found ${enquiries.length} new enquiries to process`)
      }
    } catch (error: any) {
      logger.error('Enquiry check failed:', error.message)
    }
  })

  // ── EVERY 15 MINUTES: Process incoming feedback ───────────
  cron.schedule('*/15 * * * *', async () => {
    try {
      await processPendingFeedback(5)  // Process up to 5 items per cycle
    } catch (error: any) {
      logger.error('Feedback processing failed:', error.message)
    }
  })

  // ── DAILY 9AM: Operator activation follow-ups ─────────────
  cron.schedule('0 9 * * *', async () => {
    try {
      // Find operators due for day3 (registered 3 days ago, still pending)
      const { rows: day3Operators } = await pool.query(
        `SELECT * FROM operator_activation_queue
         WHERE activation_stage = 'day1_sent'
         AND day1_sent_at < NOW() - INTERVAL '3 days'
         LIMIT 20`
      )
      for (const op of day3Operators) {
        await sendOperatorActivation(op, 'day3')
        await new Promise(r => setTimeout(r, 2000)) // Rate limit
      }

      // Find operators due for day7
      const { rows: day7Operators } = await pool.query(
        `SELECT * FROM operator_activation_queue
         WHERE activation_stage = 'day3_sent'
         AND day3_sent_at < NOW() - INTERVAL '4 days'
         LIMIT 20`
      )
      for (const op of day7Operators) {
        await sendOperatorActivation(op, 'day7')
        await new Promise(r => setTimeout(r, 2000))
      }
    } catch (error: any) {
      logger.error('Operator activation cron failed:', error.message)
    }
  })

  // ── TUESDAY & FRIDAY 8AM: SEO content generation ──────────
  cron.schedule('0 8 * * 2,5', async () => {
    const topics = [
      { topic: 'Best time to visit Victoria Falls Zimbabwe', destination: 'Victoria Falls', keywords: ['victoria falls', 'zimbabwe safari', 'best time to visit victoria falls'] },
      { topic: 'Hwange National Park safari guide for first timers', destination: 'Hwange', keywords: ['hwange national park', 'zimbabwe safari guide', 'hwange safari'] },
      { topic: 'Zimbabwe luxury safari lodges 2026', destination: 'Zimbabwe', keywords: ['zimbabwe luxury safari', 'luxury safari lodges zimbabwe'] }
    ]
    const topic = topics[Math.floor(Math.random() * topics.length)]
    try {
      await generateSeoContent(topic.topic, topic.destination, topic.keywords)
    } catch (error: any) {
      logger.error('SEO content generation failed:', error.message)
    }
  })

  // ── MONDAY 7AM: Weekly intelligence report ────────────────
  cron.schedule('0 7 * * 1', async () => {
    try {
      const { rows: [metrics] } = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as enquiries_this_week,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days') as enquiries_last_week,
          COUNT(*) FILTER (WHERE activation_stage = 'activated' AND updated_at > NOW() - INTERVAL '7 days') as operators_activated,
          SUM(cost_usd) FILTER (WHERE started_at > NOW() - INTERVAL '7 days') as total_cost
        FROM enquiry_log, operator_activation_queue, agent_run_log
      `)
      logger.info('Weekly metrics compiled', metrics)
    } catch (error: any) {
      logger.error('Weekly report cron failed:', error.message)
    }
  })

  // ── SUNDAY 6PM: Research unresearched partnerships + draft outreach ──
  cron.schedule('0 18 * * 0', async () => {
    try {
      const { rows: partners } = await pool.query(
        `SELECT * FROM partnership_pipeline WHERE status = 'identified' LIMIT 3`
      )
      for (const partner of partners) {
        await researchPartnership(partner)
        await new Promise(r => setTimeout(r, 5000))

        // After research, draft outreach email for approval
        try {
          const { rows: updated } = await pool.query(
            `SELECT * FROM partnership_pipeline WHERE id = $1 AND status = 'researched'`,
            [partner.id]
          )
          if (updated.length > 0) {
            await draftPartnershipOutreach(updated[0])
            logger.info(`Outreach drafted for ${partner.company_name} — queued for approval`)
          }
        } catch (draftErr: any) {
          logger.error(`Draft outreach failed for ${partner.company_name}: ${draftErr.message}`)
        }
      }
    } catch (error: any) {
      logger.error('Partnership research cron failed:', error.message)
    }
  })

  // ── TIER 1: DAILY 6AM — Sales Prospecting ─────────────────
  cron.schedule('0 6 * * *', async () => {
    try {
      logger.info('Running daily sales prospecting...')
      const result = await runDailyProspecting()
      logger.info(`Sales prospecting complete: ${result.total_leads} leads, ${result.outreach_sent} outreach sent`)
    } catch (error: any) {
      logger.error('Sales prospecting cron failed:', error.message)
    }
  })

  // ── TIER 1: DAILY 7AM — Dynamic Pricing ──────────────────
  cron.schedule('0 7 * * *', async () => {
    try {
      logger.info('Running daily pricing analysis...')
      const result = await runDailyPricing()
      logger.info(`Pricing analysis complete: ${result.recommendations} recommendations, ${result.alerts} alerts`)
    } catch (error: any) {
      logger.error('Dynamic pricing cron failed:', error.message)
    }
  })

  // ── TIER 1: MONDAY 9AM — Weekly Revenue Email ────────────
  cron.schedule('0 9 * * 1', async () => {
    try {
      logger.info('Sending weekly revenue email...')
      await sendWeeklyRevenueEmail()
      logger.info('Weekly revenue email sent')
    } catch (error: any) {
      logger.error('Weekly revenue email cron failed:', error.message)
    }
  })

  // ── TIER 1: DAILY 8AM — Competitor Price Monitoring ──────
  cron.schedule('0 8 * * *', async () => {
    try {
      logger.info('Monitoring competitor prices...')
      // Handled by dynamic pricing agent, but can add specific monitoring here
    } catch (error: any) {
      logger.error('Competitor monitoring cron failed:', error.message)
    }
  })

  // ── TIER 2: DAILY 5AM — Inventory Check ──────────────────
  cron.schedule('0 5 * * *', async () => {
    try {
      logger.info('Running daily inventory check...')
      const result = await runDailyInventoryCheck()
      logger.info(`Inventory check: ${result.items_checked} items, ${result.alerts} alerts`)
    } catch (error: any) {
      logger.error('Inventory check cron failed:', error.message)
    }
  })

  // ── TIER 2: DAILY 6:30AM — Sentiment Check ──────────────
  cron.schedule('30 6 * * *', async () => {
    try {
      logger.info('Running daily sentiment check...')
      const result = await runDailySentimentCheck()
      logger.info(`Sentiment check: ${result.reviews_analyzed} reviews, ${result.responses_needed} responses needed`)
    } catch (error: any) {
      logger.error('Sentiment check cron failed:', error.message)
    }
  })

  // ── TIER 2: DAILY 7:30AM — Onboarding Nudges ────────────
  cron.schedule('30 7 * * *', async () => {
    try {
      logger.info('Sending onboarding nudges...')
      const result = await sendOnboardingNudges()
      logger.info(`Onboarding nudges: ${result.nudges_sent} sent`)
    } catch (error: any) {
      logger.error('Onboarding nudges cron failed:', error.message)
    }
  })

  // ── TIER 2: WEDNESDAY 8AM — Weekly Sentiment Report ──────
  cron.schedule('0 8 * * 3', async () => {
    try {
      logger.info('Sending weekly sentiment report...')
      await sendWeeklySentimentReport()
      logger.info('Weekly sentiment report sent')
    } catch (error: any) {
      logger.error('Weekly sentiment report cron failed:', error.message)
    }
  })

  // ── TIER 2: 1ST OF MONTH 9AM — Content Calendar ─────────
  cron.schedule('0 9 1 * *', async () => {
    try {
      logger.info('Generating monthly content calendar...')
      const result = await runMonthlyContentGeneration()
      logger.info(`Content calendar: ${result.posts_generated} posts across ${result.platforms.join(', ')}`)
    } catch (error: any) {
      logger.error('Content calendar cron failed:', error.message)
    }
  })

  // ── TIER 2: 15TH OF MONTH 9AM — Operator Scoring ────────
  cron.schedule('0 9 15 * *', async () => {
    try {
      logger.info('Running monthly operator scoring...')
      const result = await runMonthlyScoring()
      logger.info(`Operator scoring: ${result.operators_scored} operators scored`)
    } catch (error: any) {
      logger.error('Operator scoring cron failed:', error.message)
    }
  })

  // ── TIER 3: EVERY HOUR — Security Check ──────────────────
  cron.schedule('0 * * * *', async () => {
    try {
      logger.info('Running hourly security check...')
      const result = await runHourlySecurityCheck()
      logger.info(`Security check: ${result.events_analyzed} events, ${result.threats_detected} threats`)
    } catch (error: any) {
      logger.error('Security check cron failed:', error.message)
    }
  })

  // ── TIER 3: TUESDAY 8PM — Chatbot Training ──────────────
  cron.schedule('0 20 * * 2', async () => {
    try {
      logger.info('Running weekly chatbot training...')
      const result = await runWeeklyTraining()
      logger.info(`Chatbot training: ${result.conversations_analyzed} conversations, ${result.new_training_examples} new examples`)
    } catch (error: any) {
      logger.error('Chatbot training cron failed:', error.message)
    }
  })

  // ── TIER 3: 1ST OF MONTH 10AM — Revenue Splitting ──────
  cron.schedule('0 10 1 * *', async () => {
    try {
      logger.info('Running monthly revenue splitting...')
      const result = await runMonthlyRevenueSplitting()
      logger.info(`Revenue splitting: ${result.partners_paid} partners, $${result.total_payouts.toFixed(2)} payouts`)
    } catch (error: any) {
      logger.error('Revenue splitting cron failed:', error.message)
    }
  })

  // ── TIER 3: STARTUP — Initialize Feature Flags ──────────
  initializeDefaultFlags().catch(err => {
    logger.error('Feature flags initialization failed:', err.message)
  })

  // ── TIER 4: 1ST OF QUARTER 11AM — Market Research ───────
  cron.schedule('0 11 1 1,4,7,10 *', async () => {
    try {
      logger.info('Running quarterly market research...')
      const result = await runQuarterlyResearch()
      logger.info(`Market research: ${result.markets_researched} markets, top: ${result.top_market}`)
    } catch (error: any) {
      logger.error('Market research cron failed:', error.message)
    }
  })

  // ── TIER 4: 15TH OF MONTH 11AM — Influencer Outreach ───
  cron.schedule('0 11 15 * *', async () => {
    try {
      logger.info('Running monthly influencer outreach...')
      const result = await runMonthlyInfluencerOutreach()
      logger.info(`Influencer outreach: ${result.influencers_discovered} discovered, ${result.outreach_sent} sent`)
    } catch (error: any) {
      logger.error('Influencer outreach cron failed:', error.message)
    }
  })

  // ── TIER 4: EVERY MONDAY 11AM — Localization Update ─────
  cron.schedule('0 11 * * 1', async () => {
    try {
      logger.info('Running weekly localization update...')
      const result = await runWeeklyLocalization()
      logger.info(`Localization: ${result.languages_active} languages, ${result.strings_translated} strings`)
    } catch (error: any) {
      logger.error('Localization cron failed:', error.message)
    }
  })

  // ── TIER 4: 1ST OF QUARTER 12PM — Sustainability Report ─
  cron.schedule('0 12 1 1,4,7,10 *', async () => {
    try {
      logger.info('Running quarterly sustainability report...')
      const result = await runQuarterlySustainability()
      logger.info(`Sustainability: ESG score ${result.esg_score}, ${result.improvements_recommended} improvements`)
    } catch (error: any) {
      logger.error('Sustainability cron failed:', error.message)
    }
  })

  // ── TIER 3: DAILY 4AM — Billing Usage Check ─────────────────
  cron.schedule('0 4 * * *', async () => {
    try {
      logger.info('Running daily billing usage check...')
      const { rows: tenants } = await pool.query(
        `SELECT DISTINCT operator_email FROM operator_activation_queue WHERE activation_stage = 'activated' LIMIT 50`
      )
      for (const tenant of tenants) {
        await checkUsageLimits(tenant.operator_email)
      }
      logger.info(`Billing usage check: ${tenants.length} tenants checked`)
    } catch (error: any) {
      logger.error('Billing usage check cron failed:', error.message)
    }
  })

  // ── TIER 3: 1ST OF MONTH 2AM — Monthly Billing ─────────────
  cron.schedule('0 2 1 * *', async () => {
    try {
      logger.info('Running monthly billing...')
      const result = await runMonthlyBilling()
      logger.info(`Monthly billing: ${result.invoices_generated} invoices, $${result.total_revenue.toFixed(2)} revenue`)
    } catch (error: any) {
      logger.error('Monthly billing cron failed:', error.message)
    }
  })

  // ── TIER 2: SUNDAY 3AM — Weekly Doc Regeneration ──────────
  cron.schedule('0 3 * * 0', async () => {
    try {
      logger.info('Regenerating documentation...')
      const result = await generateAllDocs()
      logger.info(`Docs regenerated: ${result.api_docs} API docs, ${result.guides} guides, ${result.faqs} FAQs, ${result.help_articles} help articles`)
    } catch (error: any) {
      logger.error('Doc regeneration cron failed:', error.message)
    }
  })

  // ── TIER 2: MONDAY 8AM — Weekly Intelligence Report ────────
  cron.schedule('0 8 * * 1', async () => {
    try {
      logger.info('Generating weekly intelligence report...')
      const { rows: [metrics] } = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as enquiries_this_week,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days') as enquiries_last_week,
          COUNT(*) FILTER (WHERE activation_stage = 'activated' AND updated_at > NOW() - INTERVAL '7 days') as operators_activated,
          SUM(cost_usd) FILTER (WHERE started_at > NOW() - INTERVAL '7 days') as total_cost
        FROM enquiry_log, operator_activation_queue, agent_run_log
      `)

      const result = await callAgent({
        agentName: 'intelligence_reporter',
        division: 'operations',
        model: 'light',
        systemPrompt: AGENT_PROMPTS.weekly_intelligence_report,
        userMessage: `Weekly metrics: ${JSON.stringify(metrics)}`,
        triggerType: 'scheduled',
        triggerPayload: metrics,
      })

      logger.info(`Weekly intelligence report generated`)
    } catch (error: any) {
      logger.error('Weekly intelligence report cron failed:', error.message)
    }
  })

  logger.info('All cron jobs scheduled (All 4 Tiers — 34 agents)')
}
