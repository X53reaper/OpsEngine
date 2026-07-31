import cron from 'node-cron'
import { pool, logger, sendEmail, callAgent } from '../services/ai-agent.service'
import { AGENT_PROMPTS } from '../agents/prompts'

// ── MAILING LIST AUTOMATION ──────────────────────────────────
// Pulls subscribers from Safari Zetu, generates personalised content, sends

export function startMailingScheduler(): void {
  logger.info('Starting mailing list scheduler')

  // ── WEEKLY NEWSLETTER — Every Wednesday 10AM ──────────────
  cron.schedule('0 10 * * 3', async () => {
    try {
      logger.info('Generating weekly newsletter')

      // Pull active subscribers (tourists who booked or enquired in last 90 days)
      const { rows: subscribers } = await pool.query(`
        SELECT DISTINCT tourist_email, tourist_name, destination
        FROM enquiry_log
        WHERE created_at > NOW() - INTERVAL '90 days'
        AND status IN ('completed', 'operator_responded')
        LIMIT 500
      `)

      if (subscribers.length === 0) {
        logger.info('No subscribers found for newsletter')
        return
      }

      // Generate newsletter content
      const result = await callAgent({
        agentName: 'weekly_newsletter',
        division: 'growth',
        model: 'light',
        systemPrompt: `You are the Safari Zetu content agent. Write a weekly newsletter for tourists who have previously enquired about or booked Zimbabwe safaris.

TONE: Warm, inspiring, informative. Not sales-y.

STRUCTURE:
1. Personalised greeting (use first name if available)
2. One destination spotlight (rotating each week)
3. One travel tip or seasonal advice
4. One operator success story or new listing
5. Call to action to browse or book

RULES:
- Maximum 300 words
- HTML formatted
- Include "Unsubscribe" link at bottom
- Output ONLY the email body HTML`,
        userMessage: `Write a weekly newsletter for ${subscribers.length} subscribers. This week feature Victoria Falls as the destination spotlight. Current month: ${new Date().toLocaleString('default', { month: 'long' })}.`,
        triggerType: 'weekly_newsletter'
      })

      // Send to all subscribers (batch with rate limiting)
      let sent = 0
      let failed = 0

      for (const sub of subscribers) {
        try {
          // Personalise greeting
          const personalisedContent = result.content.replace(
            /{{name}}/g,
            sub.tourist_name?.split(' ')[0] || 'there'
          )

          await sendEmail(
            sub.tourist_email,
            `Safari Zetu Weekly — ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`,
            personalisedContent
          )

          sent++

          // Rate limit: 1 email per 2 seconds
          await new Promise(r => setTimeout(r, 2000))
        } catch (error: any) {
          failed++
          logger.error(`Newsletter send failed for ${sub.tourist_email}:`, error.message)
        }
      }

      logger.info(`Weekly newsletter sent: ${sent} delivered, ${failed} failed`)

      // Log the campaign
      await pool.query(
        `INSERT INTO agent_run_log (agent_name, division, trigger_type, trigger_payload, status, result_summary, tokens_used, model_used, cost_usd, completed_at)
         VALUES ('weekly_newsletter', 'growth', 'scheduled', $1, 'success', $2, $3, $4, $5, NOW())`,
        [JSON.stringify({ total: subscribers.length, sent, failed }),
         `${sent} sent, ${failed} failed`,
         result.tokensUsed, result.model, result.costUsd]
      )

    } catch (error: any) {
      logger.error('Weekly newsletter cron failed:', error.message)
    }
  })

  // ── MONTHLY RE-ENGAGEMENT — 1st of each month ─────────────
  // Targets tourists who enquired but never booked
  cron.schedule('0 9 1 * *', async () => {
    try {
      logger.info('Running monthly re-engagement campaign')

      const { rows: dormant } = await pool.query(`
        SELECT DISTINCT tourist_email, tourist_name, destination, created_at
        FROM enquiry_log
        WHERE status IN ('new', 'acknowledged')
        AND created_at < NOW() - INTERVAL '30 days'
        AND created_at > NOW() - INTERVAL '180 days'
        LIMIT 200
      `)

      if (dormant.length === 0) {
        logger.info('No dormant leads for re-engagement')
        return
      }

      const result = await callAgent({
        agentName: 'reengagement_email',
        division: 'growth',
        model: 'light',
        systemPrompt: `You are the Safari Zetu re-engagement agent. Write a warm, non-pushy follow-up to someone who enquired about a Zimbabwe safari but never booked.

TONE: Friendly, helpful, not desperate. Add genuine value.

STRUCTURE:
1. Warm re-opener referencing their original destination
2. One useful update (new operator, seasonal tip, price change)
3. Subtle reminder that Safari Zetu is there when they're ready
4. Soft CTA — "Reply if you'd like help planning"

RULES:
- Maximum 150 words
- HTML formatted
- Never use "We haven't heard from you" or guilt language
- Output ONLY the email body HTML`,
        userMessage: `Write re-engagement email to ${dormant.length} tourists who enquired about ${[...new Set(dormant.map((d: any) => d.destination))].join(', ')} but never booked.`,
        triggerType: 'monthly_reengagement'
      })

      let sent = 0
      for (const sub of dormant) {
        try {
          await sendEmail(
            sub.tourist_email,
            `Still thinking about ${sub.destination || 'a Zimbabwe safari'}?`,
            result.content
          )
          sent++
          await new Promise(r => setTimeout(r, 2000))
        } catch { /* skip failed */ }
      }

      logger.info(`Re-engagement sent: ${sent}/${dormant.length}`)

    } catch (error: any) {
      logger.error('Re-engagement cron failed:', error.message)
    }
  })

  // ── OPERATOR MONTHLY DIGEST — 15th of each month ───────────
  // Keeps operators engaged with platform updates
  cron.schedule('0 9 15 * *', async () => {
    try {
      logger.info('Running operator monthly digest')

      const { rows: operators } = await pool.query(`
        SELECT operator_email, operator_name, destination
        FROM operator_activation_queue
        WHERE activation_stage = 'activated'
        LIMIT 500
      `)

      if (operators.length === 0) return

      const result = await callAgent({
        agentName: 'operator_monthly_digest',
        division: 'operator_relations',
        model: 'light',
        systemPrompt: `You are the Safari Zetu operator relations agent. Write a monthly digest email to active safari operators.

TONE: Professional, colleague-to-colleague. Useful info, not marketing fluff.

STRUCTURE:
1. Quick platform stats (enquiries this month, top destinations)
2. One tip to improve their listing visibility
3. One seasonal demand insight
4. Reminder to keep availability updated

RULES:
- Maximum 200 words
- HTML formatted
- Output ONLY the email body HTML`,
        userMessage: `Write monthly digest for ${operators.length} active operators. Current month: ${new Date().toLocaleString('default', { month: 'long' })}.`,
        triggerType: 'operator_monthly_digest'
      })

      let sent = 0
      for (const op of operators) {
        try {
          await sendEmail(op.operator_email, 'Safari Zetu Operator Monthly Digest', result.content)
          sent++
          await new Promise(r => setTimeout(r, 2000))
        } catch { /* skip */ }
      }

      logger.info(`Operator digest sent: ${sent}/${operators.length}`)

    } catch (error: any) {
      logger.error('Operator digest cron failed:', error.message)
    }
  })

  logger.info('Mailing list scheduler started — 3 campaigns active')
}
