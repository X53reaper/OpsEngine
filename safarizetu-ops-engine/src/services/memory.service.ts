import { logger } from '../services/ai-agent.service'

// ── MEMORY SERVICE (via Mem0) ─────────────────────────────────
// Persistent memory across sessions for traveler preferences,
// past bookings, operator history, and conversation context

interface MemoryEntry {
  id: string
  user_id: string
  category: 'traveler_preference' | 'booking_history' | 'operator_info' | 'conversation_context' | 'feedback_pattern'
  key: string
  value: string
  metadata?: Record<string, any>
  created_at: Date
  updated_at: Date
}

// In-memory fallback when Mem0 is not configured
const memoryStore = new Map<string, MemoryEntry[]>()

// ── STORE MEMORY ──────────────────────────────────────────────
export async function storeMemory(
  userId: string,
  category: MemoryEntry['category'],
  key: string,
  value: string,
  metadata?: Record<string, any>
): Promise<void> {
  const entry: MemoryEntry = {
    id: `mem-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    user_id: userId,
    category,
    key,
    value,
    metadata,
    created_at: new Date(),
    updated_at: new Date()
  }

  // Store in memory (upgrade to Mem0 API when configured)
  const userMemos = memoryStore.get(userId) || []
  const existingIndex = userMemos.findIndex(m => m.category === category && m.key === key)

  if (existingIndex >= 0) {
    userMemos[existingIndex] = { ...userMemos[existingIndex], value, updated_at: new Date() }
  } else {
    userMemos.push(entry)
  }

  memoryStore.set(userId, userMemos)
  logger.info(`Memory stored: ${userId}/${category}/${key}`)
}

// ── RETRIEVE MEMORY ───────────────────────────────────────────
export async function retrieveMemory(
  userId: string,
  category?: MemoryEntry['category'],
  limit: number = 10
): Promise<MemoryEntry[]> {
  const userMemos = memoryStore.get(userId) || []

  let filtered = userMemos
  if (category) {
    filtered = userMemos.filter(m => m.category === category)
  }

  return filtered
    .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())
    .slice(0, limit)
}

// ── SEARCH MEMORY (semantic) ──────────────────────────────────
export async function searchMemory(
  query: string,
  userId?: string,
  limit: number = 5
): Promise<MemoryEntry[]> {
  const allMemos = userId
    ? (memoryStore.get(userId) || [])
    : Array.from(memoryStore.values()).flat()

  // Simple keyword search (upgrade to vector search with Chroma)
  const queryLower = query.toLowerCase()
  return allMemos
    .filter(m =>
      m.key.toLowerCase().includes(queryLower) ||
      m.value.toLowerCase().includes(queryLower)
    )
    .slice(0, limit)
}

// ── TRAVELER PROFILE BUILDER ──────────────────────────────────
export async function buildTravelerProfile(touristId: string): Promise<{
  preferences: Record<string, string>
  pastBookings: string[]
  specialRequirements: string[]
  communicationStyle: string
}> {
  const memories = await retrieveMemory(touristId)

  const preferences: Record<string, string> = {}
  const pastBookings: string[] = []
  const specialRequirements: string[] = []
  let communicationStyle = 'standard'

  for (const mem of memories) {
    switch (mem.category) {
      case 'traveler_preference':
        preferences[mem.key] = mem.value
        break
      case 'booking_history':
        pastBookings.push(mem.value)
        break
      case 'conversation_context':
        if (mem.key === 'communication_style') communicationStyle = mem.value
        break
    }
  }

  return { preferences, pastBookings, specialRequirements, communicationStyle }
}

// ── MEMORY-ENHANCED EMAIL PERSONALIZATION ──────────────────────
export async function personalizeWithMemory(
  touristId: string,
  baseContent: string
): Promise<string> {
  const profile = await buildTravelerProfile(touristId)

  let personalized = baseContent

  // Add personal touches based on memory
  if (profile.pastBookings.length > 0) {
    personalized = personalized.replace(
      '</p>',
      `<br><br>We hope you enjoyed your previous safari experience with us!</p>`
    )
  }

  if (profile.preferences['preferred_destination']) {
    personalized = personalized.replace(
      '</p>',
      `<br><br>Based on your interest in ${profile.preferences['preferred_destination']}, you might also enjoy our newer offerings in that region.</p>`
    )
  }

  return personalized
}
