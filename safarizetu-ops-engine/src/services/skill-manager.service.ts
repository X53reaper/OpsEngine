import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { logger } from './ai-agent.service'

// ── SKILL MANAGER ──────────────────────────────────────────────
// Skills are domain knowledge files that give agents an edge.
// They're loaded into LLM context to make outputs smarter,
// more specific, and more persuasive than generic AI.
//
// Each skill is a markdown file with structured knowledge:
// - Facts, data, patterns
// - Rules and guidelines
// - Examples of what works
// - Anti-patterns to avoid

interface Skill {
  name: string
  category: string
  filename: string
  content: string
  loaded_at: Date
}

interface SkillContext {
  skill_name: string
  relevance_score: number    // 0-1, how relevant to current task
  excerpt: string            // Most relevant portion
}

// ── IN-MEMORY SKILL CACHE ──────────────────────────────────────
const skillCache: Map<string, Skill> = new Map()
const SKILLS_DIR = join(__dirname, '../../skills')

// ── LOAD ALL SKILLS ────────────────────────────────────────────
export function loadAllSkills(): number {
  if (!existsSync(SKILLS_DIR)) {
    logger.warn('Skills directory not found — creating default skills')
    createDefaultSkills()
  }

  let loaded = 0
  const categories = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)

  for (const category of categories) {
    const categoryDir = join(SKILLS_DIR, category)
    const files = readdirSync(categoryDir).filter(f => f.endsWith('.md'))

    for (const file of files) {
      try {
        const content = readFileSync(join(categoryDir, file), 'utf-8')
        const name = file.replace('.md', '')
        skillCache.set(`${category}/${name}`, {
          name,
          category,
          filename: file,
          content,
          loaded_at: new Date()
        })
        loaded++
      } catch (e: any) {
        logger.warn(`Failed to load skill ${category}/${file}: ${e.message}`)
      }
    }
  }

  logger.info(`Loaded ${loaded} skills from ${categories.length} categories`)
  return loaded
}

// ── GET SKILL ──────────────────────────────────────────────────
export function getSkill(category: string, name: string): Skill | undefined {
  return skillCache.get(`${category}/${name}`)
}

// ── GET SKILLS BY CATEGORY ─────────────────────────────────────
export function getSkillsByCategory(category: string): Skill[] {
  return Array.from(skillCache.values()).filter(s => s.category === category)
}

// ── GET ALL SKILLS ─────────────────────────────────────────────
export function getAllSkills(): { name: string; category: string; size: number }[] {
  return Array.from(skillCache.values()).map(s => ({
    name: s.name,
    category: s.category,
    size: s.content.length
  }))
}

// ── BUILD SKILL CONTEXT ────────────────────────────────────────
// Selects the most relevant skills for a given task and builds
// a context string to inject into the LLM prompt
export function buildSkillContext(
  taskType: string,
  keywords: string[] = [],
  maxTokens: number = 3000
): string {
  const allSkills = Array.from(skillCache.values())
  
  // Score each skill for relevance
  const scored = allSkills.map(skill => {
    let score = 0
    const lowerContent = skill.content.toLowerCase()
    const lowerName = skill.name.toLowerCase()

    // Task type matching
    if (taskType === 'memory_story' && (skill.category === 'copywriting' || skill.category === 'psychology')) score += 3
    if (taskType === 'email' && (skill.category === 'copywriting' || skill.category === 'traveler-profiles')) score += 3
    if (taskType === 'ad' && (skill.category === 'copywriting' || skill.category === 'competitors')) score += 3
    if (taskType === 'wildlife_post' && skill.category === 'wildlife') score += 5
    if (taskType === 'pricing' && skill.category === 'psychology') score += 4
    if (taskType === 'competitor_analysis' && skill.category === 'competitors') score += 5
    if (taskType === 'personalization' && skill.category === 'traveler-profiles') score += 4

    // Keyword matching
    for (const keyword of keywords) {
      if (lowerContent.includes(keyword.toLowerCase())) score += 1
      if (lowerName.includes(keyword.toLowerCase())) score += 2
    }

    return { skill, score }
  })

  // Sort by relevance, take top skills
  const relevant = scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  if (relevant.length === 0) return ''

  // Build context string
  let context = '── DOMAIN KNOWLEDGE (apply this expertise) ──\n\n'
  let tokenCount = 0

  for (const { skill, score } of relevant) {
    const truncated = skill.content.substring(0, Math.min(1500, maxTokens - tokenCount))
    if (tokenCount + truncated.length > maxTokens) break
    
    context += `### ${skill.category}/${skill.name} (relevance: ${score})\n`
    context += truncated + '\n\n'
    tokenCount += truncated.length
  }

  return context
}

// ── CREATE/UPDATE SKILL ────────────────────────────────────────
export function saveSkill(category: string, name: string, content: string): void {
  const dir = join(SKILLS_DIR, category)
  if (!existsSync(dir)) {
    require('fs').mkdirSync(dir, { recursive: true })
  }
  
  const filePath = join(dir, `${name}.md`)
  require('fs').writeFileSync(filePath, content, 'utf-8')
  
  skillCache.set(`${category}/${name}`, {
    name,
    category,
    filename: `${name}.md`,
    content,
    loaded_at: new Date()
  })

  logger.info(`Saved skill: ${category}/${name}`)
}

// ── DELETE SKILL ───────────────────────────────────────────────
export function deleteSkill(category: string, name: string): boolean {
  const key = `${category}/${name}`
  if (!skillCache.has(key)) return false

  const filePath = join(SKILLS_DIR, category, `${name}.md`)
  if (existsSync(filePath)) {
    require('fs').unlinkSync(filePath)
  }

  skillCache.delete(key)
  logger.info(`Deleted skill: ${key}`)
  return true
}

// ── CREATE DEFAULT SKILLS ──────────────────────────────────────
// Bootstraps the system with essential knowledge
function createDefaultSkills(): void {
  const defaults: Record<string, Record<string, string>> = {
    wildlife: {
      'zimbabwe-parks': WILDLIFE_SKILL,
      'animal-behavior': ANIMAL_BEHAVIOR_SKILL
    },
    psychology: {
      'travel-desire': TRAVEL_PSYCHOLOGY_SKILL,
      'booking-psychology': BOOKING_PSYCHOLOGY_SKILL
    },
    copywriting: {
      'memory-storytelling': MEMORY_STORYTELLING_SKILL,
      'premium-voice': PREMIUM_VOICE_SKILL
    },
    competitors: {
      'counter-strategies': COMPETITOR_COUNTER_SKILL
    },
    'traveler-profiles': {
      'persona-templates': TRAVELER_PROFILES_SKILL
    }
  }

  for (const [category, skills] of Object.entries(defaults)) {
    for (const [name, content] of Object.entries(skills)) {
      saveSkill(category, name, content)
    }
  }
}

// ══════════════════════════════════════════════════════════════
// DEFAULT SKILLS — Domain Knowledge
// ══════════════════════════════════════════════════════════════

const WILDLIFE_SKILL = `# Zimbabwe Safari Parks — Essential Knowledge

## Hwange National Park
- Largest park in Zimbabwe (14,600 km²)
- Famous for: Massive elephant herds (50,000+), wild dogs, lion prides
- Best time: Oct-Dec (dry season, animals congregate at waterholes)
- Unique: Iconic pumped waterholes create guaranteed wildlife viewing
- Memory angle: "The sound of 200 elephants at a waterhole at dusk"
- Not just Big 5 — Hwange has 100+ mammal species

## Mana Pools National Park
- UNESCO World Heritage Site
- Famous for: Walking safaris, canoeing with wildlife, elephants standing on hind legs reaching for apple trees
- Best time: Jun-Oct (dry season, animals along Zambezi river)
- Unique: One of the few parks where you can walk without a guide
- Memory angle: "You're walking. No vehicle. Just you and the elephant 20 meters away."
- Wild dogs are frequently seen

## Victoria Falls
- One of the 7 Natural Wonders of the World
- 1,708m wide, 108m high
- Best time: Feb-May (peak flow), Aug-Dec (best for swimming Devil's Pool)
- Memory angle: "The spray is so thick you can't see the bottom. You feel it before you see it."
- Activities: Bungee, white water rafting, helicopter flights, sunset cruises

## Gonarezhou National Park
- "Place of Elephants" in Shona
- Famous for: Massive tuskers, Chilojo Cliffs, remote wilderness
- Best time: May-October
- Memory angle: "Red sand cliffs, elephants below, no one else for 50km"
- Zimbabwe's least-visited major park — true wilderness

## Matobo Hills
- UNESCO World Heritage Site
- Famous for: Ancient San rock art (2,000+ years old), rhino tracking on foot
- Best year-round
- Memory angle: "You're standing where humans stood 2,000 years ago. Same sky. Same hills."
- Cecil John Rhodes' grave is here

## Lake Kariba
- World's largest man-made lake
- Famous for: Tiger fishing, houseboat safaris, sunset photography
- Memory angle: "A houseboat. Nothing but water and sky. The sun drops into the lake."
- Baobab trees visible when water levels drop

## Key Facts for Content
- Zimbabwe has 5 UNESCO World Heritage Sites
- 20% of land is national parks
- Zimbabweans are known as the friendliest people in Africa
- English, Shona, and Ndebele are widely spoken
- Currency: USD widely accepted
- Victoria Falls Airport has direct flights from Johannesburg, Dubai, and Ethiopia`

const ANIMAL_BEHAVIOR_SKILL = `# Animal Behavior — Stories That Write Themselves

## Elephants
- Matriarchal societies — the oldest female leads the herd
- They mourn their dead, visit bones of deceased family members
- Calves are raised by the whole herd ("allomothering")
- They can remember water sources from 50+ years ago
- STORY: "The matriarch stopped. She remembered this waterhole from 30 years ago. Her herd followed."
- STORY: "A baby elephant got stuck in the mud. The whole herd waited. They didn't leave until he was out."

## Lions
- Prides are female-led — males are kicked out at 3 years old
- Males sleep 20 hours a day
- Lions can roar from 5 miles away
- A pride's territory can be 100+ square miles
- STORY: "The lioness didn't move. She watched us. We watched her. Nobody breathed."
- STORY: "At night, you hear the roar. It's not scary. It's the bush saying goodnight."

## Wild Dogs
- Most successful hunters in Africa (85% kill rate vs lion's 25%)
- They vote on hunting direction by sneezing
- They care for sick and injured pack members
- Only ~6,600 left in the wild
- STORY: "The pack gathered. They sneezed. The majority decided: we hunt east."
- STORY: "Wild dogs are the opposite of what people expect. They're gentle. They care for each other."

## Leopards
- Most solitary of the big cats
- Can carry prey 3x their weight up a tree
- Mostly nocturnal — sightings are special
- They're the "ghost of the bush"
- STORY: "We heard the impala alarm call. Then silence. The leopard was already gone."

## Hippos
- Kill more people in Africa than any other large animal
- They can run 30 km/h on land
- They secrete red fluid (blood sweat) that acts as sunscreen
- They're vegetarian
- STORY: "The hippo yawned. It wasn't being friendly. It was showing us its teeth."

## Rhinos
- White rhinos are actually grey — name comes from "wijd" (Dutch for wide)
- Black rhinos have a hooked lip for browsing
- They've been on earth for 50 million years
- Only ~5,000 black rhinos left
- STORY: "A white rhino. Older than the hills. Slower than time. You just sit and watch."

## Birds (Bonus Content)
- 670+ bird species in Zimbabwe
- Fish eagles have the most iconic call in Africa
- Lilac-breasted rollers are the most photographed bird
- STORY: "The fish eagle called. That sound. It's the sound of Africa."`

const TRAVEL_PSYCHOLOGY_SKILL = `# Travel Desire Psychology — Why People Actually Book Safaris

## The Neuroscience of Travel Desire

### Anticipation Dopamine
- The brain releases MORE dopamine during ANTICIPATION than the experience itself
- Planning a trip is neurologically more exciting than taking it
- APPLICATION: Content that triggers planning (maps, itineraries, "imagine this") outperforms destination content
- "The moment you start planning, your brain is already on safari"

### Peak-End Rule
- People judge experiences by the PEAK moment and the END, not the average
- One extraordinary moment outweighs hours of mediocrity
- APPLICATION: Find THE moment in every image — the one frame that captures the best second
- "You'll forget the drive. You won't forget the elephant at the waterhole."

### Neural Replay
- When we recall a memory, the brain replays the same neural patterns as the original experience
- Reading vivid sensory language literally simulates the experience
- APPLICATION: Sensory language isn't decoration — it's activation
- "The dust is warm between your toes" activates the same brain regions as actually feeling it

### Default Mode Network
- The brain's self-referential imagination network
- Activated by "you" language — "You're standing at the edge of the waterhole"
- APPLICATION: Second person puts the reader IN the scene
- "You" is the most powerful word in travel content

## Philosophy of Travel

### The Sublime (Burke & Kant)
- Encountering something vast creates AWE + HUMILITY
- Use: "vast", "endless", "ancient", "beyond words"
- "You feel small in the best way"

### Homo Viator (Gabriel Marcel)
- Humans are travelers toward meaning, not destinations
- The journey IS the destination
- "The drive to the camp is where the city leaves you"

### Memories as Identity (Ricoeur)
- We are the stories we tell about ourselves
- "This is the story you'll tell. This is who you become."

## What NOT to Do
- Never use "Book now" — it kills anticipation
- Never use urgency that feels manufactured
- Never sell features — sell the feeling
- Never use superlatives without specificity
- Never start with emojis — earn the emotion first

## What TO Do
- Write in present tense for immediacy
- Use sensory language (sight, sound, smell, texture, temperature)
- Create open loops ("Day 3. You wake before dawn. The guide whispers.")
- Let silence do the work — short sentences, fragments
- End with an open question, not a CTA`

const BOOKING_PSYCHOLOGY_SKILL = `# Booking Psychology — From Interest to Action

## The Booking Funnel (Psychology Layer)

### Stage 1: Wonder (Awareness)
- Trigger: Beautiful image, compelling story
- Psychology: Awe, curiosity, aspiration
- Content type: Memory stories, wildlife moments
- "I didn't know Africa looked like that"
- Goal: Make them FEEL something

### Stage 2: Research (Consideration)
- Trigger: "Could I actually do this?"
- Psychology: Self-actualization, identity ("Am I the kind of person who...?")
- Content type: Practical info wrapped in stories
- "Here's what 5 days in Hwange actually looks like"
- Goal: Make it feel achievable

### Stage 3: Planning (Intent)
- Trigger: "When should I go? Who should I go with?"
- Psychology: IKEA effect (effort = value), loss aversion
- Content type: Itineraries, seasonal guides, comparison content
- "Your safari starts here — build your story"
- Goal: Let them co-create the experience

### Stage 4: Booking (Conversion)
- Trigger: "This is the one"
- Psychology: Clarity, trust, low friction
- Content type: Simple next steps, real testimonials
- "3 steps. That's it."
- Goal: Remove all barriers

### Stage 5: Memory (Advocacy)
- Trigger: Post-trip experience
- Psychology: Peak-end rule, identity integration
- Content type: "Your story" content, return trip invitations
- "This is the trip you'll tell forever"
- Goal: Turn them into storytellers

## Conversion Triggers
- Loss aversion: "There are 12 camps in Mana Pools. Only 3 have this view."
- Social proof: "Last year, 340 people saw this exact scene. 280 of them said it changed them."
- Identity: "Not everyone understands why you need to go. That's how you know it matters."
- Specificity: "R5,200 per night. All meals. Game drives. Walking safari. No hidden costs."

## Anti-Patterns (What Kills Bookings)
- "Limited time offer!" — Feels like a car dealership
- "Book now before it's too late!" — Creates anxiety, not desire
- "Luxury accommodations await!" — Generic, forgettable
- "Don't miss out!" — FOMO that feels manufactured
- Counting down timers — Aggressive, cheapens the experience

## Premium Conversion Approach
- Be specific, not urgent
- Be informative, not pushy
- Be human, not corporate
- Let the experience sell itself
- Make the next step obvious and easy`

const MEMORY_STORYTELLING_SKILL = `# Memory Storytelling — Writing That Feels Like Remembering

## The Art of the Memory Story

A memory story is NOT a caption. It's a fragment of an experience that the reader instantly puts themselves into.

### Structure
1. **Timestamp** (optional): "Day 3." / "5:47am." / "Just before sunset."
2. **Scene setting**: One sensory detail that grounds the moment
3. **The moment**: What happened — specific, not generic
4. **The feeling**: What it meant (implied, not stated)
5. **The open end**: A question, a silence, or a gentle trailing off

### Examples

BAD: "🌅 Amazing sunset safari in Hwange! Who wants to be here? 🦁 #SafariZetu #Zimbabwe"

MEMORY STORY: "The elephant didn't move. Neither did we. Twenty minutes of nothing but breathing. That was the best twenty minutes of the year."

MEMORY STORY: "5:47am. Coffee in hand. The bush is making sounds you don't have words for. This is the part they don't put in the brochure."

MEMORY STORY: "Day 3. The guide stopped the vehicle. Pointed. We all looked. A leopard, draped over a branch, completely uninterested in us. We sat there for an hour. Nobody checked their phone."

MEMORY STORY: "The fire crackled. Someone started telling a story. By the end, everyone was laughing. We'd known each other for two hours. It felt like years."

### Sensory Details (Use These)
- Temperature: "warm dust", "cool morning air", "the heat rising off the road"
- Sound: "the bush making sounds you don't have words for", "the crackle of the fire", "silence — the real kind"
- Smell: "wild sage", "rain on red earth", "the campfire smoke in your hair"
- Texture: "red dust between your fingers", "the rough bark of an acacia"
- Taste: "bush coffee", "the cold beer after a game drive"

### Tone Rules
- Present tense for immediacy
- Fragments are good — they feel like real memories
- Don't explain the feeling — let the reader feel it
- Specific details beat vague descriptions
- Short sentences. Let silence work.

### Memory Types
- **First Time**: "You've never seen an elephant this close. Your brain doesn't know how to process it."
- **The Quiet Moment**: Nobody talks. The sun moves. The shadows change. You watch."
- **The Story Worth Telling**: "This is the part you'll tell at dinner. The part where..."
- **The Perspective Shift**: "Somewhere between day 2 and day 3, the city stopped mattering."
- **The Return**: "You've been here before. It's different this time. You're different this time."

## What Makes It Premium
- No exclamation marks (let the content breathe)
- No emojis as first characters
- No "Discover" or "Experience" as first word
- No "Tag someone who..." (overused)
- No "Book now" or "Link in bio" in the story itself
- The story IS the selling. The CTA is separate."`

const PREMIUM_VOICE_SKILL = `# Premium Voice — How Safari Zetu Sounds

## Voice Identity
Safari Zetu sounds like:
- A well-traveled friend who's been to Africa many times
- Someone who knows the difference between a tourist and a traveler
- Warm but not gushing
- Knowledgeable but not lecturing
- Excited but not hyperbolic
- Premium but not pretentious

## Tone Spectrum
We shift along this spectrum depending on context:

**Inspiring** (default): "Some places change how you see the world."
**Educational**: "Elephants can remember water sources from 50 years ago."
**Funny**: "The leopard thinks it's hiding. It's not hiding."
**Adventurous**: "Day 3. You wake before dawn. The guide whispers."
**Emotional**: "Some moments stay with you forever."
**Urgent** (rare): "The migration crosses in September. Only 40 people will see it from this angle."
**Mysterious**: "Not everything in Africa is what it seems."
**Bold**: "Forget the office. THIS is living."

## Word Choice

### Use These Words
- "the bush" (not "the wilderness" or "the wild")
- "game drive" (not "safari ride" or "animal tour")
- "sundowner" (not "sunset drink")
- "bush coffee" (not "campfire coffee")
- "the lodge" (not "the hotel" or "the resort")
- "tracker" (not "guide" when referring to the person who finds animals)
- "the golden hour" (not "sunset")

### Avoid These Words
- "luxury" (let the content BE luxury, don't say it)
- "exclusive" (overused in travel)
- "once-in-a-lifetime" (cliché)
- "unforgettable" (let the reader decide)
- "breathtaking" (everyone uses it)
- "paradise" (too generic)
- "hidden gem" (everyone says it)
- "bucket list" (overused)
- "authentic" (if you have to say it, it isn't)
- "immersive" (corporate travel speak)

## Formatting Rules
- Line breaks between paragraphs (fragments are good)
- No walls of text
- One idea per paragraph
- End with space for the reader to breathe
- CTA goes AFTER the story, not inside it

## Platform Adjustments
- **Instagram**: Sensory, present tense, 2-4 short paragraphs, hashtags at end
- **Facebook**: Slightly longer, ask a question, invite comments
- **TikTok**: Hook in 3 words, fast-paced, trending language
- **LinkedIn**: Professional but human, business story, transformation
- **Twitter**: Sharp observation, max 280 chars
- **Email**: Personal, warm, feels like a friend writing
- **SMS**: Max 160 chars, feels like a text from someone who knows you`

const COMPETITOR_COUNTER_SKILL = `# Competitor Counter-Strategies — How We Win

## Known Competitors and Their Tactics

### Wilderness Safaris
- Tactic: "Conservation authority" — they position as the experts
- Psychology: Authority principle (Cialdini)
- Our counter: We don't need to be the authority — we're the marketplace with OPTIONS
- "Wilderness has one camp. We have 47. Choose your story."

### andBeyond
- Tactic: "Luxury aspiration" — beautiful imagery, aspirational lifestyle
- Psychology: Self-actualization (Maslow)
- Our counter: Aspiration without exclusivity — "This is for you, not just for the rich"
- "Their safari costs $2,000/night. Ours starts at $200. Same elephants."

### Natural Selection
- Tactic: "Authentic wilderness" — raw, unfiltered Africa
- Psychology: Reactance — "this is the real thing"
- Our counter: Authenticity + accessibility — "Real Africa, real options, real you"
- "They show you the wild. We help you live in it."

### Asilia Africa
- Tactic: "Package convenience" — everything included
- Psychology: Reducing cognitive load
- Our counter: Convenience + customization — "We handle the logistics, you choose the adventure"
- "They give you a package. We give you a story."

### Rovos Rail
- Tactic: "Nostalgic luxury" — old-world elegance
- Psychology: Nostalgia, status
- Our counter: Nostalgia for the future — "This is the trip your grandkids will ask about"
- "They romanticize the past. We help you create future memories."

## Differentiation Principles

1. **Marketplace advantage**: We have what single lodges don't — variety
2. **Memory-first content**: Competitors sell features. We sell the feeling.
3. **Personalization**: We learn what works for each person. Competitors don't.
4. **Adaptability**: Our content evolves. Competitors repeat the same playbook.
5. **Honesty**: No manufactured urgency. No fake scarcity. Just real stories.

## Content Differentiation Rules
- Never copy competitor tone — be distinctly Safari Zetu
- Never mention competitors by name — let our content speak
- Never use their tactics — use our own psychology
- Always lead with MEMORY, not with OFFER
- Always be SPECIFIC, not general
- Always let the reader be the PROTAGONIST, not the customer`

const TRAVELER_PROFILES_SKILL = `# Traveler Profiles — Know Who You're Talking To

## Profile 1: The Luxury Seeker
- Demographics: 35-60, high income, professionals
- Values: Exclusivity, craftsmanship, attention to detail, privacy
- Triggers: "This is not for everyone", artisan details, personal service
- Psychology: Status, identity, self-reward
- Tone: Elegant, understated, specific
- Memory type: "The Quiet Moment"
- Ad angle: "Some experiences can't be bought. They can be earned."
- Email approach: Personal, warm, reference their specific interests
- What NOT to do: Don't be flashy. Don't mention price first. Don't use "luxury" as a word.

## Profile 2: The Adventure First
- Demographics: 25-45, active, experience-seekers
- Values: Discovery, challenge, authentic experiences, adrenaline
- Triggers: "You'll never forget this", physical challenges, remote locations
- Psychology: Achievement, self-discovery, novelty
- Tone: Energetic, specific, present-tense
- Memory type: "The Story Worth Telling"
- Ad angle: "This is not a vacation. This is a story."
- Email approach: Focus on what they'll DO, not what they'll see
- What NOT to do: Don't be generic. Don't say "adventure of a lifetime". Don't over-promise.

## Profile 3: The Family Planner
- Demographics: 30-50, parents, safety-conscious
- Values: Safety, convenience, bonding, education, value
- Triggers: "Safe for kids", "educational", "family memories"
- Psychology: Protection, legacy, bonding
- Tone: Warm, reassuring, practical
- Memory type: "First Time" (for their kids)
- Ad angle: "Some trips you take. Some trips become the stories your kids tell their kids."
- Email approach: Lead with safety and ease, then the magic
- What NOT to do: Don't be reckless. Don't downplay safety. Don't make it sound difficult.

## Profile 4: The Honeymoon Planner
- Demographics: 25-40, recently engaged/married
- Values: Romance, privacy, once-in-a-lifetime, luxury
- Triggers: "Just the two of you", exclusive, special
- Psychology: Romance, status, beginning of identity
- Tone: Romantic, intimate, sensory
- Memory type: "The Quiet Moment" (together)
- Ad angle: "Your story starts here."
- Email approach: Romantic but not cheesy. Focus on togetherness.
- What NOT to do: Don't be generic. Don't say "romantic getaway". Don't share with other couples.

## Profile 5: The Solo Traveler
- Demographics: 25-45, independent, curious
- Values: Freedom, self-discovery, safety, community
- Triggers: "You don't need a group", self-paced, meeting locals
- Psychology: Independence, growth, belonging
- Tone: Confident, empowering, personal
- Memory type: "The Perspective Shift"
- Ad angle: "You don't need a group to see Africa. You need a guide and a plan."
- Email approach: Empower them. Emphasize safety without being patronizing.
- What NOT to do: Don't assume they're lonely. Don't push group activities. Don't be condescending.

## Profile 6: The Corporate Group
- Demographics: 30-55, event planners, HR, leadership
- Values: Team building, unique venues, productivity, prestige
- Triggers: "Your team will never forget this", unique, impressive
- Psychology: Status, belonging, achievement
- Tone: Professional but human, business value, ROI
- Memory type: "The Story Worth Telling" (team bonding)
- Ad angle: "Your team doesn't need another conference room."
- Email approach: Lead with business outcomes, wrap in experience
- What NOT to do: Don't be too casual. Don't ignore logistics. Don't forget the business case.

## Universal Rules Across All Profiles
- Personalize: Use their name, reference their interests
- Be specific: "Hwange at sunset" beats "African safari"
- Tell stories: Every profile responds to stories over features
- Don't sell: Let the experience speak
- Respect intelligence: These are smart people — don't talk down`
