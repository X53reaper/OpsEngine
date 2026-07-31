import { logger } from '../services/ai-agent.service'

// ── CHROMA SERVICE — Vector search for safari catalogs ─────────
// Store and search lodge descriptions, park info, equipment catalogs
// and partnership data using vector embeddings

interface VectorDocument {
  id: string
  collection: string
  text: string
  metadata?: Record<string, any>
}

// In-memory vector store (upgrade to Chroma API when Docker available)
const vectorStore = new Map<string, VectorDocument[]>()

// ── EMBED (simple keyword vector for local mode) ───────────────
function simpleEmbed(text: string): number[] {
  const words = text.toLowerCase().split(/\s+/)
  const vector = new Array(384).fill(0)
  for (const word of words) {
    let hash = 0
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0
    }
    vector[Math.abs(hash) % 384] += 1
  }
  const magnitude = Math.sqrt(vector.reduce((s, v) => s + v * v, 0))
  return magnitude > 0 ? vector.map(v => v / magnitude) : vector
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  return magA && magB ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0
}

// ── UPSERT DOCUMENTS ───────────────────────────────────────────
export async function upsertDocuments(
  collection: string,
  docs: Array<{ id: string; text: string; metadata?: Record<string, any> }>
): Promise<void> {
  const existing = vectorStore.get(collection) || []

  for (const doc of docs) {
    const idx = existing.findIndex(d => d.id === doc.id)
    const entry: VectorDocument = { ...doc, collection }
    if (idx >= 0) existing[idx] = entry
    else existing.push(entry)
  }

  vectorStore.set(collection, existing)
  logger.info(`Upserted ${docs.length} docs into collection: ${collection}`)
}

// ── QUERY COLLECTION ───────────────────────────────────────────
export async function queryCollection(
  collection: string,
  queryText: string,
  topK: number = 5
): Promise<Array<{ id: string; text: string; score: number; metadata?: Record<string, any> }>> {
  const docs = vectorStore.get(collection) || []
  const queryVec = simpleEmbed(queryText)

  return docs
    .map(doc => ({
      id: doc.id,
      text: doc.text,
      score: cosineSimilarity(queryVec, simpleEmbed(doc.text)),
      metadata: doc.metadata
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

// ── COLLECTION HELPERS ─────────────────────────────────────────
export async function loadSafariCatalog(): Promise<void> {
  const lodges = [
    { id: 'lodge-1', text: 'Luxury Safari Lodge in Serengeti with game drives, bush dining, and wildlife photography tours. $450/night all-inclusive.', metadata: { type: 'lodge', region: 'serengeti', price_range: 'luxury' } },
    { id: 'lodge-2', text: 'Budget camping safari in Kruger National Park. Tent accommodation, guided walks, and bird watching. $120/person.', metadata: { type: 'lodge', region: 'kruger', price_range: 'budget' } },
    { id: 'lodge-3', text: 'Family-friendly lodge in Masai Mara with kids programs, balloon safaris, and cultural village visits. $320/night.', metadata: { type: 'lodge', region: 'masai-mara', price_range: 'mid-range' } },
    { id: 'lodge-4', text: 'Victoria Falls adventure lodge with white water rafting, helicopter tours, and elephant encounters. $280/night.', metadata: { type: 'lodge', region: 'victoria-falls', price_range: 'mid-range' } },
    { id: 'lodge-5', text: 'Exclusive mobile safari in Botswana Okavango Delta. Mokoro trips, fishing, and stargazing. $520/night premium.', metadata: { type: 'lodge', region: 'okavango', price_range: 'premium' } },
    { id: 'park-1', text: 'Serengeti National Park: 14,750 sq km, home to the Great Migration, Big Five, and over 500 bird species. Entry $60/day.', metadata: { type: 'park', region: 'serengeti' } },
    { id: 'park-2', text: 'Victoria Falls National Park: UNESCO World Heritage Site, 1,708m wide waterfall. Entry $30/day.', metadata: { type: 'park', region: 'victoria-falls' } },
    { id: 'park-3', text: 'Kruger National Park: 19,485 sq km, 147 mammal species, self-drive friendly. Entry $25/day.', metadata: { type: 'park', region: 'kruger' } },
    { id: 'partner-1', text: 'FastJet: Budget airline flying Harare to Victoria Falls, Lusaka to Dar es Salaam. Partner commission 8%.', metadata: { type: 'partner', category: 'airline' } },
    { id: 'partner-2', text: 'Air Zimbabwe: National carrier, Harare to Nairobi, Johannesburg, London. Partner commission 10%.', metadata: { type: 'partner', category: 'airline' } },
    { id: 'equip-1', text: 'Safari gear rental: binoculars $15/day, camera lenses $25/day, hiking boots $10/day, sleeping bags $8/day.', metadata: { type: 'equipment' } },
  ]
  await upsertDocuments('safari-catalog', lodges)
}

export async function loadPartnershipData(): Promise<void> {
  const partners = [
    { id: 'fastjet', text: 'FastJet airline partnership: budget flights across East/Southern Africa. 8% commission. Contact: partnerships@fastjet.com', metadata: { status: 'active', type: 'airline' } },
    { id: 'air-zimbabwe', text: 'Air Zimbabwe partnership: national carrier, regional and international routes. 10% commission. Contact: corp@airzimbabwe.co.zw', metadata: { status: 'active', type: 'airline' } },
    { id: 'amref', text: 'AMREF Flying Doctors: emergency medical evacuation for safari travelers. $45/trip coverage.', metadata: { status: 'prospect', type: 'medical' } },
    { id: 'wild-lands', text: 'Wilderness Safaris: luxury lodge chain, 60+ camps across Africa. Revenue share model.', metadata: { status: 'prospect', type: 'lodge' } },
  ]
  await upsertDocuments('partnerships', partners)
}

// ── RAG QUERY (combines memory + vector search) ────────────────
export async function ragQuery(
  question: string,
  context?: { touristId?: string; operatorId?: string }
): Promise<string> {
  const results = await queryCollection('safari-catalog', question, 3)
  const partnershipResults = await queryCollection('partnerships', question, 2)

  const contextStr = [
    ...results.map(r => `[${r.metadata?.type || 'info'}] ${r.text}`),
    ...partnershipResults.map(r => `[partner] ${r.text}`)
  ].join('\n')

  return `Based on Safari Zetu catalog:\n${contextStr}\n\nQuestion: ${question}`
}
