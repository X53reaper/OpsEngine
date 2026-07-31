import dotenv from 'dotenv'
dotenv.config()

import { logger } from './ai-agent.service'

// ── APOLLO.IO API CLIENT ──────────────────────────────────────
// Provides real lead enrichment, company search, and people search
// Falls back gracefully when API key is not configured

const APOLLO_BASE_URL = 'https://api.apollo.io'

const apolloConfig = {
  apiKey: process.env.APOLLO_API_KEY || '',
  get configured(): boolean {
    return !!this.apiKey
  }
}

// ── TYPES ──────────────────────────────────────────────────────
export interface ApolloOrganization {
  id: string
  name: string
  website_url?: string
  linkedin_url?: string
  phone?: string
  email?: string
  founded_year?: number
  estimated_num_employees?: number
  industry?: string
  subindustry?: string
  city?: string
  state?: string
  country?: string
  short_description?: string
  keywords?: string[]
}

export interface ApolloPerson {
  id: string
  first_name: string
  last_name: string
  name: string
  title?: string
  email?: string
  email_status?: 'verified' | 'guessed' | 'unavailable'
  linkedin_url?: string
  phone_numbers?: Array<{ raw_number: string; sanitized_number: string }>
  organization?: {
    id: string
    name: string
    website_url?: string
    estimated_num_employees?: number
    industry?: string
  }
  city?: string
  state?: string
  country?: string
  headline?: string
}

export interface ApolloSearchFilters {
  titles?: string[]
  industries?: string[]
  locations?: string[]
  employee_count_min?: number
  employee_count_max?: number
  keywords?: string[]
  q_organization_keyword_tags?: string[]
  person_seniorities?: ('owner' | 'founder' | 'c_suite' | 'vp' | 'director' | 'manager' | 'senior' | 'entry' | 'intern')[]
}

interface ApolloApiResponse<T> {
  pagination?: {
    page: number
    per_page: number
    total_entries: number
    total_pages: number
  }
  organizations?: T[]
  people?: T[]
  account?: T
  person?: T
}

// ── CORE API CALL ──────────────────────────────────────────────
async function apolloPost<T>(endpoint: string, body: Record<string, any>): Promise<T | null> {
  if (!apolloConfig.configured) {
    logger.warn('Apollo.io API key not configured — skipping Apollo call')
    return null
  }

  try {
    const response = await fetch(`${APOLLO_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apolloConfig.apiKey
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`Apollo API error ${response.status}: ${errorText}`)
      return null
    }

    return await response.json() as T
  } catch (error: any) {
    logger.error(`Apollo API call failed: ${error.message}`)
    return null
  }
}

// ── SEARCH ORGANIZATIONS ───────────────────────────────────────
export async function searchOrganizations(
  filters: ApolloSearchFilters,
  page: number = 1,
  perPage: number = 25
): Promise<{ organizations: ApolloOrganization[]; total: number }> {
  const empty = { organizations: [], total: 0 }

  const body: Record<string, any> = {
    page,
    per_page: Math.min(perPage, 100),
    organization_num_employees_ranges: []
  }

  if (filters.titles?.length) {
    body.person_titles = filters.titles
  }
  if (filters.industries?.length) {
    body.organization_industry_tag_ids = []
    body.q_organization_keyword_tags = filters.industries
  }
  if (filters.locations?.length) {
    body.person_locations = filters.locations
    body.organization_locations = filters.locations
  }
  if (filters.employee_count_min || filters.employee_count_max) {
    const ranges: string[] = []
    if (filters.employee_count_min) ranges.push(`${filters.employee_count_min}`)
    if (filters.employee_count_max) ranges.push(`${filters.employee_count_max}`)
    body.organization_num_employees_ranges = [ranges.join('-')]
  }
  if (filters.keywords?.length) {
    body.q_organization_keyword_tags = filters.keywords
  }

  const data = await apolloPost<ApolloApiResponse<ApolloOrganization>>('/v1/mixed_companies/search', body)
  if (!data) return empty

  return {
    organizations: data.organizations || [],
    total: data.pagination?.total_entries || 0
  }
}

// ── SEARCH PEOPLE ──────────────────────────────────────────────
export async function searchPeople(
  filters: ApolloSearchFilters,
  page: number = 1,
  perPage: number = 25
): Promise<{ people: ApolloPerson[]; total: number }> {
  const empty = { people: [], total: 0 }

  const body: Record<string, any> = {
    page,
    per_page: Math.min(perPage, 100)
  }

  if (filters.titles?.length) {
    body.person_titles = filters.titles
  }
  if (filters.industries?.length) {
    body.q_organization_keyword_tags = filters.industries
  }
  if (filters.locations?.length) {
    body.person_locations = filters.locations
  }
  if (filters.employee_count_min || filters.employee_count_max) {
    const ranges: string[] = []
    if (filters.employee_count_min) ranges.push(`${filters.employee_count_min}`)
    if (filters.employee_count_max) ranges.push(`${filters.employee_count_max}`)
    body.organization_num_employees_ranges = [ranges.join('-')]
  }
  if (filters.keywords?.length) {
    body.q_keywords = filters.keywords.join(' ')
  }
  if (filters.person_seniorities?.length) {
    body.person_seniorities = filters.person_seniorities
  }

  const data = await apolloPost<ApolloApiResponse<ApolloPerson>>('/v1/mixed_people/search', body)
  if (!data) return empty

  return {
    people: data.people || [],
    total: data.pagination?.total_entries || 0
  }
}

// ── ENRICH PERSON (get detailed info by email or LinkedIn) ────
export async function enrichPerson(params: {
  email?: string
  linkedin_url?: string
  id?: string
}): Promise<ApolloPerson | null> {
  const body: Record<string, any> = {}
  if (params.email) body.email = params.email
  if (params.linkedin_url) body.linkedin_url = params.linkedin_url
  if (params.id) body.id = params.id

  const data = await apolloPost<{ person: ApolloPerson }>('/v1/people/match', body)
  return data?.person || null
}

// ── ENRICH ORGANIZATION ────────────────────────────────────────
export async function enrichOrganization(params: {
  domain?: string
  id?: string
  linkedin_url?: string
}): Promise<ApolloOrganization | null> {
  const body: Record<string, any> = {}
  if (params.domain) body.domain = params.domain
  if (params.id) body.organization_id = params.id
  if (params.linkedin_url) body.linkedin_url = params.linkedin_url

  const data = await apolloPost<{ account: ApolloOrganization }>('/v1/organizations/match', body)
  return data?.account || null
}

// ── BULK PERSON SEARCH ─────────────────────────────────────────
export async function bulkSearchPeople(
  filters: ApolloSearchFilters,
  maxResults: number = 100
): Promise<ApolloPerson[]> {
  const allPeople: ApolloPerson[] = []
  let page = 1
  const perPage = 25

  while (allPeople.length < maxResults) {
    const result = await searchPeople(filters, page, perPage)
    if (!result.people.length) break

    allPeople.push(...result.people)
    if (allPeople.length >= result.total) break
    page++
  }

  return allPeople.slice(0, maxResults)
}

// ── CONVENIENCE: FIND SAFARI-RELATED LEADS ─────────────────────
export async function findSafariLeads(
  location: string = 'United States',
  maxResults: number = 50
): Promise<{ organizations: ApolloOrganization[]; people: ApolloPerson[] }> {
  const safariKeywords = [
    'safari', 'wildlife', 'african travel', 'safari tourism',
    'adventure travel', 'ecotourism', 'wildlife photography'
  ]

  const titleKeywords = [
    'tour operator', 'travel agency', 'travel advisor',
    'partnership manager', 'business development', 'head of partnerships'
  ]

  const [orgs, people] = await Promise.all([
    searchOrganizations({
      keywords: safariKeywords,
      locations: [location],
      employee_count_min: 5
    }, 1, 50),
    searchPeople({
      titles: titleKeywords,
      keywords: safariKeywords,
      locations: [location],
      person_seniorities: ['c_suite', 'vp', 'director', 'manager']
    }, 1, maxResults)
  ])

  return {
    organizations: orgs.organizations,
    people: people.people
  }
}

// ── CHECK CONFIGURATION STATUS ─────────────────────────────────
export function getApolloStatus(): { configured: boolean; key_preview: string } {
  const key = apolloConfig.apiKey
  return {
    configured: !!key,
    key_preview: key ? `${key.substring(0, 8)}...${key.substring(key.length - 4)}` : 'not set'
  }
}

export { logger as apolloLogger }
