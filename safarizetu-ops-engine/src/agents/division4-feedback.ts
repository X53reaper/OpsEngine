import { callAgent, pool, logger } from '../services/ai-agent.service'
import { AGENT_PROMPTS } from './prompts'

// ── FEEDBACK TRIAGE AGENT ─────────────────────────────────────
// Receives raw feedback, categorizes it, extracts actionable items

export interface FeedbackItem {
  id: string
  source: string
  author_name?: string
  author_email?: string
  author_type?: string
  rating?: number
  title: string
  body: string
  page_url?: string
  screenshot_url?: string
}

export interface TriagedFeedback extends FeedbackItem {
  category: string
  severity: string
  sentiment: string
  ai_summary: string
  ai_actionable_items: Array<{
    action: string
    file_hint?: string
    priority: number
  }>
}

export async function triageFeedback(feedback: FeedbackItem): Promise<TriagedFeedback> {
  logger.info(`Triaging feedback: ${feedback.id}`)

  const result = await callAgent({
    agentName: 'feedback_triage',
    division: 'intelligence',
    model: 'light',  // DeepSeek V4 free
    systemPrompt: AGENT_PROMPTS.feedback_triage,
    userMessage: JSON.stringify({
      title: feedback.title,
      body: feedback.body,
      rating: feedback.rating,
      page_url: feedback.page_url,
      source: feedback.source,
      author_type: feedback.author_type
    }),
    triggerType: 'feedback_triage',
    triggerPayload: { feedback_id: feedback.id }
  })

  // Parse AI response
  let analysis: any
  try {
    // Extract JSON from response even if wrapped in markdown
    const jsonMatch = result.content.match(/\{[\s\S]*\}/)
    analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
  } catch {
    analysis = { category: 'other', severity: 'medium', sentiment: 'neutral' }
  }

  const triaged: TriagedFeedback = {
    ...feedback,
    category: analysis.category || 'other',
    severity: analysis.severity || 'medium',
    sentiment: analysis.sentiment || 'neutral',
    ai_summary: analysis.summary || feedback.body.substring(0, 200),
    ai_actionable_items: analysis.actionable_items || []
  }

  // Update feedback_log with AI analysis
  await pool.query(
    `UPDATE feedback_log SET
       category=$1, severity=$2, sentiment=$3, ai_summary=$4,
       ai_actionable_items=$5, status='triaged', updated_at=NOW()
     WHERE id=$6`,
    [triaged.category, triaged.severity, triaged.sentiment,
     triaged.ai_summary, JSON.stringify(triaged.ai_actionable_items),
     feedback.id]
  )

  logger.info(`Feedback ${feedback.id} triaged: ${triaged.category}/${triaged.severity}`)
  return triaged
}

// ── CODE FIX GENERATOR ────────────────────────────────────────
// Takes triaged feedback and generates a code fix

export interface FixResult {
  fix_id: string
  branch_name: string
  files_changed: string[]
  commit_hash: string
  fix_summary: string
  test_status: string
}

export async function generateCodeFix(feedback: TriagedFeedback): Promise<FixResult | null> {
  // Only attempt auto-fix for certain categories
  const autoFixable = ['bug', 'ux_issue', 'content_error', 'design']
  if (!autoFixable.includes(feedback.category)) {
    logger.info(`Feedback ${feedback.id} not auto-fixable (${feedback.category}) — skipping`)
    return null
  }

  // Only fix if severity is medium or higher
  if (feedback.severity === 'low') {
    logger.info(`Feedback ${feedback.id} is low severity — skipping auto-fix`)
    return null
  }

  logger.info(`Generating code fix for feedback: ${feedback.id}`)

  // Create fix log entry
  const { rows: [fixLog] } = await pool.query(
    `INSERT INTO code_fix_log (feedback_id, fix_type, branch_name, ai_model_used, fix_summary)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [feedback.id, feedback.category === 'bug' ? 'bug_fix' : 'ux_improvement',
     `fix/feedback-${feedback.id.substring(0, 8)}`, 'deepseek-v4-free', '']
  )

  try {
    // Ask AI to generate the fix
    const result = await callAgent({
      agentName: 'code_fix_generator',
      division: 'intelligence',
      model: 'heavy',  // Gemini Pro for code generation
      systemPrompt: AGENT_PROMPTS.code_fix_generator,
      userMessage: JSON.stringify({
        category: feedback.category,
        severity: feedback.severity,
        title: feedback.title,
        description: feedback.body,
        page_url: feedback.page_url,
        actionable_items: feedback.ai_actionable_items,
        ai_summary: feedback.ai_summary
      }),
      triggerType: 'code_fix_generation',
      triggerPayload: { feedback_id: feedback.id, fix_id: fixLog.id },
      maxTokens: 4000
    })

    // Parse the fix instructions
    let fixInstructions: any
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/)
      fixInstructions = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    } catch {
      fixInstructions = { files: [], summary: result.content.substring(0, 500) }
    }

    // Update fix log
    await pool.query(
      `UPDATE code_fix_log SET
         files_changed=$1, fix_summary=$2, ai_tokens_used=$3,
         ai_cost_usd=$4, test_status='pending'
       WHERE id=$5`,
      [fixInstructions.files || [], fixInstructions.summary || '',
       result.tokensUsed, result.costUsd, fixLog.id]
    )

    logger.info(`Code fix generated for ${feedback.id}: ${fixInstructions.files?.length || 0} files`)

    return {
      fix_id: fixLog.id,
      branch_name: `fix/feedback-${feedback.id.substring(0, 8)}`,
      files_changed: fixInstructions.files || [],
      commit_hash: '',
      fix_summary: fixInstructions.summary || '',
      test_status: 'pending'
    }

  } catch (error: any) {
    await pool.query(
      `UPDATE code_fix_log SET test_status='failed', fix_summary=$1 WHERE id=$2`,
      [`Fix generation failed: ${error.message}`, fixLog.id]
    )
    logger.error(`Code fix generation failed for ${feedback.id}:`, error.message)
    return null
  }
}

// ── FOUNDER NOTIFICATION ──────────────────────────────────────
// When a fix is ready, notify founder for review

export async function notifyFounderOfFix(fixId: string, feedback: TriagedFeedback): Promise<void> {
  const { rows: [fix] } = await pool.query(
    `SELECT * FROM code_fix_log WHERE id=$1`, [fixId]
  )

  if (!fix) return

  // Add to approval queue
  await pool.query(
    `INSERT INTO approval_queue (item_type, reference_id, title, preview, full_content, priority)
     VALUES ('proposal', $1, $2, $3, $4, $5)`,
    [fixId,
     `Code Fix Ready: ${feedback.title}`,
     `AI has generated a fix for: "${feedback.title}" (${feedback.category}/${feedback.severity})`,
     `Fix Summary:\n${fix.fix_summary}\n\nFiles Changed:\n${fix.files_changed?.join('\n')}\n\nFeedback:\n${feedback.body}`,
     feedback.severity === 'critical' ? 'urgent' : 'high']
  )

  logger.info(`Founder notified of fix ${fixId} for: ${feedback.title}`)
}
