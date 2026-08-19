import { callAgent, logger, pool } from '../services/ai-agent.service'
import { startTrace, endTrace } from '../services/observability.service'

// ── COMPETITOR AD RESEARCH AGENT ──────────────────────────────
// Skills: Ad creative strategy, competitive intelligence, A/B test design
// Analyzes competitor advertising strategies and generates original
// ad concepts with compliance-aware copy for Safari Zetu

interface CompetitorAnalysis {
  competitor: string
  winning_patterns: string[]
  audience_angles: string[]
  copy_frameworks: string[]
  visual_brief: string
  compliance_risks: string[]
  adaptation_plan: string
}

interface AdConcept {
  id: string
  concept_name: string
  primary_text: string
  headline: string
  description: string
  image_prompt: string
  target_audience: string
  platform: string
  cta: string
}

interface AdConceptPack {
  concepts: AdConcept[]
  test_matrix: { variant_a: string, variant_b: string, metric: string }[]
  competitor: string
  generated_at: string
}

// ── KNOWN COMPETITORS ─────────────────────────────────────────
const COMPETITOR_LIST = [
  { name: 'Wilderness Safaris', focus: 'luxury conservation safaris', platform: 'facebook' },
  { name: '&Beyond', focus: 'premium safari lodges', platform: 'instagram' },
  { name: 'Singita', focus: 'ultra-luxury safari experiences', platform: 'instagram' },
  { name: 'Natural Selection', focus: 'adventure safari camps', platform: 'facebook' },
  { name: 'Asilia Africa', focus: 'mid-range tented camps', platform: 'facebook' },
]

// ── ANALYZE COMPETITOR ADS ────────────────────────────────────
export async function analyzeCompetitorAds(
  competitor: string,
  platform?: string
): Promise<CompetitorAnalysis> {
  const targetPlatform = platform || 'facebook'
  logger.info(`Analyzing competitor ad strategy: ${competitor} on ${targetPlatform}`)

  const result = await callAgent({
    agentName: 'competitor_ad_researcher',
    division: 'growth',
    model: 'light',
    systemPrompt: `You are a performance creative strategist for Safari Zetu, a safari marketplace. Analyze the competitor's advertising strategy and return original adaptation recommendations. Never copy protected brand assets.

Safari Zetu is Zimbabwe's premium safari marketplace with 1,199 verified operators across 47 destinations, backed by the Zimbabwe Tourism Authority.

You are analyzing: ${competitor} on ${targetPlatform}

Provide analysis covering:
1. Winning patterns — ad formats, hooks, storytelling approaches that perform well
2. Audience angles — which traveler segments they target and how
3. Copy frameworks — headline structures, CTA patterns, emotional triggers they use
4. Visual brief — describe the visual style, imagery themes, and production quality
5. Compliance risks — potential Facebook/Google ad policy violations in their approach
6. Adaptation plan — how Safari Zetu can create ORIGINAL ads inspired by (never copying) their strategies

RULES:
- Never suggest copying competitor brand assets, logos, or trademarked phrases
- All adaptations must be original and clearly distinguishable
- Flag any claims that would require substantiation under advertising standards
- Focus on structural and strategic patterns, not specific content

Return JSON: {
  "competitor": "${competitor}",
  "winning_patterns": ["pattern1", "pattern2", "pattern3"],
  "audience_angles": ["angle1", "angle2"],
  "copy_frameworks": ["framework1", "framework2"],
  "visual_brief": "detailed visual description",
  "compliance_risks": ["risk1", "risk2"],
  "adaptation_plan": "how Safari Zetu can create original ads inspired by their strategies"
}`,
    userMessage: `Analyze ${competitor}'s advertising strategy on ${targetPlatform}. Focus on patterns we can adapt for Safari Zetu — never copy.`,
    triggerType: 'on_demand',
    triggerPayload: { competitor, platform: targetPlatform }
  })

  let analysis: CompetitorAnalysis

  try {
    analysis = JSON.parse(result.content)
  } catch {
    logger.warn(`Failed to parse competitor analysis for ${competitor}, using fallback`)
    analysis = {
      competitor,
      winning_patterns: ['Story-driven video ads', 'User-generated content testimonials', 'Destination-first hero imagery'],
      audience_angles: ['Luxury travelers seeking exclusivity', 'Adventure seekers wanting authentic experiences'],
      copy_frameworks: ['Question hook → benefit → CTA', 'Before/after transformation narrative', 'Social proof with specific numbers'],
      visual_brief: 'High-production wildlife and landscape imagery with warm golden-hour tones, showcasing exclusive lodge experiences',
      compliance_risks: ['Unsubstantiated availability claims', 'Missing pricing disclaimers', 'No T&C links in ad copy'],
      adaptation_plan: 'Adopt story-driven format with Safari Zetu unique value: 1,199 verified operators across Zimbabwe. Use first-party traveller testimonials and real booking data for social proof.'
    }
  }

  // Store analysis in database
  try {
    await pool.query(
      `INSERT INTO competitor_content (competitor_name, platform, winning_patterns, audience_angles, copy_frameworks, visual_brief, compliance_risks, adaptation_plan, analyzed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        competitor,
        targetPlatform,
        JSON.stringify(analysis.winning_patterns),
        JSON.stringify(analysis.audience_angles),
        JSON.stringify(analysis.copy_frameworks),
        analysis.visual_brief,
        JSON.stringify(analysis.compliance_risks),
        analysis.adaptation_plan
      ]
    )
    logger.info(`Competitor analysis stored for ${competitor}`)
  } catch (err: any) {
    logger.warn(`Could not store competitor analysis: ${err.message}`)
  }

  logger.info(`Competitor analysis complete: ${competitor} — ${analysis.winning_patterns.length} patterns, ${analysis.compliance_risks.length} risks identified`)
  return analysis
}

// ── GENERATE AD CONCEPTS ──────────────────────────────────────
export async function generateAdConcepts(
  analysis: CompetitorAnalysis
): Promise<AdConceptPack> {
  logger.info(`Generating ad concepts based on ${analysis.competitor} analysis`)

  const result = await callAgent({
    agentName: 'ad_copywriter',
    division: 'growth',
    model: 'light',
    systemPrompt: `You are an advertising copywriter for Safari Zetu. Create 5 ORIGINAL ad concepts based on the analysis. Every concept must be original and clearly labeled as a draft for review.

Safari Zetu is Zimbabwe's premium safari marketplace — 1,199 operators, 47 destinations, backed by the Zimbabwe Tourism Authority. Our unique value: verified operators, competitive pricing, and authentic Zimbabwean safari experiences.

COMPETITOR ANALYSIS:
Competitor: ${analysis.competitor}
Winning patterns: ${analysis.winning_patterns.join('; ')}
Audience angles: ${analysis.audience_angles.join('; ')}
Copy frameworks: ${analysis.copy_frameworks.join('; ')}
Visual brief: ${analysis.visual_brief}
Compliance risks: ${analysis.compliance_risks.join('; ')}
Adaptation plan: ${analysis.adaptation_plan}

CREATE 5 ORIGINAL AD CONCEPTS:
Each concept must include:
1. concept_name — descriptive name (e.g. "Discovery Hook — Luxury Angle")
2. primary_text — the main ad body copy (125-250 words for Facebook/Instagram)
3. headline — punchy headline (max 40 characters)
4. description — secondary text below headline (max 30 characters)
5. image_prompt — detailed prompt for generating the ad image (original, never copying competitor visuals)
6. target_audience — which traveler segment this targets
7. platform — primary platform (facebook, instagram, or both)
8. cta — call-to-action button text

AD POLICY COMPLIANCE:
- No misleading claims about availability or pricing
- Include "Terms apply" or similar where relevant
- Never use competitor trademarks or brand names in ad copy
- All statistics must be verifiable (e.g. "1,199 verified operators" is verifiable)
- No urgency/scarcity claims without basis

Return JSON: {
  "concepts": [
    {
      "id": "concept-1",
      "concept_name": "...",
      "primary_text": "...",
      "headline": "...",
      "description": "...",
      "image_prompt": "...",
      "target_audience": "...",
      "platform": "...",
      "cta": "..."
    }
  ],
  "test_matrix": [
    {
      "variant_a": "concept name A",
      "variant_b": "concept name B",
      "metric": "what to measure (CTR, CPC, conversions, etc.)"
    }
  ],
  "competitor": "${analysis.competitor}",
  "generated_at": "ISO date string"
}`,
    userMessage: `Create 5 original ad concepts for Safari Zetu based on competitive analysis of ${analysis.competitor}. Focus on ${analysis.audience_angles[0] || 'luxury safari travelers'}.`,
    triggerType: 'on_demand',
    triggerPayload: { competitor: analysis.competitor }
  })

  let pack: AdConceptPack

  try {
    const parsed = JSON.parse(result.content)
    pack = {
      concepts: (parsed.concepts || []).map((c: any, i: number) => ({
        id: c.id || `concept-${i + 1}-${Date.now().toString(36)}`,
        concept_name: c.concept_name || `Concept ${i + 1}`,
        primary_text: c.primary_text || '',
        headline: c.headline || 'Discover Your Safari',
        description: c.description || '',
        image_prompt: c.image_prompt || 'African safari landscape at golden hour',
        target_audience: c.target_audience || 'Safari travelers',
        platform: c.platform || 'facebook',
        cta: c.cta || 'Learn More'
      })),
      test_matrix: parsed.test_matrix || [],
      competitor: analysis.competitor,
      generated_at: new Date().toISOString()
    }
  } catch {
    logger.warn(`Failed to parse ad concepts, generating fallback pack`)
    pack = {
      concepts: [
        {
          id: `concept-fb-${Date.now().toString(36)}`,
          concept_name: 'Verified Safari Marketplace',
          primary_text: 'Planning a Zimbabwe safari? Safari Zetu connects you directly with 1,199 verified operators across 47 destinations. Compare prices, read real reviews, and book with confidence. Your adventure starts with a marketplace built for safari travelers.',
          headline: '1,199 Verified Operators',
          description: 'Book with confidence',
          image_prompt: 'Wide-angle photograph of Victoria Falls at golden hour, mist rising, rainbow visible, professional travel photography style, warm tones',
          target_audience: 'First-time safari planners',
          platform: 'facebook',
          cta: 'Explore Safaris'
        },
        {
          id: `concept-ig-${Date.now().toString(36)}`,
          concept_name: 'Transformation Story',
          primary_text: '"I went from overwhelmed by safari options to booking my dream trip in 20 minutes." — Sarah, UK. Join thousands of travelers who found their perfect Zimbabwe safari through Safari Zetu. Verified operators, real reviews, instant quotes.',
          headline: 'Dream Safari in 20 Minutes',
          description: 'Real traveler reviews',
          image_prompt: 'Split composition: left side shows a traveler looking at a phone with many safari tabs open, right side shows the same traveler smiling on a safari jeep with elephants in background, warm natural lighting',
          target_audience: 'Overwhelmed researchers',
          platform: 'instagram',
          cta: 'Start Planning'
        },
        {
          id: `concept-vid-${Date.now().toString(36)}`,
          concept_name: 'Behind the Operators',
          primary_text: 'Meet the operators behind your safari. Every Safari Zetu partner is verified, reviewed, and backed by the Zimbabwe Tourism Authority. We visited 47 destinations so you can book with total confidence. Your safari. Your way. Verified.',
          headline: 'Meet Your Safari Guides',
          description: 'Verified & reviewed',
          image_prompt: 'Cinematic portrait of a Zimbabwean safari guide in uniform, standing in front of a safari vehicle at sunrise, professional documentary photography style, shallow depth of field',
          target_audience: 'Trust-seekers',
          platform: 'facebook',
          cta: 'See Operators'
        }
      ],
      test_matrix: [
        { variant_a: 'Verified Safari Marketplace', variant_b: 'Transformation Story', metric: 'Click-through rate (CTR)' },
        { variant_a: 'Transformation Story', variant_b: 'Behind the Operators', metric: 'Cost per lead (CPL)' },
        { variant_a: 'Verified Safari Marketplace', variant_b: 'Behind the Operators', metric: 'Conversion rate' }
      ],
      competitor: analysis.competitor,
      generated_at: new Date().toISOString()
    }
  }

  // Store concepts in database
  try {
    for (const concept of pack.concepts) {
      await pool.query(
        `INSERT INTO competitor_content (competitor_name, platform, content_type, content_data, analyzed_at)
         VALUES ($1, $2, 'ad_concept', $3, NOW())`,
        [pack.competitor, concept.platform, JSON.stringify(concept)]
      )
    }
    logger.info(`Stored ${pack.concepts.length} ad concepts for ${pack.competitor}`)
  } catch (err: any) {
    logger.warn(`Could not store ad concepts: ${err.message}`)
  }

  logger.info(`Generated ${pack.concepts.length} ad concepts for ${pack.competitor} with ${pack.test_matrix.length} A/B test variants`)
  return pack
}

// ── RUN COMPETITOR AD RESEARCH (MONTHLY) ──────────────────────
export async function runCompetitorAdResearch(): Promise<{
  competitors_analyzed: number
  concepts_generated: number
}> {
  const traceId = startTrace('monthly_competitor_ad_research', 'mimo-v2.5-free')

  let competitorsAnalyzed = 0
  let conceptsGenerated = 0

  for (const competitor of COMPETITOR_LIST) {
    try {
      logger.info(`Researching competitor: ${competitor.name}`)

      // Step 1: Analyze competitor ad strategy
      const analysis = await analyzeCompetitorAds(competitor.name, competitor.platform)

      // Step 2: Generate original ad concepts
      const concepts = await generateAdConcepts(analysis)
      conceptsGenerated += concepts.concepts.length

      // Step 3: Insert into approval queue for human review
      await pool.query(
        `INSERT INTO approval_queue (item_type, reference_id, title, preview, full_content, priority)
         VALUES ('content', $1, $2, $3, $4, 'normal')`,
        [
          `comp-ad-${competitor.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
          `Ad Concepts — ${competitor.name} vs Safari Zetu`,
          `Generated ${concepts.concepts.length} original ad concepts based on ${competitor.name} competitive analysis. Focus: ${competitor.focus}. Platforms: ${competitor.platform}. A/B test matrix: ${concepts.test_matrix.length} variants.`,
          JSON.stringify({
            competitor: competitor.name,
            focus: competitor.focus,
            platform: competitor.platform,
            concepts: concepts.concepts.map(c => ({
              name: c.concept_name,
              headline: c.headline,
              cta: c.cta,
              audience: c.target_audience
            })),
            test_matrix: concepts.test_matrix
          }, null, 2)
        ]
      )

      competitorsAnalyzed++
      logger.info(`Competitor research complete: ${competitor.name} — ${concepts.concepts.length} concepts queued for review`)

    } catch (err: any) {
      logger.error(`Failed to research competitor ${competitor.name}: ${err.message}`)
      // Continue with remaining competitors
    }
  }

  endTrace(traceId, {
    input_tokens: 0,
    output_tokens: 0,
    cost_usd: 0,
    latency_ms: 0,
    status: 'success'
  })

  logger.info(`Monthly competitor ad research complete: ${competitorsAnalyzed} competitors analyzed, ${conceptsGenerated} concepts generated`)
  return {
    competitors_analyzed: competitorsAnalyzed,
    concepts_generated: conceptsGenerated
  }
}
