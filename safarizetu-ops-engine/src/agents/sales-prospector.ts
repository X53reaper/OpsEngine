import { callAgent, logger, sendEmail, fetchFromSafariZetu } from '../services/ai-agent.service'
import { storeMemory, retrieveMemory } from '../services/memory.service'
import { queryCollection, upsertDocuments } from '../services/chroma.service'
import { startTrace, endTrace } from '../services/observability.service'
import {
  searchPeople,
  searchOrganizations,
  enrichPerson,
  enrichOrganization,
  getApolloStatus,
  ApolloPerson,
  ApolloOrganization,
  ApolloSearchFilters
} from '../services/apollo.service'
import { verifyEmail, isNeverBounceConfigured } from '../services/neverbounce.service'

// ── SALES PROSPECTING ENGINE ───────────────────────────────────
// Skills: Apollo.io (lead discovery + enrichment), Browser-Use (scraping)
// Auto-discovers tour operators, travel agencies, corporate planners
// Enriches leads, scores them, and generates personalized outreach

interface Lead {
  id: string
  company_name: string
  contact_name?: string
  email?: string
  phone?: string
  website?: string
  company_type: 'tour_operator' | 'travel_agency' | 'corporate' | 'wedding_planner' | 'influencer' | 'other'
  location?: string
  employee_count?: number
  estimated_revenue?: number
  lead_score: number
  lead_status: string
  source: string
  notes?: string
  apollo_person_id?: string
  apollo_org_id?: string
}

interface OutreachEmail {
  to: string
  subject: string
  body: string
  lead_id: string
}

// ── LEAD SOURCES ───────────────────────────────────────────────
// Apollo.io search queries mapped to category types
const LEAD_SOURCES: Record<string, ApolloSearchFilters> = {
  tour_operators: {
    titles: ['Owner', 'CEO', 'Managing Director', 'Partnership Manager', 'Business Development'],
    industries: ['safari', 'wildlife tourism', 'adventure travel', 'tour operator'],
    locations: ['Zimbabwe', 'Kenya', 'Tanzania', 'South Africa', 'Botswana'],
    employee_count_min: 2,
    person_seniorities: ['owner', 'founder', 'c_suite', 'vp', 'director']
  },
  travel_agencies: {
    titles: ['Travel Advisor', 'Travel Agent', 'Partnership Manager', 'Director of Partnerships', 'Head of Business Development'],
    industries: ['travel agency', 'travel services', 'tourism'],
    locations: ['United Kingdom', 'United States', 'Germany', 'Australia', 'United Arab Emirates'],
    employee_count_min: 5,
    person_seniorities: ['c_suite', 'vp', 'director', 'manager']
  },
  corporate: {
    titles: ['Head of Events', 'Corporate Travel Manager', 'Executive Assistant', 'Chief of Staff', 'Office Manager'],
    industries: ['corporate events', 'corporate travel', 'team building', 'event planning'],
    locations: ['United States', 'United Kingdom', 'South Africa', 'United Arab Emirates'],
    employee_count_min: 50,
    person_seniorities: ['c_suite', 'vp', 'director', 'manager']
  },
  wedding_planners: {
    titles: ['Wedding Planner', 'Event Coordinator', 'Destination Wedding Specialist', 'Owner'],
    industries: ['wedding planning', 'event planning', 'wedding services'],
    locations: ['United States', 'United Kingdom', 'South Africa', 'United Arab Emirates'],
    employee_count_min: 1,
    person_seniorities: ['owner', 'founder', 'c_suite', 'director']
  }
}

// Fallback for when Apollo is not configured
const FALLBACK_LEAD_SOURCES = {
  tour_operators: [
    'safari operators Zimbabwe directory',
    'tour companies Kenya association',
    'wildlife tour operators Tanzania',
    'adventure travel operators Southern Africa',
    'luxury safari companies East Africa',
  ],
  travel_agencies: [
    'travel agencies specializing Africa safaris',
    'UK travel advisors wildlife holidays',
    'US travel agents safari specialist',
    'German tour operators Africa',
    'Chinese travel agencies safari packages',
  ],
  corporate: [
    'corporate retreat venues Africa',
    'team building safari packages Zimbabwe',
    'executive wellness retreat safaris',
    'conference venues with safari experience',
  ],
  wedding_planners: [
    'safari wedding planners Africa',
    'honeymoon safari specialists',
    'destination wedding coordinators Zimbabwe',
  ]
}

// ── CONVERT APOLLO PERSON TO LEAD ───────────────────────────────
function apolloPersonToLead(person: ApolloPerson, category: string): Lead {
  const org = person.organization
  return {
    id: `lead-apollo-${person.id}`,
    company_name: org?.name || 'Unknown',
    contact_name: person.name,
    email: person.email,
    phone: person.phone_numbers?.[0]?.sanitized_number,
    website: org?.website_url,
    company_type: category as Lead['company_type'],
    location: [person.city, person.state, person.country].filter(Boolean).join(', ') || undefined,
    employee_count: org?.estimated_num_employees,
    lead_score: 0, // Scored later
    lead_status: 'new',
    source: `apollo_person_${category}`,
    notes: person.headline || person.title || undefined,
    apollo_person_id: person.id,
    apollo_org_id: org?.id
  }
}

function apolloOrgToLead(org: ApolloOrganization, category: string): Lead {
  return {
    id: `lead-apollo-org-${org.id}`,
    company_name: org.name,
    contact_name: undefined, // Needs enrichment
    email: org.email,
    website: org.website_url,
    company_type: category as Lead['company_type'],
    location: [org.city, org.state, org.country].filter(Boolean).join(', ') || undefined,
    employee_count: org.estimated_num_employees,
    lead_score: 0,
    lead_status: 'new',
    source: `apollo_org_${category}`,
    notes: org.short_description,
    apollo_org_id: org.id
  }
}

// ── GENERATE LEADS (Apollo-first, LLM fallback) ───────────────
export async function generateLeads(
  category: string,
  count: number = 10
): Promise<Lead[]> {
  const leads: Lead[] = []
  const apollo = getApolloStatus()

  if (apollo.configured) {
    // ── APOLLO.IO PATH: Real data from Apollo ──────────────────
    logger.info(`Using Apollo.io for ${category} lead discovery`)

    const filters = LEAD_SOURCES[category]
    if (filters) {
      // Search for people (decision makers)
      const personResults = await searchPeople(filters, 1, count)
      for (const person of personResults.people) {
        leads.push(apolloPersonToLead(person, category))
      }

      // If we need more leads, search organizations too
      if (leads.length < count) {
        const orgResults = await searchOrganizations(filters, 1, count - leads.length)
        for (const org of orgResults.organizations) {
          leads.push(apolloOrgToLead(org, category))
        }
      }

      logger.info(`Apollo returned ${leads.length} real leads for ${category}`)
    }
  }

  // ── LLM FALLBACK: Generate synthetic leads if Apollo unavailable ──
  if (leads.length === 0) {
    logger.info(`Falling back to LLM-generated leads for ${category}`)
    const fallbackSources = FALLBACK_LEAD_SOURCES[category as keyof typeof FALLBACK_LEAD_SOURCES] || []

    for (const source of fallbackSources) {
      const result = await callAgent({
        agentName: 'sales_prospector',
        division: 'growth',
        model: 'light',
        systemPrompt: `You are a sales intelligence agent for Safari Zetu, a safari marketplace platform.
Research and generate realistic leads for: ${source}

For each lead, provide:
- company_name: Realistic company name
- contact_name: Decision maker name
- email: Professional email
- website: Company website
- company_type: One of tour_operator, travel_agency, corporate, wedding_planner
- location: City, Country
- employee_count: Approximate size
- estimated_revenue: USD amount
- lead_score: 0-100 based on fit for safari marketplace
- notes: Why this company is a good fit

Generate ${count} leads as a JSON array. Focus on companies that would benefit from:
1. Listing their safari experiences on our marketplace
2. Receiving bookings through our platform
3. Accessing our AI-powered operations tools

Return ONLY valid JSON array, no other text.`,
        userMessage: `Generate ${count} qualified leads for ${category.replace('_', ' ')} segment. Research real companies in the African safari industry.`,
        triggerType: 'scheduled_daily',
        triggerPayload: { category, count }
      })

      try {
        const parsed = JSON.parse(result.content)
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            leads.push({
              id: `lead-llm-${Date.now()}-${Math.random().toString(36).substring(7)}`,
              company_name: item.company_name || 'Unknown',
              contact_name: item.contact_name,
              email: item.email,
              website: item.website,
              company_type: item.company_type || 'other',
              location: item.location,
              employee_count: item.employee_count,
              estimated_revenue: item.estimated_revenue,
              lead_score: Math.min(100, Math.max(0, item.lead_score || 50)),
              lead_status: 'new',
              source: `llm_${category}`,
              notes: item.notes
            })
          }
        }
      } catch (e) {
        logger.warn(`Failed to parse LLM leads for ${category}: ${e}`)
      }
    }
  }

  // Store in Chroma for future reference
  await upsertDocuments('leads', leads.map(l => ({
    id: l.id,
    text: `${l.company_name} - ${l.company_type} - ${l.location} - Score: ${l.lead_score}`,
    metadata: { company_type: l.company_type, score: l.lead_score, source: l.source }
  })))

  logger.info(`Generated ${leads.length} leads for ${category}`)
  return leads
}

// ── ENRICH LEAD WITH APOLLO DATA ───────────────────────────────
export async function enrichLead(lead: Lead): Promise<Lead> {
  const apollo = getApolloStatus()
  if (!apollo.configured) return lead

  // Try to enrich by email
  if (lead.email && !lead.apollo_person_id) {
    const person = await enrichPerson({ email: lead.email })
    if (person) {
      lead.apollo_person_id = person.id
      lead.contact_name = lead.contact_name || person.name
      lead.phone = lead.phone || person.phone_numbers?.[0]?.sanitized_number
      if (person.organization) {
        lead.apollo_org_id = person.organization.id
        lead.company_name = lead.company_name === 'Unknown' ? person.organization.name : lead.company_name
        lead.employee_count = lead.employee_count || person.organization.estimated_num_employees
        lead.website = lead.website || person.organization.website_url
      }
    }
  }

  // Try to enrich organization by website domain
  if (lead.website && !lead.apollo_org_id) {
    try {
      const domain = new URL(lead.website).hostname.replace('www.', '')
      const org = await enrichOrganization({ domain })
      if (org) {
        lead.apollo_org_id = org.id
        lead.company_name = lead.company_name === 'Unknown' ? org.name : lead.company_name
        lead.employee_count = lead.employee_count || org.estimated_num_employees
        lead.location = lead.location || [org.city, org.state, org.country].filter(Boolean).join(', ')
      }
    } catch { /* invalid URL, skip */ }
  }

  return lead
}

// ── SCORE LEAD ─────────────────────────────────────────────────
export async function scoreLead(lead: Lead): Promise<number> {
  const result = await callAgent({
    agentName: 'lead_scorer',
    division: 'growth',
    model: 'light',
    systemPrompt: `You are a lead scoring agent. Rate this lead 0-100 based on:
- Company size (larger = higher)
- Safari relevance (direct safari = high, travel adjacent = medium, other = low)
- Location (Africa-based = high, Europe/US = medium, other = low)
- Revenue potential (higher revenue = higher score)
- Engagement likelihood (responsive = higher)

Return ONLY a number 0-100.`,
    userMessage: `Score this lead: ${JSON.stringify(lead)}`,
    triggerType: 'on_demand',
    triggerPayload: { lead_id: lead.id }
  })

  const score = parseInt(result.content.replace(/\D/g, '')) || 50
  return Math.min(100, Math.max(0, score))
}

// ── GENERATE OUTREACH EMAIL ────────────────────────────────────
export async function generateOutreach(lead: Lead): Promise<OutreachEmail> {
  const profile = await retrieveMemory(lead.id, 'traveler_preference')
  const contextStr = profile.length > 0 ? `\nContext: ${JSON.stringify(profile)}` : ''

  const result = await callAgent({
    agentName: 'outreach_writer',
    division: 'growth',
    model: 'light',
    systemPrompt: `You are an expert outreach writer for Safari Zetu, a leading safari marketplace platform.
Write a personalized cold outreach email to ${lead.contact_name || 'the decision maker'} at ${lead.company_name}.

Company details: ${lead.location || 'Africa'}, ${lead.company_type}, ~${lead.employee_count || 'unknown'} employees
${contextStr}

Email guidelines:
- Subject line: curiosity-driven, not salesy
- Opening: reference something specific about their company
- Value proposition: how Safari Zetu can increase their bookings by 30-50%
- Social proof: mention other safari operators on our platform
- CTA: easy next step (15-min call, not a demo)
- Tone: professional but warm, not corporate

Return JSON: {"subject": "...", "body": "..."}`,
    userMessage: `Write outreach email for ${lead.company_name} (${lead.company_type})`,
    triggerType: 'on_demand',
    triggerPayload: { lead_id: lead.id }
  })

  try {
    const parsed = JSON.parse(result.content)
    return {
      to: lead.email || '',
      subject: parsed.subject || `Partnership Opportunity — Safari Zetu`,
      body: parsed.body || result.content,
      lead_id: lead.id
    }
  } catch {
    return {
      to: lead.email || '',
      subject: `Partnership Opportunity — Safari Zetu`,
      body: result.content,
      lead_id: lead.id
    }
  }
}

// ── SEND OUTREACH ──────────────────────────────────────────────
const COLD_EMAIL_RATE_LIMIT_MS = 30_000 // 30 seconds between cold sends
const CAN_SPAM_FOOTER = `
---
Safari Zetu | Safari Marketplace
Plot 45 Samora Machel Ave, Harare, Zimbabwe
You're receiving this because we believe our platform can help grow your safari business.
Unsubscribe: https://safarizetu.com/unsubscribe?email=${'{email}'}
`

export async function sendOutreach(email: OutreachEmail): Promise<boolean> {
  if (!email.to) {
    logger.warn(`No email for lead ${email.lead_id}, skipping`)
    return false
  }

  // NeverBounce verification — skip invalid/disposable/risky emails
  if (isNeverBounceConfigured()) {
    const verification = await verifyEmail(email.to)
    if (verification.status === 'invalid' || verification.status === 'disposable') {
      logger.warn(`Skipping ${email.to}: NeverBounce says ${verification.status}`)
      return false
    }
    if (verification.status === 'risky') {
      logger.warn(`Risky email ${email.to} (flags: ${verification.flags.join(', ')}), sending anyway`)
    }
  }

  // CAN-SPAM: append footer with address + unsubscribe
  const bodyWithFooter = `${email.body}\n\n${CAN_SPAM_FOOTER.replace('{email}', encodeURIComponent(email.to))}`

  try {
    await sendEmail(email.to, email.subject, bodyWithFooter)
    logger.info(`Cold outreach sent to ${email.to}`)
    await storeMemory(email.lead_id, 'conversation_context', 'cold_outreach_sent', new Date().toISOString())
    return true
  } catch (error) {
    logger.error(`Failed to send cold outreach to ${email.to}: ${error}`)
    return false
  }
}

// ── DAILY PROSPECTING RUN ──────────────────────────────────────
export async function runDailyProspecting(): Promise<{
  total_leads: number
  outreach_sent: number
  apollo_sourced: number
  llm_sourced: number
  categories: string[]
}> {
  const traceId = startTrace('daily_prospecting', 'mimo-v2.5-free')
  const categories: string[] = ['tour_operators', 'travel_agencies', 'corporate']
  let totalLeads = 0
  let outreachSent = 0
  let apolloSourced = 0
  let llmSourced = 0

  const apollo = getApolloStatus()

  for (const category of categories) {
    const leads = await generateLeads(category, 5)
    totalLeads += leads.length

    for (const lead of leads) {
      // Enrich leads from Apollo
      if (apollo.configured) {
        const enriched = await enrichLead(lead)
        Object.assign(lead, enriched)
        if (lead.source.startsWith('apollo_')) apolloSourced++
        else llmSourced++
      }

      // ── SCORE LEAD (the bug fix: Apollo leads had score=0 forever) ──
      lead.lead_score = await scoreLead(lead)

      // Skip LLM-generated leads with fake/placeholder emails
      if (lead.source.startsWith('llm_') && lead.email) {
        const fakePatterns = ['@example.com', '@test.com', '@fake.com', '@safari.com']
        if (fakePatterns.some(p => lead.email?.toLowerCase().includes(p))) {
          logger.warn(`Skipping LLM lead ${lead.company_name} — email looks fake: ${lead.email}`)
          continue
        }
      }

      // Only send outreach to leads with verified emails and high scores
      if (lead.lead_score >= 70 && lead.email) {
        const email = await generateOutreach(lead)
        const sent = await sendOutreach(email)
        if (sent) {
          outreachSent++
          // Rate limit: 30s between cold sends to protect domain reputation
          await new Promise(r => setTimeout(r, COLD_EMAIL_RATE_LIMIT_MS))
        }
      }
    }
  }

  endTrace(traceId, { input_tokens: 0, output_tokens: 0, cost_usd: 0, latency_ms: 0, status: 'success' })

  const summary = apollo.configured
    ? `Daily prospecting: ${totalLeads} leads (${apolloSourced} Apollo, ${llmSourced} LLM), ${outreachSent} outreach sent`
    : `Daily prospecting: ${totalLeads} leads (all LLM-generated, Apollo not configured), ${outreachSent} outreach sent`

  logger.info(summary)
  return { total_leads: totalLeads, outreach_sent: outreachSent, apollo_sourced: apolloSourced, llm_sourced: llmSourced, categories }
}
