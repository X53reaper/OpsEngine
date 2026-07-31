import { createHmac, timingSafeEqual } from 'crypto'
import { processIncomingFeedback } from '../pipeline/feedback-pipeline'
import { logger } from '../services/ai-agent.service'
import { verifyWebhookSignature } from './receiver'

// ── FEEDBACK WEBHOOK HANDLER ──────────────────────────────────
// Safari Zetu sends feedback here via POST /webhook/feedback

export async function handleFeedbackWebhook(
  event: string,
  data: any,
  signature: string,
  rawBody?: string
): Promise<{ success: boolean; message: string }> {
  logger.info(`Received feedback webhook: ${event}`)

  // Verify signature using raw body (not re-serialized)
  const bodyToVerify = rawBody || JSON.stringify({ event, data })
  if (!verifyWebhookSignature(bodyToVerify, signature)) {
    logger.warn('Invalid feedback webhook signature')
    return { success: false, message: 'Invalid signature' }
  }

  try {
    switch (event) {
      case 'review.submitted':
        // Tourist or operator left a review
        await processIncomingFeedback({
          id: data.id || `review-${Date.now()}`,
          source: data.source || 'tourist_review',
          author_name: data.author_name || data.user_name,
          author_email: data.author_email || data.user_email,
          author_type: data.author_type || 'tourist',
          rating: data.rating,
          title: data.title || `Review (${data.rating || '?'} stars)`,
          body: data.body || data.review_text || data.comment,
          page_url: data.page_url || data.listing_url,
          screenshot_url: data.screenshot_url
        })
        break

      case 'support_ticket':
        // Customer support ticket
        await processIncomingFeedback({
          id: data.id || `ticket-${Date.now()}`,
          source: 'support_ticket',
          author_name: data.customer_name,
          author_email: data.customer_email,
          author_type: data.customer_type || 'tourist',
          title: data.subject || data.title,
          body: data.message || data.body,
          page_url: data.page_url
        })
        break

      case 'bug_report':
        // Direct bug report from in-app feedback widget
        await processIncomingFeedback({
          id: data.id || `bug-${Date.now()}`,
          source: data.source || 'manual',
          author_name: data.reporter_name,
          author_email: data.reporter_email,
          author_type: 'visitor',
          title: data.title || 'Bug Report',
          body: data.description || data.body,
          page_url: data.url || data.page_url,
          screenshot_url: data.screenshot
        })
        break

      case 'app_store_review':
        // App Store / Play Store review (would need polling integration)
        await processIncomingFeedback({
          id: data.id || `appstore-${Date.now()}`,
          source: 'app_store',
          author_name: data.reviewer_name,
          author_type: 'tourist',
          rating: data.rating,
          title: data.title || `App Store Review (${data.rating}★)`,
          body: data.body || data.review_text
        })
        break

      case 'social_media':
        // Social media mention (would need monitoring integration)
        await processIncomingFeedback({
          id: data.id || `social-${Date.now()}`,
          source: 'social_media',
          author_name: data.author_name,
          author_type: 'unknown',
          title: `Social Media: ${data.platform || 'Unknown'}`,
          body: data.content || data.text,
          page_url: data.post_url
        })
        break

      default:
        logger.warn(`Unknown feedback event: ${event}`)
        return { success: false, message: `Unknown event: ${event}` }
    }

    logger.info(`Feedback webhook processed: ${event}`)
    return { success: true, message: 'Feedback processed' }

  } catch (error: any) {
    logger.error(`Feedback webhook failed: ${event}`, error.message)
    return { success: false, message: error.message }
  }
}
