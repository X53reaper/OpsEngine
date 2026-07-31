import { callAgent, logger } from '../services/ai-agent.service'
import { storeMemory } from '../services/memory.service'
import { startTrace, endTrace } from '../services/observability.service'

// ── DOCUMENTATION GENERATOR ────────────────────────────────────
// Skills: Storm (article generation), Metagpt (docs), Aider (code)
// Auto-generates API docs, user guides, help center articles

interface Documentation {
  id: string
  doc_type: 'api' | 'guide' | 'changelog' | 'help_center' | 'faq'
  title: string
  content: string
  slug: string
  version?: string
  tags: string[]
  author: string
  published: boolean
}

// ── GENERATE API DOCS ──────────────────────────────────────────
export async function generateApiDocs(
  endpoint: string,
  method: string,
  description: string
): Promise<Documentation> {
  const result = await callAgent({
    agentName: 'doc_writer',
    division: 'content',
    model: 'heavy',
    systemPrompt: `You are a technical documentation writer for Safari Zetu API.
Generate comprehensive API documentation for this endpoint.

Endpoint: ${method} ${endpoint}
Description: ${description}

Include:
1. Overview and purpose
2. Authentication requirements
3. Request parameters (path, query, body)
4. Response format with examples
5. Error codes and handling
6. Rate limiting info
7. Code examples (curl, JavaScript, Python)

Format as clean Markdown. Be thorough but concise.`,
    userMessage: `Generate API docs for ${method} ${endpoint}`,
    triggerType: 'on_demand',
    triggerPayload: { endpoint, method }
  })

  const slug = endpoint.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-')

  return {
    id: `doc-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    doc_type: 'api',
    title: `API: ${method} ${endpoint}`,
    content: result.content,
    slug,
    version: '1.0',
    tags: ['api', method.toLowerCase(), slug],
    author: 'ai-agent',
    published: true
  }
}

// ── GENERATE USER GUIDE ────────────────────────────────────────
export async function generateUserGuide(
  topic: string,
  audience: 'tourist' | 'operator' | 'admin'
): Promise<Documentation> {
  const result = await callAgent({
    agentName: 'guide_writer',
    division: 'content',
    model: 'heavy',
    systemPrompt: `You are a user guide writer for Safari Zetu.
Write a comprehensive guide for ${audience}s about: ${topic}

Include:
1. Introduction and overview
2. Step-by-step instructions
3. Screenshots placeholders (describe what to capture)
4. Tips and best practices
5. Troubleshooting common issues
6. FAQ section

Write in clear, friendly language. Use numbered steps.
Format as clean Markdown.`,
    userMessage: `Write ${audience} guide for: ${topic}`,
    triggerType: 'on_demand',
    triggerPayload: { topic, audience }
  })

  const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-')

  return {
    id: `doc-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    doc_type: 'guide',
    title: `${topic} — ${audience.charAt(0).toUpperCase() + audience.slice(1)} Guide`,
    content: result.content,
    slug,
    tags: [audience, slug],
    author: 'ai-agent',
    published: true
  }
}

// ── GENERATE HELP CENTER ARTICLE ────────────────────────────────
export async function generateHelpArticle(
  question: string
): Promise<Documentation> {
  const result = await callAgent({
    agentName: 'help_writer',
    division: 'content',
    model: 'light',
    systemPrompt: `You are a help center writer for Safari Zetu.
Write a clear, helpful article answering this question: ${question}

Include:
1. Direct answer (first paragraph)
2. Detailed explanation
3. Step-by-step instructions if applicable
4. Related resources
5. Contact support if still stuck

Write in friendly, supportive tone. Keep under 500 words.
Format as clean Markdown.`,
    userMessage: `Write help article for: ${question}`,
    triggerType: 'on_demand',
    triggerPayload: { question }
  })

  const slug = question.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50)

  return {
    id: `doc-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    doc_type: 'help_center',
    title: question,
    content: result.content,
    slug,
    tags: ['help', 'faq'],
    author: 'ai-agent',
    published: true
  }
}

// ── GENERATE FAQ ───────────────────────────────────────────────
export async function generateFaq(
  category: 'booking' | 'payment' | 'account' | 'operator' | 'technical'
): Promise<Documentation> {
  const result = await callAgent({
    agentName: 'faq_writer',
    division: 'content',
    model: 'light',
    systemPrompt: `Generate 10 frequently asked questions and answers for Safari Zetu's ${category} section.

Format as:
**Q: Question here?**
A: Answer here.

Cover the most common ${category}-related questions travelers and operators ask.
Be concise but thorough. Use friendly language.`,
    userMessage: `Generate FAQ for ${category}`,
    triggerType: 'on_demand',
    triggerPayload: { category }
  })

  return {
    id: `doc-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    doc_type: 'faq',
    title: `${category.charAt(0).toUpperCase() + category.slice(1)} FAQ`,
    content: result.content,
    slug: `faq-${category}`,
    tags: ['faq', category],
    author: 'ai-agent',
    published: true
  }
}

// ── GENERATE CHANGELOG ─────────────────────────────────────────
export async function generateChangelog(
  version: string,
  changes: Array<{ type: 'added' | 'changed' | 'fixed' | 'removed'; description: string }>
): Promise<Documentation> {
  const grouped = {
    added: changes.filter(c => c.type === 'added'),
    changed: changes.filter(c => c.type === 'changed'),
    fixed: changes.filter(c => c.type === 'fixed'),
    removed: changes.filter(c => c.type === 'removed')
  }

  let content = `# Changelog — Safari Zetu v${version}\n\n`

  if (grouped.added.length > 0) {
    content += `## Added\n${grouped.added.map(c => `- ${c.description}`).join('\n')}\n\n`
  }
  if (grouped.changed.length > 0) {
    content += `## Changed\n${grouped.changed.map(c => `- ${c.description}`).join('\n')}\n\n`
  }
  if (grouped.fixed.length > 0) {
    content += `## Fixed\n${grouped.fixed.map(c => `- ${c.description}`).join('\n')}\n\n`
  }
  if (grouped.removed.length > 0) {
    content += `## Removed\n${grouped.removed.map(c => `- ${c.description}`).join('\n')}\n\n`
  }

  return {
    id: `doc-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    doc_type: 'changelog',
    title: `Changelog — v${version}`,
    content,
    slug: `changelog-v${version}`,
    version,
    tags: ['changelog', version],
    author: 'ai-agent',
    published: true
  }
}

// ── AUTO-GENERATE ALL DOCUMENTATION ────────────────────────────
export async function generateAllDocs(): Promise<{
  api_docs: number
  guides: number
  faqs: number
  help_articles: number
}> {
  const traceId = startTrace('doc_generation', 'mimo-v2.5-free')

  // API Docs
  const apiDocs = [
    await generateApiDocs('/api/enquiries', 'POST', 'Submit a new safari inquiry'),
    await generateApiDocs('/api/bookings', 'GET', 'List all bookings for the authenticated user'),
    await generateApiDocs('/api/operators', 'GET', 'List all active safari operators'),
    await generateApiDocs('/api/search', 'GET', 'Search safari experiences with filters'),
  ]

  // User Guides
  const guides = [
    await generateUserGuide('How to Book a Safari', 'tourist'),
    await generateUserGuide('Managing Your Safari Listings', 'operator'),
    await generateUserGuide('Platform Administration Dashboard', 'admin'),
  ]

  // FAQs
  const faqs = [
    await generateFaq('booking'),
    await generateFaq('payment'),
    await generateFaq('operator'),
  ]

  // Help Articles
  const helpArticles = [
    await generateHelpArticle('How do I change my booking dates?'),
    await generateHelpArticle('What payment methods are accepted?'),
    await generateHelpArticle('How do I become a safari operator on Safari Zetu?'),
  ]

  endTrace(traceId, { input_tokens: 0, output_tokens: 0, cost_usd: 0, latency_ms: 0, status: 'success' })

  logger.info(`Documentation generated: ${apiDocs.length} API docs, ${guides.length} guides, ${faqs.length} FAQs, ${helpArticles.length} help articles`)

  return {
    api_docs: apiDocs.length,
    guides: guides.length,
    faqs: faqs.length,
    help_articles: helpArticles.length
  }
}
