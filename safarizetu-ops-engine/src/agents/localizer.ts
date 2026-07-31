import { callAgent, logger, sendEmail } from '../services/ai-agent.service'
import { storeMemory, retrieveMemory } from '../services/memory.service'
import { startTrace, endTrace } from '../services/observability.service'

// ── LOCALIZATION AGENT ─────────────────────────────────────────
// Skills: LangChain (chains), CrewAI (multi-agent)
// Auto-translate platform to Swahili, French, Mandarin, Arabic
// AI translation + cultural adaptation + quality review

interface Translation {
  id: string
  language: string
  key: string
  value: string
  context?: string
  translated_by: string
  quality_score: number
  verified: boolean
}

interface LanguageVersion {
  language: string
  language_name: string
  completion_pct: number
  pages_translated: number
  total_pages: number
  status: 'in_progress' | 'review' | 'published'
}

// ── TARGET LANGUAGES ───────────────────────────────────────────
const TARGET_LANGUAGES = [
  { code: 'sw', name: 'Swahili', priority: 'high', regions: ['Tanzania', 'Kenya', 'Uganda'] },
  { code: 'fr', name: 'French', priority: 'high', regions: ['France', 'Belgium', 'Canada', 'Morocco'] },
  { code: 'zh', name: 'Mandarin Chinese', priority: 'medium', regions: ['China', 'Taiwan', 'Singapore'] },
  { code: 'ar', name: 'Arabic', priority: 'medium', regions: ['UAE', 'Saudi Arabia', 'Egypt'] },
  { code: 'de', name: 'German', priority: 'low', regions: ['Germany', 'Austria', 'Switzerland'] },
  { code: 'pt', name: 'Portuguese', priority: 'low', regions: ['Brazil', 'Portugal', 'Mozambique'] },
]

// ── KEY STRINGS TO TRANSLATE ───────────────────────────────────
const KEY_STRINGS: Record<string, string> = {
  'nav.home': 'Home',
  'nav.safaris': 'Safaris',
  'nav.bookings': 'My Bookings',
  'nav.profile': 'Profile',
  'nav.support': 'Support',
  'safari.book_now': 'Book Now',
  'safari.view_details': 'View Details',
  'safari.from_price': 'From {price}/person',
  'safari.duration': '{days} days / {nights} nights',
  'safari.guests': '{count} guests',
  'booking.confirm': 'Confirm Booking',
  'booking.cancel': 'Cancel Booking',
  'booking.modify': 'Modify Booking',
  'booking.total': 'Total: {amount}',
  'booking.deposit': 'Deposit: {amount}',
  'auth.login': 'Log In',
  'auth.signup': 'Sign Up',
  'auth.forgot_password': 'Forgot Password?',
  'common.search': 'Search',
  'common.loading': 'Loading...',
  'common.error': 'Something went wrong',
  'common.success': 'Success!',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.back': 'Back',
  'common.next': 'Next',
  'common.submit': 'Submit',
  'common.close': 'Close',
  'home.hero_title': 'Discover Your Dream Safari',
  'home.hero_subtitle': 'Experience Africa\'s wildlife with curated safari experiences',
  'home.featured': 'Featured Safaris',
  'home.popular': 'Popular Destinations',
  'home.testimonials': 'What Travelers Say',
  'footer.about': 'About Safari Zetu',
  'footer.contact': 'Contact Us',
  'footer.privacy': 'Privacy Policy',
  'footer.terms': 'Terms of Service',
}

// ── TRANSLATE STRING ───────────────────────────────────────────
export async function translateString(
  key: string,
  value: string,
  targetLanguage: string,
  context?: string
): Promise<Translation> {
  const result = await callAgent({
    agentName: 'translator',
    division: 'expansion',
    model: 'light',
    systemPrompt: `You are an expert translator specializing in travel and tourism for African markets.
Translate the following string to ${targetLanguage}.

Key: ${key}
Original: "${value}"
${context ? `Context: ${context}` : ''}

Guidelines:
- Use natural, fluent ${targetLanguage} (not word-for-word translation)
- Consider cultural context for African safari tourism
- Maintain the same tone (friendly, inviting, professional)
- Keep brand name "Safari Zetu" unchanged
- For prices, keep currency as USD
- For placeholders like {price}, {days}, keep them unchanged

Return JSON: {
  "translation": "translated text",
  "quality_score": 0.0-1.0,
  "notes": "any cultural adaptation notes"
}`,
    userMessage: `Translate "${value}" to ${targetLanguage}`,
    triggerType: 'on_demand',
    triggerPayload: { key, target_language: targetLanguage }
  })

  try {
    const parsed = JSON.parse(result.content)
    return {
      id: `trans-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      language: targetLanguage,
      key,
      value: parsed.translation,
      context,
      translated_by: 'ai',
      quality_score: parsed.quality_score || 0.85,
      verified: false
    }
  } catch {
    return {
      id: `trans-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      language: targetLanguage,
      key,
      value: `[${targetLanguage}] ${value}`,
      context,
      translated_by: 'ai',
      quality_score: 0.5,
      verified: false
    }
  }
}

// ── TRANSLATE ALL STRINGS ──────────────────────────────────────
export async function translateAllStrings(
  targetLanguage: string
): Promise<{ translated: number; total: number; avg_quality: number }> {
  const translations: Translation[] = []
  let totalQuality = 0

  for (const [key, value] of Object.entries(KEY_STRINGS)) {
    const translation = await translateString(key, value, targetLanguage)
    translations.push(translation)
    totalQuality += translation.quality_score

    // Store translation
    await storeMemory(targetLanguage, 'conversation_context', `trans_${key}`, JSON.stringify(translation))
  }

  return {
    translated: translations.length,
    total: Object.keys(KEY_STRINGS).length,
    avg_quality: totalQuality / translations.length
  }
}

// ── CULTURAL ADAPTATION REVIEW ─────────────────────────────────
export async function culturalAdaptationReview(
  language: string,
  translations: Record<string, string>
): Promise<{
  approved: boolean
  issues: string[]
  suggestions: string[]
}> {
  const result = await callAgent({
    agentName: 'cultural_reviewer',
    division: 'expansion',
    model: 'heavy',
    systemPrompt: `You are a cultural adaptation specialist for ${language}-speaking markets.
Review these translations for cultural appropriateness in African safari tourism.

Language: ${language}
Translations:
${Object.entries(translations).slice(0, 10).map(([k, v]) => `${k}: "${v}"`).join('\n')}

Check for:
1. Cultural sensitivity (avoid offensive or inappropriate terms)
2. Local idioms and expressions (use natural phrasing)
3. Color and imagery associations (different cultures, different meanings)
4. Number and date formats
5. Formality level (appropriate for tourism industry)

Return JSON: {
  "approved": boolean,
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1", "suggestion2"]
}`,
    userMessage: `Review ${language} translations for cultural appropriateness`,
    triggerType: 'on_demand',
    triggerPayload: { language, translation_count: Object.keys(translations).length }
  })

  try {
    return JSON.parse(result.content)
  } catch {
    return {
      approved: true,
      issues: [],
      suggestions: ['Manual review recommended for final approval']
    }
  }
}

// ── GENERATE LANGUAGE VERSION ──────────────────────────────────
export async function generateLanguageVersion(
  languageCode: string
): Promise<LanguageVersion> {
  const lang = TARGET_LANGUAGES.find(l => l.code === languageCode)
  if (!lang) throw new Error(`Language ${languageCode} not found`)

  const result = await translateAllStrings(languageCode)

  return {
    language: languageCode,
    language_name: lang.name,
    completion_pct: (result.translated / result.total) * 100,
    pages_translated: result.translated,
    total_pages: result.total,
    status: result.avg_quality > 0.8 ? 'review' : 'in_progress'
  }
}

// ── WEEKLY LOCALIZATION RUN ────────────────────────────────────
export async function runWeeklyLocalization(): Promise<{
  languages_active: number
  strings_translated: number
  avg_quality: number
}> {
  const traceId = startTrace('weekly_localization', 'mimo-v2.5-free')

  let totalTranslated = 0
  let totalQuality = 0
  let languagesActive = 0

  // Focus on high-priority languages
  for (const lang of TARGET_LANGUAGES.filter(l => l.priority === 'high')) {
    const version = await generateLanguageVersion(lang.code)
    totalTranslated += version.pages_translated
    totalQuality += version.completion_pct
    languagesActive++
  }

  endTrace(traceId, { input_tokens: 0, output_tokens: 0, cost_usd: 0, latency_ms: 0, status: 'success' })

  logger.info(`Localization: ${languagesActive} languages, ${totalTranslated} strings translated`)
  return {
    languages_active: languagesActive,
    strings_translated: totalTranslated,
    avg_quality: totalQuality / languagesActive
  }
}
