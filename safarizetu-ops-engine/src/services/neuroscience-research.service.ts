import { logger } from './ai-agent.service'
import { callAgent } from './ai-agent.service'
import { buildSkillContext } from './skill-manager.service'

// ── NEUROSCIENCE, PHILOSOPHY & PSYCHOLOGY RESEARCH AGENT ───────
// This agent doesn't sell. It understands WHY humans desire travel,
// then applies those insights to create content that feels like
// a memory, not an advertisement.

// ── CORE RESEARCH DOMAINS ──────────────────────────────────────
const RESEARCH_DOMAINS = {
  neuroscience: {
    title: 'Neuroscience of Travel & Memory',
    key_findings: [
      {
        concept: 'Anticipation Dopamine',
        finding: 'The brain releases more dopamine during anticipation of an experience than during the experience itself. Planning a safari is neurologically more exciting than being on it.',
        application: 'Create content that triggers anticipation — "Imagine waking up to this view" rather than "Look at this view"',
        source: 'Knutson et al., 2001; Kahneman et al., 1999'
      },
      {
        concept: 'Memory Consolidation Through Emotion',
        finding: 'Emotionally charged experiences are stored more deeply in long-term memory. The amygdala tags memories as "important" based on emotional intensity, not logical relevance.',
        application: 'Write captions that evoke a specific emotion (wonder, awe, peace) rather than listing features',
        source: 'McGaugh, 2004; Cahill & McGaugh, 1998'
      },
      {
        concept: 'The Peak-End Rule',
        finding: 'People judge experiences based on their peak moment and the ending, not the average or total. One extraordinary moment outweighs hours of mediocrity.',
        application: 'Identify and amplify the peak moment in every image — the single frame that captures the best second of the day',
        source: 'Kahneman et al., 1993'
      },
      {
        concept: 'Neural Replay',
        finding: 'When we recall a memory, the brain replays the same neural patterns as the original experience. Looking at a safari photo literally re-lives the moment.',
        application: 'Use language that triggers sensory recall: "the sound of the bush at dusk", "the warmth of the fire", "the smell of rain on red earth"',
        source: 'Carr et al., 2011'
      },
      {
        concept: 'The Default Mode Network',
        finding: 'The brain\'s default mode network activates during self-referential thinking and future imagination. Travel content that says "you" activates this network.',
        application: 'Second person "you" language activates the DMN: "You\'re standing at the edge of the waterhole..."',
        source: 'Buckner et al., 2008'
      }
    ]
  },
  philosophy: {
    title: 'Philosophy of Travel & Meaning',
    key_findings: [
      {
        concept: 'The Examined Life (Socrates)',
        finding: '"The unexamined life is not worth living." Travel forces examination — you encounter yourself when you encounter the unfamiliar.',
        application: 'Frame safari as self-discovery: "This is the trip that changes how you see everything"',
        source: 'Socrates, Apology'
      },
      {
        concept: 'Wanderlust as Existential Need (Heidegger)',
        finding: 'Humans are "thrown" into existence and seek meaning through engagement with the world. Travel is not escape — it is seeking.',
        application: 'Position travel as essential, not indulgent: "Not everyone understands why you need to go. That\'s how you know it matters."',
        source: 'Heidegger, Being and Time'
      },
      {
        concept: 'The Sublime (Burke & Kant)',
        finding: 'Encountering something vast and beyond comprehension (a lion, a waterfall, an African sky) creates "the sublime" — a feeling of awe mixed with humility.',
        application: 'Use words that evoke the sublime: "vast", "endless", "ancient", "beyond words", "you feel small in the best way"',
        source: 'Burke, 1757; Kant, 1764'
      },
      {
        concept: 'Homo Viator (Gabriel Marcel)',
        finding: 'The human being is fundamentally a traveler — not toward a destination, but toward meaning. The journey IS the destination.',
        application: 'Let the content breathe: "The drive to the camp is where the city leaves you. By the time you arrive, you\'ve already changed."',
        source: 'Marcel, Homo Viator'
      },
      {
        concept: 'Memories as Identity (Ricoeur)',
        finding: 'We are the stories we tell about ourselves. Memories are not records — they are the raw material of identity.',
        application: 'Position memories as identity-building: "This is the story you\'ll tell. This is who you become."',
        source: 'Ricoeur, Time and Narrative'
      }
    ]
  },
  psychology: {
    title: 'Psychology of Travel Desire',
    key_findings: [
      {
        concept: 'Maslow\'s Self-Actualization',
        finding: 'Travel sits at the top of Maslow\'s hierarchy — it\'s not survival, safety, or belonging. It\'s becoming who you are.',
        application: 'Speak to the person they want to become, not the vacation they want to take',
        source: 'Maslow, 1943'
      },
      {
        concept: 'The End of History Illusion',
        finding: 'People underestimate how much they\'ll change in the future, and overvalue past experiences. A safari becomes more valuable as a memory over time.',
        application: 'Plant seeds of future nostalgia: "In five years, this will be the story you tell most"',
        source: 'Gilbert et al., 2013'
      },
      {
        concept: 'Social Proof Through Stories',
        finding: 'Humans are 22x more likely to remember information when it\'s wrapped in a story versus a statistic. Stories are social currency.',
        application: 'Every post should be a story fragment — something worth retelling: "She didn\'t believe me when I said the elephants came to the camp"',
        source: 'Zak, 2014; Stanford research'
      },
      {
        concept: 'Loss Aversion',
        finding: 'People feel losses 2x more strongly than gains. The fear of missing a rare experience is more motivating than the promise of gaining one.',
        application: 'Gentle scarcity: "There are 12 camps in Mana Pools. Only 3 have this view." Not "BOOK NOW" — just facts that create natural urgency.',
        source: 'Kahneman & Tversky, 1979'
      },
      {
        concept: 'The IKEA Effect',
        finding: 'People value things more when they\'ve put effort into creating them. A safari you plan yourself feels more valuable than one you\'re handed.',
        application: 'Show the planning journey: "Your safari starts here — choose your adventure, build your story"',
        source: 'Norton et al., 2012'
      },
      {
        concept: 'Embodied Cognition',
        finding: 'The body influences the mind. Reading about an experience activates the same brain regions as having it. Vivid sensory language literally simulates the experience.',
        application: 'Use sensory-rich language: "The dust is warm between your toes. The air smells like wild sage and rain."',
        source: 'Barsalou, 2008; Bergen et al., 2007'
      },
      {
        concept: 'Narrative Transportation',
        finding: 'When someone is "transported" into a story, their attitudes and intentions shift to match the story\'s world. Transportation = persuasion without resistance.',
        application: 'Write immersive micro-stories, not captions: "Day 3. You wake before dawn. The guide whispers: there\'s a pride at the waterhole."',
        source: 'Green & Brock, 2000'
      }
    ]
  }
}

// ── CONTENT PSYCHOLOGY PRINCIPLES ──────────────────────────────
// These are the rules the content engine follows
export const CONTENT_PSYCHOLOGY = {
  // What to DO
  do: [
    'Tell micro-stories (3-5 sentences that drop you into a moment)',
    'Use sensory language (sight, sound, smell, texture, temperature)',
    'Create anticipation, not urgency',
    'Write in present tense for immediacy',
    'Use "you" to activate the default mode network',
    'End with an open question or gentle invitation',
    'Let the image do the heavy lifting — the caption is the feeling',
    'Reference time: "This is the golden hour", "In five years, you\'ll remember this"',
    'Show the in-between moments (the drive, the coffee at dawn, the silence)',
    'Make the reader the protagonist, not the safari'
  ],
  // What NOT to do
  dont: [
    'Use "Book now" or "Limited time offer"',
    'Start with emojis',
    'Use superlatives without evidence ("best ever", "most amazing")',
    'Write like a brochure ("Luxury accommodations await")',
    'Use FOMO that feels manufactured',
    'Write long paragraphs — keep it fragmented, like memories',
    'Use "Discover" or "Experience" as the first word',
    'List features instead of feelings',
    'Sound like every other safari account',
    'Sell. Sell. Sell. — Let the memory sell itself'
  ]
}

// ── RESEARCH QUERY ─────────────────────────────────────────────
// Asks the psychology agent to research a specific travel topic
export async function researchTravelPsychology(
  topic: string,
  context?: string
): Promise<{
  insight: string
  application: string
  content_angle: string
  psychology_principles: string[]
}> {
  const systemPrompt = `You are the Safari Zetu Psychology Research Agent. You research neuroscience, philosophy, and psychology to understand why humans travel, what makes memories valuable, and how to create content that induces desire through premium storytelling.

You are NOT a marketer. You are a researcher who understands that the best travel content doesn't sell — it makes someone remember what they already wanted.

Key research domains:
- Neuroscience: anticipation dopamine, memory consolidation, peak-end rule, neural replay, default mode network
- Philosophy: the examined life, wanderlust as existential need, the sublime, homo viator, memories as identity
- Psychology: self-actualization, end of history illusion, social proof through stories, loss aversion, IKEA effect, embodied cognition, narrative transportation

Always respond with:
1. The psychological insight (what science says)
2. How to apply it (what the content should do)
3. A specific content angle (what to write/say)
4. Which principles are at play`

  const userMessage = `Research topic: ${topic}
${context ? `Context: ${context}` : ''}

What does neuroscience, philosophy, and psychology say about this specific aspect of travel? How should Safari Zetu apply this insight?`

  try {
    const result = await callAgent({
      agentName: 'psychology_researcher',
      division: 'growth',
      model: 'heavy',
      systemPrompt,
      userMessage,
      triggerType: 'psychology_research',
      triggerPayload: { topic },
      maxTokens: 1500
    })

    // Extract structured insights from the response
    const text = result.content
    const principles = text.match(/\b(dopamine|amygdala|peak.end|default mode|narrative transportation|embodied cognition|loss aversion|IKEA effect|self.actualization|sublime|homo viator|end of history)\b/gi) || []

    return {
      insight: text.split('\n').find(l => l.includes('insight') || l.includes('Science') || l.includes('finding'))?.trim() || text.substring(0, 300),
      application: text.split('\n').find(l => l.includes('apply') || l.includes('should') || l.includes('application'))?.trim() || '',
      content_angle: text.split('\n').find(l => l.includes('angle') || l.includes('write') || l.includes('caption'))?.trim() || '',
      psychology_principles: [...new Set(principles.map(p => p.toLowerCase()))]
    }
  } catch (e: any) {
    logger.error(`Psychology research failed: ${e.message}`)
    return getFallbackInsight(topic)
  }
}

// ── GENERATE MEMORY CAPTION ────────────────────────────────────
// Uses psychology insights to write captions that feel like memories
export async function generateMemoryCaption(imageAnalysis: {
  subject: string
  animals: string[]
  landscape: string
  mood: string
  location_guess: string
  storytelling_angle: string
  emotional_appeal: string
}, platform: string): Promise<{
  caption: string
  psychology_used: string[]
  memory_type: string
}> {
  const principles = Object.values(RESEARCH_DOMAINS).flatMap(d => d.key_findings)

  // Load domain skills for this specific image/animal/location
  const skillKeywords = [imageAnalysis.subject, ...imageAnalysis.animals, imageAnalysis.location_guess].filter(Boolean)
  const skillContext = buildSkillContext('memory_story', skillKeywords, 2000)

  const systemPrompt = `You are Safari Zetu's memory storyteller. You write social content that feels like a memory someone is telling a friend — not an ad.

${skillContext ? skillContext + '\n\n' : ''}
THE PSYCHOLOGY BEHIND YOUR WRITING:

Neuroscience:
- Anticipation dopamine: The brain releases more dopamine during ANTICIPATION than the experience itself. Write about what's about to happen, not what already happened.
- Peak-end rule: One extraordinary moment outweighs hours of mediocrity. Find and amplify THE moment.
- Neural replay: Reading vivid sensory language literally replays the experience in the brain. Use senses.
- Default mode network: "You" language activates self-referential imagination. Put the reader IN the scene.

Philosophy:
- The sublime: Encountering something vast creates awe + humility. Use "vast", "endless", "ancient".
- Homo viator: We are travelers toward meaning, not destinations. The journey IS the destination.
- Memories as identity: We are our stories. Help them become who they want to be.

Psychology:
- Narrative transportation: Stories that transport change attitudes without resistance. Drop them INTO a moment.
- Embodied cognition: Sensory language activates the same brain regions as the actual experience.
- End of history illusion: They'll value this MORE in 5 years. Plant seeds of future nostalgia.

${CONTENT_PSYCHOLOGY.do.map(d => `✓ ${d}`).join('\n')}

${CONTENT_PSYCHOLOGY.dont.map(d => `✗ ${d}`).join('\n')}

PLATFORM RULES:
- Instagram: 2-4 short paragraphs. Fragments are good. Sensory. Present tense. End with open question or gentle invite. 8-12 hashtags at the end.
- Facebook: Longer story allowed. Ask a question to drive comments. 1-2 hashtags.
- TikTok: Hook in first 3 words. Short. Punchy. Use trending language. 3-5 hashtags.
- LinkedIn: Professional but human. Tell a story about transformation. 3-5 hashtags.
- Twitter: Max 280 chars. One sharp observation or question. 1-2 hashtags.

MEMORY TYPES — pick the one that fits this image best:
- "First Time" — the moment you see something for the first time (wonder, innocence)
- "The Quiet Moment" — in-between, unhurried, present (peace, mindfulness)
- "The Story Worth Telling" — something happened that you'll retell (adventure, humor)
- "The Perspective Shift" — something that changed how you see the world (growth, humility)
- "The Return" — going back to a place that holds meaning (belonging, continuity)

Return ONLY the caption text. Nothing else.`

  const userMessage = `Write a ${platform} memory-story for this image:

Subject: ${imageAnalysis.subject}
${imageAnalysis.animals.length > 0 ? `Animals: ${imageAnalysis.animals.join(', ')}` : ''}
Landscape: ${imageAnalysis.landscape}
Mood: ${imageAnalysis.mood}
Location: ${imageAnalysis.location_guess}
Story angle: ${imageAnalysis.storytelling_angle}
Emotional appeal: ${imageAnalysis.emotional_appeal}`

  try {
    const result = await callAgent({
      agentName: 'memory_storyteller',
      division: 'growth',
      model: 'heavy',
      systemPrompt,
      userMessage,
      triggerType: 'memory_content',
      triggerPayload: { subject: imageAnalysis.subject, platform },
      maxTokens: 600
    })

    const caption = result.content.trim()
    
    // Detect which psychology principles were used
    const usedPrinciples: string[] = []
    const captionLower = caption.toLowerCase()
    if (captionLower.includes('you') || captionLower.includes('your')) usedPrinciples.push('default_mode_network')
    if (captionLower.includes('imagine') || captionLower.includes('picture')) usedPrinciples.push('anticipation_dopamine')
    if (captionLower.includes('sound') || captionLower.includes('smell') || captionLower.includes('warm') || captionLower.includes('dust')) usedPrinciples.push('embodied_cognition')
    if (captionLower.includes('story') || captionLower.includes('tell')) usedPrinciples.push('social_proof')
    if (captionLower.includes('year') || captionLower.includes('remember') || captionLower.includes('ago')) usedPrinciples.push('end_of_history_illusion')
    if (captionLower.includes('vast') || captionLower.includes('endless') || captionLower.includes('ancient')) usedPrinciples.push('the_sublime')

    // Detect memory type
    let memory_type = 'The Quiet Moment'
    if (captionLower.includes('first') || captionLower.includes('never seen')) memory_type = 'First Time'
    else if (captionLower.includes('story') || captionLower.includes('tell')) memory_type = 'The Story Worth Telling'
    else if (captionLower.includes('changed') || captionLower.includes('different')) memory_type = 'The Perspective Shift'
    else if (captionLower.includes('back') || captionLower.includes('return')) memory_type = 'The Return'

    return { caption, psychology_used: usedPrinciples, memory_type }
  } catch (e: any) {
    logger.error(`Memory caption generation failed: ${e.message}`)
    return {
      caption: `${imageAnalysis.subject}. ${imageAnalysis.mood}. ${imageAnalysis.location_guess}.\n\nThis is the moment that stays with you. Not the lodge. Not the drive. This.\n\n#SafariZetu #ZimbabweSafari #MemoriesThatLast`,
      psychology_used: ['fallback'],
      memory_type: 'The Quiet Moment'
    }
  }
}

// ── GET RESEARCH DOMAINS ───────────────────────────────────────
export function getResearchDomains() {
  return RESEARCH_DOMAINS
}

// ── GET CONTENT PRINCIPLES ─────────────────────────────────────
export function getContentPrinciples() {
  return CONTENT_PSYCHOLOGY
}

// ── FALLBACK INSIGHT ───────────────────────────────────────────
function getFallbackInsight(topic: string): {
  insight: string
  application: string
  content_angle: string
  psychology_principles: string[]
} {
  return {
    insight: `Travel satisfies the human need for self-actualization (Maslow) and the desire for narrative transportation (Green & Brock, 2000). When someone sees a safari image, their brain begins to simulate the experience through embodied cognition.`,
    application: `Write content that drops the reader INTO the moment. Use present tense, sensory language, and "you" to activate the default mode network.`,
    content_angle: `Focus on the specific sensory details of this ${topic} — what does it smell like, sound like, feel like?`,
    psychology_principles: ['embodied_cognition', 'narrative_transportation', 'default_mode_network']
  }
}
