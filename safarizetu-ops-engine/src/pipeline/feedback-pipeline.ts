import { pool, logger, sendEmail } from '../services/ai-agent.service'
import { triageFeedback, generateCodeFix, notifyFounderOfFix, FeedbackItem } from '../agents/division4-feedback'
import { generateTestPlan, runBrowserTests, getTestVerdict } from '../agents/browser-test'

// ── FEEDBACK PIPELINE ORCHESTRATOR ────────────────────────────
// The complete closed-loop: feedback → triage → fix → test → review → deploy

export async function processIncomingFeedback(feedback: FeedbackItem): Promise<void> {
  logger.info(`=== FEEDBACK PIPELINE START: ${feedback.id} ===`)

  // Step 1: Store raw feedback
  await pool.query(
    `INSERT INTO feedback_log (id, source, source_id, author_name, author_email, author_type, rating, title, body, page_url, screenshot_url, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'new')`,
    [feedback.id, feedback.source, null, feedback.author_name, feedback.author_email,
     feedback.author_type, feedback.rating, feedback.title, feedback.body,
     feedback.page_url, feedback.screenshot_url]
  )

  // Step 2: AI triage — categorise and extract actionable items
  const triaged = await triageFeedback(feedback)

  // Step 3: If positive feedback, log it and stop
  if (triaged.category === 'positive' || triaged.sentiment === 'positive') {
    logger.info(`Positive feedback — no action needed: ${feedback.id}`)
    await pool.query(
      `UPDATE feedback_log SET status='dismissed', ai_summary=$1 WHERE id=$2`,
      [`Positive feedback: ${triaged.ai_summary}`, feedback.id]
    )
    return
  }

  // Step 4: If auto-fixable, attempt code fix
  const autoFixCategories = ['bug', 'ux_issue', 'content_error', 'design']
  if (autoFixCategories.includes(triaged.category) && triaged.severity !== 'low') {
    logger.info(`Attempting auto-fix for: ${feedback.id}`)

    const fix = await generateCodeFix(triaged)

    if (fix) {
      // Step 5: Run browser tests against the fix
      logger.info(`Running browser tests for fix: ${fix.fix_id}`)

      const testPlan = await generateTestPlan(
        fix.fix_id,
        feedback.page_url || 'http://localhost:3000',
        fix.fix_summary
      )

      const testResults = await runBrowserTests(fix.fix_id, testPlan)
      const verdict = await getTestVerdict(fix.fix_id)

      // Step 6: Update fix with test results
      await pool.query(
        `UPDATE code_fix_log SET
           test_results=$1, test_status=$2, commit_hash=$3
         WHERE id=$4`,
        [JSON.stringify(testResults),
         verdict.all_passed ? 'passed' : 'failed',
         '',  // commit hash would be set after actual git commit
         fix.fix_id]
      )

      // Step 7: If tests passed, notify founder for review
      if (verdict.ready_for_review) {
        logger.info(`All tests passed — notifying founder for review`)

        await notifyFounderOfFix(fix.fix_id, triaged)

        // Send email notification to founder
        await sendEmail(
          process.env.FOUNDER_EMAIL || 'marshal@safarizetu.com',
          `[ACTION REQUIRED] Code Fix Ready: ${triaged.title}`,
          `
          <h2>AI-Generated Fix Ready for Review</h2>
          <p><strong>Feedback:</strong> ${triaged.title}</p>
          <p><strong>Category:</strong> ${triaged.category} | <strong>Severity:</strong> ${triaged.severity}</p>
          <p><strong>Summary:</strong> ${fix.fix_summary}</p>
          <p><strong>Tests:</strong> ${verdict.passed}/${verdict.total_tests} passed</p>
          <p><strong>Branch:</strong> ${fix.branch_name}</p>
          <hr>
          <p>Review this fix in the Ops Engine dashboard:</p>
          <p><a href="http://localhost:3002">Open Dashboard</a></p>
          `
        )
      } else {
        logger.info(`Tests failed — fix needs revision`)
        await pool.query(
          `UPDATE code_fix_log SET test_status='failed' WHERE id=$1`,
          [fix.fix_id]
        )
      }
    }
  }

  // Step 8: If not auto-fixable, create task for manual developer action
  else {
    logger.info(`Feedback requires manual attention: ${feedback.id}`)

    await pool.query(
      `INSERT INTO approval_queue (item_type, reference_id, title, preview, full_content, priority)
       VALUES ('report', $1, $2, $3, $4, $5)`,
      [feedback.id,
       `Manual Fix Needed: ${triaged.title}`,
       `${triaged.category}/${triaged.severity}: ${triaged.ai_summary}`,
       `Actionable Items:\n${triaged.ai_actionable_items.map(i => `- ${i.action}`).join('\n')}`,
       triaged.severity === 'critical' ? 'urgent' : 'high']
    )
  }

  logger.info(`=== FEEDBACK PIPELINE COMPLETE: ${feedback.id} ===`)
}

// ── BATCH PROCESS FEEDBACK ────────────────────────────────────
// For processing multiple feedback items at once

export async function processPendingFeedback(limit: number = 10): Promise<void> {
  const { rows: pending } = await pool.query(
    `SELECT * FROM feedback_log WHERE status = 'new' ORDER BY
       CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
       created_at ASC
     LIMIT $1`,
    [limit]
  )

  logger.info(`Processing ${pending.length} pending feedback items`)

  for (const item of pending) {
    try {
      await processIncomingFeedback({
        id: item.id,
        source: item.source,
        author_name: item.author_name,
        author_email: item.author_email,
        author_type: item.author_type,
        rating: item.rating,
        title: item.title,
        body: item.body,
        page_url: item.page_url,
        screenshot_url: item.screenshot_url
      })
    } catch (error: any) {
      logger.error(`Failed to process feedback ${item.id}:`, error.message)
    }
  }
}
