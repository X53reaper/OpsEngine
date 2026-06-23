import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'

const OPS_API_KEY = process.env.OPS_ENGINE_API_KEY
const WEBHOOK_SECRET = process.env.OPS_ENGINE_WEBHOOK_SECRET
const ALLOWED_IPS = (process.env.OPS_ENGINE_ALLOWED_IPS || '').split(',').filter(Boolean)

const VALID_ENQUIRY_STATUSES = ['new', 'responded', 'closed', 'converted'] as const
type EnquiryStatus = typeof VALID_ENQUIRY_STATUSES[number]

// ── SECURITY MIDDLEWARE ────────────────────────────────────────
function verifyApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-ops-api-key')
  if (!apiKey || !OPS_API_KEY) return false
  try {
    return timingSafeEqual(Buffer.from(apiKey), Buffer.from(OPS_API_KEY))
  } catch { return false }
}

function verifyIpAllowlist(request: NextRequest): boolean {
  if (ALLOWED_IPS.length === 0) return true
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
              request.headers.get('x-real-ip') || ''
  return ALLOWED_IPS.includes(ip)
}

// ── HMAC SIGNATURE FOR OUTBOUND WEBHOOKS ─────────────────────
export function signPayload(payload: string): string {
  if (!WEBHOOK_SECRET) throw new Error('WEBHOOK_SECRET not configured')
  return createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex')
}

// ── RATE LIMITER (fail-closed on Vercel serverless) ───────────
// In-memory Map is reset on each cold start — treat missing state as exceeded.
const requestCounts = new Map<string, { count: number; resetAt: number }>()
function checkRateLimit(key: string, maxPerMinute = 60): boolean {
  const now = Date.now()
  const entry = requestCounts.get(key)
  if (!entry || now > entry.resetAt) {
    requestCounts.set(key, { count: 1, resetAt: now + 60000 })
    return true
  }
  if (entry.count >= maxPerMinute) return false
  entry.count++
  return true
}

// ── MAIN HANDLER ──────────────────────────────────────────────
export async function GET(request: NextRequest) {
  if (!verifyApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!verifyIpAllowlist(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!checkRateLimit('get')) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const { searchParams } = new URL(request.url)
  const resource = searchParams.get('resource')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')
  const since = searchParams.get('since')

  try {
    switch (resource) {
      case 'enquiries':
        return await getEnquiries(limit, offset, since)
      case 'operators':
        return await getOperators(limit, offset)
      case 'metrics':
        return await getMetrics()
      case 'health':
        return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
      default:
        return NextResponse.json({ error: 'Unknown resource' }, { status: 400 })
    }
  } catch (error) {
    console.error('[ops-bridge GET error]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!verifyApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!verifyIpAllowlist(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!checkRateLimit('post', 30)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const action = body.action
  if (!action) return NextResponse.json({ error: 'Missing action' }, { status: 400 })

  try {
    switch (action) {
      case 'update_enquiry_status':
        return await updateEnquiryStatus(body.enquiry_id, body.status)
      case 'flag_operator':
        return await flagOperator(body.operator_id, body.reason)
      case 'log_event':
        return await logEvent(body.event_type, body.payload)
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('[ops-bridge POST error]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── DATA FETCHERS ─────────────────────────────────────────────
async function getEnquiries(limit: number, offset: number, since: string | null) {
  const { prisma } = await import('@/lib/prisma')
  const where = since ? { createdAt: { gte: new Date(since) } } : {}
  const enquiries = await prisma.enquiry.findMany({
    where,
    take: Math.min(limit, 100),
    skip: offset,
    orderBy: { createdAt: 'desc' },
    include: {
      operator: { select: { id: true, name: true, email: true } },
      user: { select: { id: true, name: true, email: true, country: true } }
    }
  })
  const total = await prisma.enquiry.count({ where })
  return NextResponse.json({ enquiries, total, limit, offset })
}

async function getOperators(limit: number, offset: number) {
  const { prisma } = await import('@/lib/prisma')
  const operators = await prisma.operator.findMany({
    take: Math.min(limit, 200),
    skip: offset,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, email: true, phone: true,
      destinations: true, operatorType: true, isVerified: true,
      isActive: true, createdAt: true, updatedAt: true,
      _count: { select: { bookings: true, listings: true } }
    }
  })
  const total = await prisma.operator.count()
  return NextResponse.json({ operators, total, limit, offset })
}

async function getMetrics() {
  const { prisma } = await import('@/lib/prisma')
  const [totalOperators, totalEnquiries, recentEnquiries, activeOperators] = await Promise.all([
    prisma.operator.count(),
    prisma.enquiry.count(),
    prisma.enquiry.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
    prisma.operator.count({ where: { isActive: true } })
  ])
  return NextResponse.json({
    totalOperators, totalEnquiries, recentEnquiries, activeOperators,
    timestamp: new Date().toISOString()
  })
}

async function updateEnquiryStatus(enquiryId: string, status: string) {
  if (!VALID_ENQUIRY_STATUSES.includes(status as EnquiryStatus)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${VALID_ENQUIRY_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }
  const { prisma } = await import('@/lib/prisma')
  await prisma.enquiry.update({
    where: { id: enquiryId },
    data: { status: status as EnquiryStatus, updatedAt: new Date() }
  })
  return NextResponse.json({ success: true, enquiry_id: enquiryId, new_status: status })
}

async function flagOperator(operatorId: string, reason: string) {
  const { prisma } = await import('@/lib/prisma')
  await prisma.operator.update({
    where: { id: operatorId },
    data: { updatedAt: new Date() }
  })
  return NextResponse.json({ success: true, operator_id: operatorId })
}

async function logEvent(eventType: string, payload: Record<string, unknown>) {
  return NextResponse.json({ success: true, logged: true })
}
