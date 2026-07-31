import { callAgent, logger, sendEmail } from '../services/ai-agent.service'
import { storeMemory, retrieveMemory, buildTravelerProfile } from '../services/memory.service'
import { queryCollection, ragQuery } from '../services/chroma.service'
import { startTrace, endTrace } from '../services/observability.service'
import { bookingConfirmationEmail } from '../services/email-templates'

// ── CONVERSATIONAL BOOKING BOT ─────────────────────────────────
// Skills: Rasa (NLU), OpenClaw (multi-platform), Mem0 (memory), LangChain (chains)
// Handles booking inquiries via WhatsApp/Telegram/Web 24/7
// Understands intent, accesses safari catalog, remembers preferences

interface IncomingMessage {
  conversation_id: string
  platform: 'whatsapp' | 'telegram' | 'web' | 'sms'
  platform_user_id: string
  message: string
  tourist_id?: string
}

interface BotResponse {
  conversation_id: string
  reply: string
  intent: string
  entities: Record<string, any>
  action?: 'book' | 'browse' | 'modify' | 'cancel' | 'info' | 'transfer'
  booking_data?: BookingData
}

interface BookingData {
  safari_type?: string
  date?: string
  guests?: number
  budget?: number
  special_requirements?: string
}

// ── INTENT DETECTION ───────────────────────────────────────────
const INTENTS = {
  browse: ['show me', 'what safaris', 'options', 'available', 'catalog', 'explore', 'looking for'],
  book: ['book', 'reserve', 'book now', 'want to book', 'schedule', 'make a reservation'],
  modify: ['change', 'modify', 'update', 'reschedule', 'different date', 'change booking'],
  cancel: ['cancel', 'refund', 'money back', 'not interested anymore'],
  info: ['tell me about', 'details', 'more info', 'price', 'cost', 'how much', 'what includes'],
  help: ['help', 'support', 'agent', 'human', 'speak to someone', 'contact'],
  greeting: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'greetings']
}

function detectIntent(message: string): { intent: string; confidence: number } {
  const lower = message.toLowerCase()
  let bestIntent = 'info'
  let bestScore = 0

  for (const [intent, keywords] of Object.entries(INTENTS)) {
    const score = keywords.filter(k => lower.includes(k)).length
    if (score > bestScore) {
      bestScore = score
      bestIntent = intent
    }
  }

  return { intent: bestIntent, confidence: Math.min(1, bestScore * 0.3) }
}

// ── EXTRACT ENTITIES ───────────────────────────────────────────
function extractEntities(message: string): BookingData {
  const lower = message.toLowerCase()
  const entities: BookingData = {}

  // Date patterns
  const dateMatch = lower.match(/(\d{1,2})\s*(january|february|march|april|may|june|july|august|september|october|november|december)\s*(\d{4})?/)
  if (dateMatch) {
    entities.date = `${dateMatch[1]} ${dateMatch[2]} ${dateMatch[3] || '2026'}`
  }

  // Guest count
  const guestMatch = lower.match(/(\d+)\s*(guest|person|people|traveler|adult)/)
  if (guestMatch) {
    entities.guests = parseInt(guestMatch[1])
  }

  // Budget
  const budgetMatch = lower.match(/\$?\s*(\d[\d,]*)\s*(budget|spend|price|cost|per\s*person)?/)
  if (budgetMatch) {
    entities.budget = parseInt(budgetMatch[1].replace(',', ''))
  }

  // Safari types
  const safariTypes = ['victoria falls', 'serengeti', 'kruger', 'masai mara', 'okavango', 'hwange', 'namibia', 'madagascar', 'rwanda']
  for (const st of safariTypes) {
    if (lower.includes(st)) {
      entities.safari_type = st.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      break
    }
  }

  return entities
}

// ── HANDLE INCOMING MESSAGE ────────────────────────────────────
export async function handleIncomingMessage(msg: IncomingMessage): Promise<BotResponse> {
  const traceId = startTrace('booking_bot', 'mimo-v2.5-free', { platform: msg.platform })

  // Detect intent and entities
  const { intent, confidence } = detectIntent(msg.message)
  const entities = extractEntities(msg.message)

  // Build traveler profile from memory
  const profile = msg.tourist_id ? await buildTravelerProfile(msg.tourist_id) : null
  const profileContext = profile ? `\nTraveler profile: ${JSON.stringify(profile)}` : ''

  // RAG query for safari catalog context
  const catalogContext = await ragQuery(msg.message, { touristId: msg.tourist_id })

  let reply = ''
  let action: BotResponse['action'] = undefined
  let bookingData: BookingData | undefined

  switch (intent) {
    case 'greeting':
      reply = `Hello! 🌍 Welcome to Safari Zetu. I'm your safari assistant. I can help you:
• Browse our safari experiences
• Book your dream safari
• Get details on pricing and availability
• Modify or check existing bookings

What would you like to do?`
      action = 'info'
      break

    case 'browse':
      const browseResult = await callAgent({
        agentName: 'booking_bot',
        division: 'customer_success',
        model: 'light',
        systemPrompt: `You are a friendly safari booking assistant for Safari Zetu.
Help the traveler browse safari options. Be enthusiastic but not pushy.
Use the catalog context to suggest relevant experiences.

${catalogContext}
${profileContext}

Guide them toward booking by highlighting unique experiences.
Keep response under 150 words.`,
        userMessage: msg.message,
        triggerType: 'webhook',
        triggerPayload: { platform: msg.platform, intent }
      })
      reply = browseResult.content
      action = 'browse'
      break

    case 'book':
      bookingData = entities
      const bookResult = await callAgent({
        agentName: 'booking_bot',
        division: 'customer_success',
        model: 'heavy',
        systemPrompt: `You are a booking specialist for Safari Zetu. The traveler wants to book a safari.
Extract all booking details and guide them through the process.

Current extracted details: ${JSON.stringify(entities)}
${catalogContext}
${profileContext}

If details are incomplete, ask for missing information politely.
If details are complete, confirm the booking and explain next steps.
Keep response under 200 words.`,
        userMessage: msg.message,
        triggerType: 'webhook',
        triggerPayload: { platform: msg.platform, intent, entities }
      })
      reply = bookResult.content
      action = 'book'
      break

    case 'info':
      const infoResult = await callAgent({
        agentName: 'booking_bot',
        division: 'customer_success',
        model: 'light',
        systemPrompt: `You are a safari information specialist for Safari Zetu.
Provide detailed, accurate information about safari experiences.
Use the catalog context for specific details.

${catalogContext}
${profileContext}

Be helpful, knowledgeable, and enthusiastic about African safaris.
Keep response under 200 words.`,
        userMessage: msg.message,
        triggerType: 'webhook',
        triggerPayload: { platform: msg.platform, intent }
      })
      reply = infoResult.content
      action = 'info'
      break

    case 'modify':
      const modifyResult = await callAgent({
        agentName: 'booking_bot',
        division: 'customer_success',
        model: 'light',
        systemPrompt: `The traveler wants to modify their booking. Help them with changes.
For complex modifications, offer to connect them with a human agent.
Keep response under 150 words.`,
        userMessage: msg.message,
        triggerType: 'webhook',
        triggerPayload: { platform: msg.platform, intent }
      })
      reply = modifyResult.content
      action = 'modify'
      break

    case 'cancel':
      const cancelResult = await callAgent({
        agentName: 'booking_bot',
        division: 'customer_success',
        model: 'light',
        systemPrompt: `The traveler wants to cancel. Be empathetic and helpful.
Explain the cancellation policy clearly. Offer alternatives if possible.
Keep response under 150 words.`,
        userMessage: msg.message,
        triggerType: 'webhook',
        triggerPayload: { platform: msg.platform, intent }
      })
      reply = cancelResult.content
      action = 'cancel'
      break

    case 'help':
      reply = `I'd be happy to connect you with a human agent. Please hold on while I transfer you.

In the meantime, here's what I can help with:
• Safari browsing and recommendations
• Booking assistance
• Pricing information
• Booking modifications

Would you like me to continue helping, or shall I transfer you?`
      action = 'transfer'
      break

    default:
      reply = `I'm here to help with your safari experience! I can:
• Show you available safaris
• Help you book a safari
• Answer questions about pricing and availability
• Modify existing bookings

What would you like to do?`
      action = 'info'
  }

  // Store conversation in memory
  if (msg.tourist_id) {
    await storeMemory(msg.tourist_id, 'conversation_context', 'last_intent', intent)
    await storeMemory(msg.tourist_id, 'conversation_context', 'last_message', msg.message)
    if (entities.safari_type) {
      await storeMemory(msg.tourist_id, 'traveler_preference', 'interested_safari', entities.safari_type)
    }
  }

  endTrace(traceId, { input_tokens: 0, output_tokens: 0, cost_usd: 0, latency_ms: 0, status: 'success' })

  return {
    conversation_id: msg.conversation_id,
    reply,
    intent,
    entities,
    action,
    booking_data: bookingData
  }
}

// ── SEND BOOKING CONFIRMATION ──────────────────────────────────
export async function sendBookingConfirmation(
  touristEmail: string,
  bookingData: BookingData,
  touristName: string
): Promise<void> {
  const html = bookingConfirmationEmail({
    touristName,
    bookingId: `BK-${Date.now()}`,
    safariName: bookingData.safari_type || 'Safari Experience',
    operatorName: 'Safari Zetu',
    travelDates: bookingData.date || 'Flexible dates',
    partySize: bookingData.guests || 1,
    totalAmount: `$${bookingData.budget || 'TBD'}`,
    depositPaid: 'Pending',
    balanceDue: `$${bookingData.budget || 'TBD'}`,
    bookingUrl: 'https://safarizetu.com/bookings'
  })

  await sendEmail(touristEmail, 'Booking Confirmation — Safari Zetu', html)
  logger.info(`Booking confirmation sent to ${touristEmail}`)
}
