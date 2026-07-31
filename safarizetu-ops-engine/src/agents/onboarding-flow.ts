import { callAgent, logger, sendEmail } from '../services/ai-agent.service'
import { storeMemory, retrieveMemory } from '../services/memory.service'
import { startTrace, endTrace } from '../services/observability.service'
import { wrapEmail, sectionHeader, bodyText } from '../services/email-templates'

// ── AUTOMATED ONBOARDING FLOW ──────────────────────────────────
// Skills: Rasa (conversational AI), Dify (visual builder)
// Guided onboarding for new operators and tourists
// Step-by-step chatbot, progress tracking, completion nudges

interface OnboardingUser {
  user_id: string
  user_type: 'tourist' | 'operator'
  name: string
  email: string
  current_step: number
  total_steps: number
  steps_completed: string[]
  started_at: Date
  last_active_at: Date
}

interface OnboardingStep {
  step_number: number
  step_name: string
  step_description: string
  required: boolean
  estimated_time_minutes: number
}

interface OnboardingResponse {
  message: string
  current_step: number
  total_steps: number
  next_action: string
  progress_pct: number
}

// ── ONBOARDING STEPS ───────────────────────────────────────────
const TOURIST_STEPS: OnboardingStep[] = [
  { step_number: 1, step_name: 'Welcome', step_description: 'Account created successfully', required: true, estimated_time_minutes: 0 },
  { step_number: 2, step_name: 'Profile Setup', step_description: 'Add your travel preferences and interests', required: true, estimated_time_minutes: 3 },
  { step_number: 3, step_name: 'Browse Safaris', step_description: 'Explore available safari experiences', required: false, estimated_time_minutes: 5 },
  { step_number: 4, step_name: 'First Booking', step_description: 'Make your first safari booking', required: false, estimated_time_minutes: 10 },
  { step_number: 5, step_name: 'Complete', step_description: 'You\'re all set!', required: true, estimated_time_minutes: 0 },
]

const OPERATOR_STEPS: OnboardingStep[] = [
  { step_number: 1, step_name: 'Welcome', step_description: 'Account created successfully', required: true, estimated_time_minutes: 0 },
  { step_number: 2, step_name: 'Business Profile', step_description: 'Add your company details and location', required: true, estimated_time_minutes: 5 },
  { step_number: 3, step_name: 'List Experiences', step_description: 'Create your first safari listing', required: true, estimated_time_minutes: 15 },
  { step_number: 4, step_name: 'Pricing & Availability', step_description: 'Set your prices and availability', required: true, estimated_time_minutes: 10 },
  { step_number: 5, step_name: 'Payment Setup', step_description: 'Connect your payment method', required: true, estimated_time_minutes: 5 },
  { step_number: 6, step_name: 'Go Live', step_description: 'Your listings are now visible to travelers', required: true, estimated_time_minutes: 0 },
]

// ── START ONBOARDING ───────────────────────────────────────────
export async function startOnboarding(
  userId: string,
  userType: 'tourist' | 'operator',
  name: string,
  email: string
): Promise<OnboardingResponse> {
  const steps = userType === 'tourist' ? TOURIST_STEPS : OPERATOR_STEPS

  const user: OnboardingUser = {
    user_id: userId,
    user_type: userType,
    name,
    email,
    current_step: 1,
    total_steps: steps.length,
    steps_completed: [],
    started_at: new Date(),
    last_active_at: new Date()
  }

  // Store in memory
  await storeMemory(userId, 'conversation_context', 'onboarding', JSON.stringify(user))

  const welcomeMessage = userType === 'tourist'
    ? `Welcome to Safari Zetu, ${name}! 🌍 I'm your onboarding assistant. Let's set up your account in just a few steps so you can start exploring amazing safari experiences. Ready to begin?`
    : `Welcome to Safari Zetu, ${name}! 🏢 I'm your onboarding guide. Let's get your business set up so you can start receiving bookings. This will only take about 30 minutes. Shall we start?`

  return {
    message: welcomeMessage,
    current_step: 1,
    total_steps: steps.length,
    next_action: 'profile_setup',
    progress_pct: 0
  }
}

// ── HANDLE ONBOARDING MESSAGE ──────────────────────────────────
export async function handleOnboardingMessage(
  userId: string,
  message: string
): Promise<OnboardingResponse> {
  const traceId = startTrace('onboarding_bot', 'mimo-v2.5-free', { user_id: userId })

  // Retrieve user state
  const memoryData = await retrieveMemory(userId, 'conversation_context')
  const onboardingEntry = memoryData.find(m => m.key === 'onboarding')
  let user: OnboardingUser

  try {
    user = JSON.parse(onboardingEntry?.value || '{}')
  } catch {
    user = {
      user_id: userId,
      user_type: 'tourist',
      name: 'User',
      email: '',
      current_step: 1,
      total_steps: 5,
      steps_completed: [],
      started_at: new Date(),
      last_active_at: new Date()
    }
  }

  const steps = user.user_type === 'tourist' ? TOURIST_STEPS : OPERATOR_STEPS
  const currentStep = steps.find(s => s.step_number === user.current_step)

  // Process the message
  const result = await callAgent({
    agentName: 'onboarding_guide',
    division: 'customer_success',
    model: 'light',
    systemPrompt: `You are an onboarding assistant for Safari Zetu.
Help the user complete their ${user.user_type} onboarding.

Current step: ${user.current_step}/${user.total_steps} — ${currentStep?.step_name || 'Unknown'}
Step description: ${currentStep?.step_description || ''}
User name: ${user.name}
Completed steps: ${user.steps_completed.join(', ') || 'None yet'}

Guidelines:
- Be friendly, encouraging, and helpful
- Guide them through the current step
- If they seem stuck, offer alternatives
- If they want to skip, note it's optional or required
- Always end with a clear next step or question
- Use emojis to make it engaging

The user said: "${message}"

Respond with guidance for their current step, then ask what they'd like to do next.`,
    userMessage: message,
    triggerType: 'webhook',
    triggerPayload: { user_id: userId, step: user.current_step }
  })

  // Simulate step completion based on message content
  const messageLower = message.toLowerCase()
  if (messageLower.includes('done') || messageLower.includes('next') || messageLower.includes('yes') || messageLower.includes('sure')) {
    if (!user.steps_completed.includes(String(user.current_step))) {
      user.steps_completed.push(String(user.current_step))
    }
    if (user.current_step < user.total_steps) {
      user.current_step++
    }
  }

  // Update memory
  user.last_active_at = new Date()
  await storeMemory(userId, 'conversation_context', 'onboarding', JSON.stringify(user))

  const progressPct = (user.steps_completed.length / user.total_steps) * 100

  endTrace(traceId, { input_tokens: 0, output_tokens: 0, cost_usd: 0, latency_ms: 0, status: 'success' })

  return {
    message: result.content,
    current_step: user.current_step,
    total_steps: user.total_steps,
    next_action: user.current_step >= user.total_steps ? 'completed' : steps[user.current_step - 1]?.step_name || 'continue',
    progress_pct: progressPct
  }
}

// ── SEND COMPLETION CELEBRATION ────────────────────────────────
export async function sendCompletionEmail(user: OnboardingUser): Promise<void> {
  const isOperator = user.user_type === 'operator'

  const html = wrapEmail(
    sectionHeader(isOperator ? 'Your Business is Live!' : 'Welcome to Safari Zetu!') +
    `
    <p>Dear ${user.name},</p>

    <p>Congratulations! You've completed your onboarding journey.</p>

    ${isOperator ? `
      <h3>What's Next?</h3>
      <ul>
        <li>✅ Your listings are now visible to travelers worldwide</li>
        <li>📱 You'll receive booking notifications via email and WhatsApp</li>
        <li>💰 Track your earnings in the operator dashboard</li>
        <li>⭐ Respond quickly to inquiries to boost your ranking</li>
        <li>📊 Check your monthly performance scorecard</li>
      </ul>

      <p><strong>Pro Tip:</strong> Operators who respond within 2 hours get 3x more bookings!</p>
    ` : `
      <h3>What's Next?</h3>
      <ul>
        <li>🌍 Browse our curated safari experiences</li>
        <li>📅 Book your dream safari adventure</li>
        <li>💬 Chat with us anytime for personalized recommendations</li>
        <li>🎁 Join our loyalty program for exclusive deals</li>
      </ul>

      <p><strong>First Booking Discount:</strong> Use code WELCOME15 for 15% off your first safari!</p>
    `}

    <p>We're here to help you every step of the way. Reply to this email anytime!</p>

    <p>Happy ${isOperator ? 'business building' : 'safari planning'}!</p>
    <p>The Safari Zetu Team</p>`,
    { palette: 'midnight' }
  )

  await sendEmail(user.email, isOperator ? 'Your Business is Live! — Safari Zetu' : 'Welcome to Safari Zetu! 🌍', html)
  logger.info(`Onboarding completion email sent to ${user.email}`)
}

// ── SEND ONBOARDING NUDGE ──────────────────────────────────────
export async function sendOnboardingNudge(user: OnboardingUser): Promise<void> {
  const steps = user.user_type === 'tourist' ? TOURIST_STEPS : OPERATOR_STEPS
  const currentStep = steps.find(s => s.step_number === user.current_step)
  const progressPct = (user.steps_completed.length / user.total_steps) * 100

  const html = wrapEmail(
    sectionHeader("Don't Leave Us Hanging!") +
    `
    <p>Dear ${user.name},</p>

    <p>You're ${progressPct.toFixed(0)}% through your onboarding! Just a few more steps to go.</p>

    <h3>Current Step: ${currentStep?.step_name || 'Unknown'}</h3>
    <p>${currentStep?.step_description || ''}</p>

    <h3>Progress</h3>
    <div style="background: #f0f0f0; border-radius: 10px; overflow: hidden; height: 20px;">
      <div style="background: #2c5530; height: 100%; width: ${progressPct}%; text-align: center; color: white; line-height: 20px;">
        ${progressPct.toFixed(0)}%
      </div>
    </div>

    <p><a href="https://safarizetu.com/onboarding">Continue Where You Left Off →</a></p>

    <p>Need help? Reply to this email and we'll assist you personally.</p>`,
    { palette: 'midnight' }
  )

  await sendEmail(user.email, `Complete Your Onboarding — ${progressPct.toFixed(0)}% Done`, html)
  logger.info(`Onboarding nudge sent to ${user.email}`)
}

// ── DAILY ONBOARDING NUDGES ────────────────────────────────────
export async function sendOnboardingNudges(): Promise<{
  nudges_sent: number
  completions: number
}> {
  const traceId = startTrace('onboarding_nudges', 'mimo-v2.5-free')

  // Simulate users who need nudges
  const incompleteUsers: OnboardingUser[] = [
    {
      user_id: 'user-1', user_type: 'tourist', name: 'John Smith', email: 'john@example.com',
      current_step: 3, total_steps: 5, steps_completed: ['1', '2'],
      started_at: new Date(Date.now() - 3 * 86400000), last_active_at: new Date(Date.now() - 2 * 86400000)
    },
    {
      user_id: 'user-2', user_type: 'operator', name: 'Safari Adventures Ltd', email: 'info@safariadv.com',
      current_step: 4, total_steps: 6, steps_completed: ['1', '2', '3'],
      started_at: new Date(Date.now() - 5 * 86400000), last_active_at: new Date(Date.now() - 4 * 86400000)
    },
  ]

  let nudgesSent = 0
  for (const user of incompleteUsers) {
    const daysSinceActive = (Date.now() - user.last_active_at.getTime()) / 86400000
    if (daysSinceActive >= 2) {
      await sendOnboardingNudge(user)
      nudgesSent++
    }
  }

  endTrace(traceId, { input_tokens: 0, output_tokens: 0, cost_usd: 0, latency_ms: 0, status: 'success' })

  logger.info(`Onboarding nudges: ${nudgesSent} sent`)
  return { nudges_sent: nudgesSent, completions: 0 }
}
