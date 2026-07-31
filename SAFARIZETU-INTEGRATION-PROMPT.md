# OpenCode Prompt — Safari Zetu Integration

You are helping integrate Safari Zetu with its AI Operations Engine. The engine has 34 AI agents running on OpenCode Zen free models at $0.00/month. Your job is to build the Safari Zetu side of this integration.

---

## CONTEXT

**Automation Engine Location:** `D:\Projects\SafariZetu Automation\safarizetu-ops-engine`
**Safari Zetu Location:** (ask user for path)
**Engine Status:** 34 agents built, security hardened, running on free models

---

## THE AUTOMATION ENGINE

### What It Does
- Responds to tourist enquiries within 2 minutes
- Activates new operators with 3-day onboarding sequence
- Generates SEO-optimized safari listings
- Discovers and qualifies sales leads daily
- Analyzes competitor pricing and suggests adjustments
- Runs a 24/7 booking bot on WhatsApp/Telegram
- Tracks sentiment and detects issues early
- Generates social media content automatically
- Manages billing, security, and feature flags
- Translates to 6 languages
- Tracks sustainability metrics

### 34 Agents (All Running)

**Division 1 — Growth (6 agents):**
1. Enquiry Acknowledgement — responds to tourist enquiries
2. Operator Activation — 3-day onboarding (day1/day3/day7)
3. SEO Content Generator — listing content for search
4. Sales Prospecting Engine — discovers leads daily
5. Dynamic Pricing Agent — competitor pricing analysis
6. Conversational Booking Bot — WhatsApp/Telegram 24/7

**Division 2 — Operations (5 agents):**
7. Inventory Management — safari availability tracking
8. Sentiment Tracker — review monitoring, issue detection
9. Social Content Engine — marketing post generation
10. Operator Performance Scorer — quality ranking
11. Automated Onboarding Flow — listing completion guide

**Division 3 — Partnerships (3 agents):**
12. Partnership Research — partner identification
13. Partnership Outreach — personalized emails
14. Revenue Splitter — profit-sharing calculations

**Division 4 — Support (5 agents):**
15. Feedback Triage — categorizes incoming feedback
16. Code Fix Generator — creates PRs from bug reports
17. Browser Test Runner — Puppeteer tests from feedback
18. Documentation Generator — API docs and guides
19. Chatbot Trainer — improves booking bot weekly

**Tier 3 — SaaS Scaling (3 agents):**
20. Billing Agent — subscriptions, invoices, payments
21. Security Monitor — threats, rate limiting, DDoS
22. Feature Flag Manager — A/B tests, kill switches

**Tier 4 — Growth & Expansion (4 agents):**
23. Market Expansion Researcher — new market identification
24. Influencer Partnership Agent — influencer relationships
25. Localization Agent — 6 language translations
26. Sustainability Tracker — carbon footprint tracking

**Revenue & Memory (8 agents):**
27. Revenue Analytics Dashboard — NL business queries
28. Automated Contract Generator — partner contracts
29. Memory Service — traveler preferences
30. Chroma Service — vector search
31. Browser Automation — lead research
32. Observability Service — Langfuse tracing
33. Cron Scheduler — 20+ automated jobs
34. Mailing Automation — newsletters, re-engagement

---

## INTEGRATION POINTS

### 1. Webhook Events (Safari Zetu → Engine)

**Endpoint:** `POST http://localhost:3001/webhook/ops-engine`

**Headers:**
```
Content-Type: application/json
X-Webhook-Signature: <hmac-sha256-of-raw-body>
```

**Events to send:**

```typescript
// ENQUIRY CREATED — When tourist submits enquiry
{
  "event": "enquiry.created",
  "data": {
    "id": "enq-123",
    "tourist_name": "Sarah",
    "tourist_email": "sarah@example.com",
    "destination": "Victoria Falls",
    "travel_dates": "2026-07-15 to 2026-07-20",
    "group_size": 2,
    "budget_range": "$3000-5000",
    "special_requirements": "Honeymoon trip, dietary restrictions"
  }
}

// OPERATOR REGISTERED — When new operator signs up
{
  "event": "operator.registered",
  "data": {
    "id": "op-456",
    "name": "Wild Horizons",
    "email": "info@wildhorizons.com",
    "operatorType": "lodge",
    "destinations": ["Hwange", "Victoria Falls"],
    "phone": "+263-4-123456"
  }
}

// BOOKING COMPLETED — When booking confirmed
{
  "event": "booking.completed",
  "data": {
    "id": "bk-789",
    "tourist_email": "sarah@example.com",
    "operator_id": "op-456",
    "safari_type": "Victoria Falls Adventure",
    "total_price": 4500,
    "currency": "USD",
    "travel_dates": "2026-07-15 to 2026-07-20",
    "commission_rate": 0.15
  }
}

// REVIEW SUBMITTED — When tourist leaves review
{
  "event": "review.submitted",
  "data": {
    "id": "rev-012",
    "source": "tourist_review",
    "author_name": "Sarah",
    "author_email": "sarah@example.com",
    "author_type": "tourist",
    "rating": 5,
    "title": "Amazing safari experience!",
    "body": "The Victoria Falls trip was incredible. Our guide was knowledgeable and the accommodations were perfect.",
    "page_url": "https://safarizetu.com/reviews/rev-012"
  }
}
```

### 2. Bridge Files (Copy to Safari Zetu)

**Source:** `D:\Projects\SafariZetu Automation\safarizetu-ops-engine\bridge\safarizetu-additions\`

**Files to copy:**
```
app/api/ops-bridge/route.ts    → Safari Zetu/app/api/ops-bridge/route.ts
lib/safarizetu-ops.ts          → Safari Zetu/lib/safarizetu-ops.ts
lib/ops-engine-config.ts       → Safari Zetu/lib/ops-engine-config.ts
```

### 3. API Endpoints (Engine → Safari Zetu)

The engine needs to call back to Safari Zetu for:
- Fetching operator details
- Updating booking status
- Writing review data
- Reading safari listings

**Configure in:** `safarizetu-ops-engine/.env`
```
SAFARIZETU_API_URL=https://safarizetu.com/api
SAFARIZETU_API_KEY=your-api-key-here
```

---

## WHAT TO BUILD ON SAFARI ZETU SIDE

### Priority 1: Core Integration

1. **Webhook Sender** — Send events when enquiries, registrations, bookings, reviews happen
2. **API Route** — `/api/ops-bridge` endpoint to receive agent responses
3. **Bridge Client** — SDK to call the automation engine
4. **Webhook Signature** — HMAC-SHA256 signing for outgoing webhooks

### Priority 2: Data Flow

5. **Enquiry Hook** — After enquiry creation, send to engine
6. **Operator Hook** — After registration, send to engine
7. **Booking Hook** — After booking confirmation, send to engine
8. **Review Hook** — After review submission, send to engine

### Priority 3: Response Handling

9. **Email Templates** — Engine generates HTML emails, Safari Zetu sends them
10. **Booking Bot Integration** — WhatsApp/Telegram bot connects to Safari Zetu booking system
11. **Dashboard Embed** — Embed agent metrics in Safari Zetu admin

### Priority 4: Advanced

12. **Real-time Updates** — WebSocket for live agent status
13. **Operator Portal** — Show activation progress, scores, analytics
14. **Tourist Portal** — Show booking status, recommendations, memory

---

## TECHNICAL REQUIREMENTS

### Webhook Signing
```typescript
import crypto from 'crypto'

function signWebhook(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

// Send webhook
const body = JSON.stringify({ event: 'enquiry.created', data: enquiry })
const signature = signWebhook(body, process.env.WEBHOOK_SECRET)
await fetch('http://localhost:3001/webhook/ops-engine', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature
  },
  body
})
```

### Bridge Client
```typescript
import { OpsEngineClient } from '@/lib/safarizetu-ops'

const ops = new OpsEngineClient({
  baseUrl: process.env.OPS_ENGINE_URL || 'http://localhost:3001',
  apiKey: process.env.OPS_ENGINE_API_KEY
})

// Run an agent
const result = await ops.runAgent('enquiry_acknowledgement', {
  tourist_name: 'Sarah',
  destination: 'Victoria Falls',
  travel_dates: '2026-07-15 to 2026-07-20'
})

// Get dashboard
const metrics = await ops.getDashboard()
```

### Environment Variables (Safari Zetu)
```
OPS_ENGINE_URL=http://localhost:3001
OPS_ENGINE_API_KEY=your-ops-engine-key
WEBHOOK_SECRET=your-webhook-secret
```

### Environment Variables (Ops Engine)
```
SAFARIZETU_API_URL=https://safarizetu.com/api
SAFARIZETU_API_KEY=your-safarizetu-key
SAFARIZETU_WEBHOOK_SECRET=your-webhook-secret
```

---

## FILES TO REFERENCE

**Automation Engine:**
- `safarizetu-ops-engine/src/webhook/receiver.ts` — webhook handler
- `safarizetu-ops-engine/src/services/ai-agent.service.ts` — agent service
- `safarizetu-ops-engine/src/services/security.service.ts` — security utilities
- `safarizetu-ops-engine/bridge/safari-zetu-additions/` — bridge files to copy
- `safarizetu-ops-engine/.env` — engine configuration
- `safarizetu-ops-engine/OPENCODE-PROMPT.md` — full integration guide

**Skills Available (70 total):**
- `D:\Projects\SafariZetu Automation\skills\` — 21 skill categories
- `D:\Projects\SafariZetu Automation\skills\manifest.json` — skill registry

---

## VERIFICATION

After building, verify:
1. TypeScript compiles: `npx tsc --noEmit`
2. Webhook sends correctly: Check engine logs
3. Agent responds: Check Safari Zetu receives response
4. Email sends: Check Resend dashboard
5. Dashboard shows metrics: Check `/api/dashboard/overview`

---

## CONSTRAINTS

- All AI calls use OpenCode Zen free models ($0.00)
- All secrets in `.env`, never hardcoded
- Every external API call needs try/catch with error logging
- HTML in emails must be escaped (XSS prevention)
- HMAC verification on all webhooks
- 30-second timeouts on all HTTP calls
- Rate limiting: 100 requests per minute max
