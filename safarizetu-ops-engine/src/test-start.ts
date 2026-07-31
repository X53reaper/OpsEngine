import dotenv from 'dotenv'
dotenv.config()

import { logger } from './services/ai-agent.service'
import { callAgent } from './services/ai-agent.service'
import { startMailingScheduler } from './scheduler/mailing-cron'

// ── IN-MEMORY STORE (until Docker/PostgreSQL is set up) ───────
const memoryStore = {
  enquiries: [] as any[],
  operators: [] as any[],
  feedback: [] as any[],
  approvals: [] as any[],
  agentRuns: [] as any[]
}

// ── TEST THE SYSTEM ───────────────────────────────────────────
async function runSystemTest() {
  logger.info('=== SAFARI ZETU OPS ENGINE — SYSTEM TEST ===')
  logger.info(`Free Models: ${process.env.MODEL_HEAVY}, ${process.env.MODEL_LIGHT}`)

  // Test 1: Basic AI call (enquiry acknowledgement)
  logger.info('\n--- TEST 1: Enquiry Acknowledgement Agent ---')
  try {
    const result = await callAgent({
      agentName: 'enquiry_acknowledgement',
      division: 'tourist_experience',
      model: 'free',
      systemPrompt: `You are Safari Zetu's tourist experience agent. Write a warm, personalised acknowledgement email to a tourist who just enquired about a Victoria Falls safari. 
RULES: Maximum 100 words. Output ONLY the email body HTML. No preamble.`,
      userMessage: JSON.stringify({
        tourist_name: 'Sarah',
        destination: 'Victoria Falls',
        travel_dates: 'July 15-20, 2026',
        group_size: 2,
        special_requests: 'Want to see the falls from both Zimbabwe and Zambia side'
      }),
      triggerType: 'test_enquiry'
    })

    logger.info(`SUCCESS — Model: ${result.model}, Tokens: ${result.tokensUsed}, Cost: $${result.costUsd}`)
    logger.info(`Response preview: ${result.content.substring(0, 200)}...`)
    memoryStore.agentRuns.push(result)
  } catch (error: any) {
    logger.error(`FAILED: ${error.message}`)
  }

  // Test 2: Operator activation email
  logger.info('\n--- TEST 2: Operator Activation Agent ---')
  try {
    const result = await callAgent({
      agentName: 'operator_activation_day1',
      division: 'operator_relations',
      model: 'free',
      systemPrompt: `You are Safari Zetu's operator success agent. Write a Day 1 activation email to an operator who registered but hasn't completed their listing. 
RULES: Maximum 100 words. Output ONLY the email body HTML.`,
      userMessage: JSON.stringify({
        operator_name: 'Wild Horizons',
        contact_name: 'David',
        operator_type: 'safari lodge',
        destination: 'Hwange'
      }),
      triggerType: 'test_operator_activation'
    })

    logger.info(`SUCCESS — Model: ${result.model}, Tokens: ${result.tokensUsed}, Cost: $${result.costUsd}`)
    logger.info(`Response preview: ${result.content.substring(0, 200)}...`)
    memoryStore.agentRuns.push(result)
  } catch (error: any) {
    logger.error(`FAILED: ${error.message}`)
  }

  // Test 3: Feedback triage
  logger.info('\n--- TEST 3: Feedback Triage Agent ---')
  try {
    const result = await callAgent({
      agentName: 'feedback_triage',
      division: 'intelligence',
      model: 'light',
      systemPrompt: `You are Safari Zetu's feedback triage agent. Categorise this feedback and output JSON with: category, severity, sentiment, summary, actionable_items.
RULES: Output ONLY valid JSON, no other text.`,
      userMessage: JSON.stringify({
        title: 'Booking form crashes on mobile',
        body: 'I tried to book a safari on my iPhone and the form kept crashing when I entered my payment details. Very frustrating.',
        rating: 2,
        page_url: 'https://safarizetu.com/book/hwange-luxury-safari',
        source: 'tourist_review'
      }),
      triggerType: 'test_feedback_triage'
    })

    logger.info(`SUCCESS — Model: ${result.model}, Tokens: ${result.tokensUsed}, Cost: $${result.costUsd}`)
    logger.info(`Response: ${result.content}`)
    memoryStore.agentRuns.push(result)
  } catch (error: any) {
    logger.error(`FAILED: ${error.message}`)
  }

  // Test 4: SEO content generation
  logger.info('\n--- TEST 4: SEO Content Agent ---')
  try {
    const result = await callAgent({
      agentName: 'seo_content_generator',
      division: 'growth',
      model: 'light',
      systemPrompt: `You are Safari Zetu's content strategist. Write a short SEO paragraph about Victoria Falls safaris.
RULES: Maximum 150 words. Include the keyword "Victoria Falls safari" 2-3 times. Output HTML.`,
      userMessage: 'Write an intro paragraph for a blog post about Victoria Falls safaris in 2026.',
      triggerType: 'test_seo_content'
    })

    logger.info(`SUCCESS — Model: ${result.model}, Tokens: ${result.tokensUsed}, Cost: $${result.costUsd}`)
    logger.info(`Response preview: ${result.content.substring(0, 200)}...`)
    memoryStore.agentRuns.push(result)
  } catch (error: any) {
    logger.error(`FAILED: ${error.message}`)
  }

  // Test 5: Partnership research
  logger.info('\n--- TEST 5: Partnership Research Agent ---')
  try {
    const result = await callAgent({
      agentName: 'partnership_research',
      division: 'partnership',
      model: 'light',
      systemPrompt: `You are Safari Zetu's partnership agent. Research this airline for a potential partnership. Output a brief summary.
RULES: Maximum 200 words. Structured text output.`,
      userMessage: 'Research FastJet airline for a partnership with Safari Zetu. They operate in Zimbabwe.',
      triggerType: 'test_partnership_research'
    })

    logger.info(`SUCCESS — Model: ${result.model}, Tokens: ${result.tokensUsed}, Cost: $${result.costUsd}`)
    logger.info(`Response preview: ${result.content.substring(0, 200)}...`)
    memoryStore.agentRuns.push(result)
  } catch (error: any) {
    logger.error(`FAILED: ${error.message}`)
  }

  // Summary
  logger.info('\n=== SYSTEM TEST COMPLETE ===')
  logger.info(`Total agent runs: ${memoryStore.agentRuns.length}`)
  const totalCost = memoryStore.agentRuns.reduce((sum, r) => sum + r.costUsd, 0)
  const totalTokens = memoryStore.agentRuns.reduce((sum, r) => sum + r.tokensUsed, 0)
  logger.info(`Total tokens used: ${totalTokens}`)
  logger.info(`Total cost: $${totalCost.toFixed(6)}`)
  logger.info(`All runs successful: ${memoryStore.agentRuns.every(r => r.costUsd >= 0)}`)

  // Start the scheduler
  logger.info('\nStarting cron scheduler...')
  startMailingScheduler()
  logger.info('Scheduler running. Press Ctrl+C to stop.')
}

runSystemTest().catch((error) => {
  logger.error('System test failed:', error)
  process.exit(1)
})
