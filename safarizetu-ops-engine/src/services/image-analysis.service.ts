import { logger } from './ai-agent.service'

// ── GEMINI VISION — Image Analysis ─────────────────────────────
// Analyzes uploaded images to understand what's in them,
// then provides structured data for content creation

const GEMINI_KEY = process.env.GEMINI_API_KEY || ''

export interface ImageAnalysis {
  // What's in the image
  subject: string              // "Elephant at waterhole"
  animals: string[]            // ["elephant", "impala"]
  landscape: string            // "savanna with acacia trees"
  mood: string                 // "golden hour, peaceful"
  location_guess: string       // "Likely Hwange or Mana Pools"
  
  // Content metadata
  quality_score: number        // 1-10 (photo quality)
  instagram_worthy: boolean    // Good enough for main feed?
  story_worthy: boolean        // Good enough for stories/reels?
  blog_worthy: boolean         // Good enough for a full blog post?
  
  // Content suggestions
  best_format: string          // "photo", "carousel", "reel", "story"
  color_palette: string[]      // Dominant colors for brand consistency
  suggested_hashtags: string[] // Relevant hashtags
  
  // Emotional hooks
  emotional_appeal: string     // "wonder", "adventure", "peace", "excitement"
  storytelling_angle: string   // Suggested narrative direction
  
  // Raw analysis from Gemini
  raw_analysis: string
}

// ── ANALYZE IMAGE (Gemini Vision) ──────────────────────────────
export async function analyzeImage(
  imageUrl: string,
  additionalContext?: string
): Promise<ImageAnalysis> {
  if (!GEMINI_KEY) {
    return getFallbackAnalysis(imageUrl)
  }

  try {
    const prompt = `Analyze this image for a safari tourism marketing company called Safari Zetu (Zimbabwe).

Provide a JSON analysis with:
1. subject: What is the main subject? (1 sentence)
2. animals: List of animals visible (empty array if none)
3. landscape: Describe the landscape/setting
4. mood: What feeling does this image evoke?
5. location_guess: Where was this likely taken in Zimbabwe/Africa?
6. quality_score: Rate 1-10 for marketing use
7. instagram_worthy: Would this work on an Instagram feed? (boolean)
8. story_worthy: Is this dynamic enough for stories/reels? (boolean)
9. blog_worthy: Could this lead a blog article? (boolean)
10. best_format: Best social format (photo/carousel/reel/story)
11. color_palette: Top 3 dominant colors (hex codes)
12. suggested_hashtags: 8 relevant hashtags
13. emotional_appeal: What emotion should the caption evoke?
14. storytelling_angle: Suggest a narrative direction for the caption

${additionalContext ? `Additional context: ${additionalContext}` : ''}

Return ONLY valid JSON, no other text.`

    const requestBody: any = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1000 }
    }

    // If it's a direct image URL, use multimodal input
    if (imageUrl.startsWith('http')) {
      // Determine correct MIME type based on file extension
      const mimeType = imageUrl.toLowerCase().endsWith('.png') 
        ? 'image/png'
        : imageUrl.toLowerCase().endsWith('.webp') 
        ? 'image/webp'
        : 'image/jpeg'; // Default to JPEG for backward compatibility
        
      requestBody.contents = [{
        role: 'user',
        parts: [
          { text: prompt },
          { fileData: { mimeType, fileUri: imageUrl } }
        ]
      }]
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(60000)
      }
    )

    if (!res.ok) throw new Error(`Gemini error ${res.status}`)
    const data = await res.json() as any
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in Gemini response')

    const parsed = JSON.parse(jsonMatch[0])
    logger.info(`Gemini analyzed image: ${parsed.subject}`)

    return {
      subject: parsed.subject || 'Safari scene',
      animals: parsed.animals || [],
      landscape: parsed.landscape || '',
      mood: parsed.mood || '',
      location_guess: parsed.location_guess || 'Zimbabwe',
      quality_score: parsed.quality_score || 5,
      instagram_worthy: parsed.instagram_worthy ?? true,
      story_worthy: parsed.story_worthy ?? true,
      blog_worthy: parsed.blog_worthy ?? false,
      best_format: parsed.best_format || 'photo',
      color_palette: parsed.color_palette || [],
      suggested_hashtags: parsed.suggested_hashtags || [],
      emotional_appeal: parsed.emotional_appeal || 'wonder',
      storytelling_angle: parsed.storytelling_angle || '',
      raw_analysis: text
    }
  } catch (e: any) {
    logger.error(`Gemini image analysis failed: ${e.message}`)
    return getFallbackAnalysis(imageUrl)
  }
}

// ── BATCH ANALYZE ──────────────────────────────────────────────
export async function analyzeImages(
  imageUrls: string[]
): Promise<ImageAnalysis[]> {
  const results: ImageAnalysis[] = []
  // Process in batches of 5 to avoid rate limits
  const batchSize = 5
  for (let i = 0; i < imageUrls.length; i += batchSize) {
    const batch = imageUrls.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(url => analyzeImage(url)))
    results.push(...batchResults)
  }
  logger.info(`Analyzed ${results.length} images`)
  return results
}

// ── FALLBACK (when Gemini is down) ─────────────────────────────
function getFallbackAnalysis(imageUrl: string): ImageAnalysis {
  const filename = imageUrl.split('/').pop() || 'unknown'
  return {
    subject: `Safari image: ${filename}`,
    animals: [],
    landscape: 'African landscape',
    mood: 'adventurous',
    location_guess: 'Zimbabwe',
    quality_score: 5,
    instagram_worthy: true,
    story_worthy: true,
    blog_worthy: false,
    best_format: 'photo',
    color_palette: ['#8B4513', '#228B22', '#FFD700'],
    suggested_hashtags: ['#SafariZetu', '#ZimbabweSafari', '#AfricanWildlife', '#SafariLife', '#WildlifePhotography', '#TravelAfrica', '#VictoriaFalls', '#HwangeNationalPark'],
    emotional_appeal: 'wonder',
    storytelling_angle: 'Share the beauty of Zimbabwe wildlife',
    raw_analysis: '[Fallback analysis — Gemini unavailable]'
  }
}
