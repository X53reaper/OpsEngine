import dotenv from 'dotenv'
dotenv.config()

// ── API TEST SUITE ─────────────────────────────────────────────
// Tests every API key and service connection

const PASS = '✅'
const FAIL = '❌'
const SKIP = '⏭️'

async function testOpenCodeZen(): Promise<void> {
  console.log('\n── OpenCode Zen (LLM) ──')
  const key = process.env.OPENCODE_ZEN_API_KEY
  const base = process.env.OPENCODE_ZEN_BASE_URL
  if (!key) { console.log(`${SKIP} Not configured`); return }

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mimo-v2.5-free',
        max_tokens: 20,
        messages: [{ role: 'user', content: 'Say "API OK"' }]
      }),
      signal: AbortSignal.timeout(30000)
    })
    const data = await res.json() as any
    const reply = data.choices?.[0]?.message?.content || ''
    console.log(`${PASS} Zen responded: "${reply.substring(0, 60)}"`)
  } catch (e: any) { console.log(`${FAIL} ${e.message}`) }
}

async function testGemini(): Promise<void> {
  console.log('\n── Gemini (LLM Fallback) ──')
  const key = process.env.GEMINI_API_KEY
  if (!key) { console.log(`${SKIP} Not configured`); return }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Say "API OK"' }] }],
        generationConfig: { maxOutputTokens: 20 }
      }),
      signal: AbortSignal.timeout(30000)
    })
    const data = await res.json() as any
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    console.log(`${PASS} Gemini responded: "${reply.substring(0, 60)}"`)
  } catch (e: any) { console.log(`${FAIL} ${e.message}`) }
}

async function testOpenRouter(): Promise<void> {
  console.log('\n── OpenRouter (LLM Fallback #2) ──')
  const key = process.env.OPENROUTER_API_KEY
  if (!key) { console.log(`${SKIP} Not configured`); return }

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-7b-instruct:free',
        max_tokens: 20,
        messages: [{ role: 'user', content: 'Say "API OK"' }]
      }),
      signal: AbortSignal.timeout(30000)
    })
    const data = await res.json() as any
    const reply = data.choices?.[0]?.message?.content || ''
    console.log(`${PASS} OpenRouter responded: "${reply.substring(0, 60)}"`)
  } catch (e: any) { console.log(`${FAIL} ${e.message}`) }
}

async function testResend(): Promise<void> {
  console.log('\n── Resend (Email) ──')
  const key = process.env.RESEND_API_KEY
  if (!key || key.startsWith('your_')) { console.log(`${SKIP} Not configured`); return }

  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { 'Authorization': `Bearer ${key}` },
      signal: AbortSignal.timeout(15000)
    })
    const data = await res.json() as any
    const domains = data.data?.map((d: any) => d.name) || []
    console.log(`${PASS} Resend OK — domains: ${domains.join(', ') || 'none'}`)
  } catch (e: any) { console.log(`${FAIL} ${e.message}`) }
}

async function testApollo(): Promise<void> {
  console.log('\n── Apollo.io (Lead Gen) ──')
  const key = process.env.APOLLO_API_KEY
  if (!key) { console.log(`${SKIP} Not configured`); return }

  try {
    const res = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({
        api_key: key,
        q_keywords: 'safari operator',
        page: 1,
        per_page: 2
      }),
      signal: AbortSignal.timeout(30000)
    })
    const data = await res.json() as any
    const count = data.people?.length || 0
    const first = data.people?.[0]?.name || 'none'
    console.log(`${PASS} Apollo returned ${count} people (first: ${first})`)
  } catch (e: any) { console.log(`${FAIL} ${e.message}`) }
}

async function testSerpApi(): Promise<void> {
  console.log('\n── SerpApi (Web Search) ──')
  const key = process.env.SERPAPI_KEY
  if (!key) { console.log(`${SKIP} Not configured`); return }

  try {
    const params = new URLSearchParams({ q: 'safari operators Zimbabwe', api_key: key, engine: 'google', num: '3' })
    const res = await fetch(`https://serpapi.com/search.json?${params}`, {
      signal: AbortSignal.timeout(30000)
    })
    const data = await res.json() as any
    const count = data.organic_results?.length || 0
    const first = data.organic_results?.[0]?.title || 'none'
    console.log(`${PASS} SerpApi returned ${count} results (first: ${first})`)
  } catch (e: any) { console.log(`${FAIL} ${e.message}`) }
}

async function testApify(): Promise<void> {
  console.log('\n── Apify (Web Scraping) ──')
  const key = process.env.APIFY_TOKEN
  if (!key) { console.log(`${SKIP} Not configured`); return }

  try {
    const res = await fetch(`https://api.apify.com/v2/acts?token=${key}&limit=1`, {
      signal: AbortSignal.timeout(15000)
    })
    const data = await res.json() as any
    const count = data.data?.items?.length || 0
    console.log(`${PASS} Apify reachable — ${count} actor(s) visible`)
  } catch (e: any) { console.log(`${FAIL} ${e.message}`) }
}

async function testNeverBounce(): Promise<void> {
  console.log('\n── NeverBounce (Email Verify) ──')
  const key = process.env.NEVERBOUNCE_API_KEY
  if (!key) { console.log(`${SKIP} Not configured`); return }

  try {
    const res = await fetch(`https://api.neverbounce.com/v4.2/single/check?key=${key}&email=test@example.com`, {
      signal: AbortSignal.timeout(15000)
    })
    const data = await res.json() as any
    if (data.status === 'general_failure') {
      console.log(`${PASS} NeverBounce reachable — ${data.message}`)
    } else {
      console.log(`${PASS} NeverBounce responded — result: ${data.result}, flags: ${(data.flags||[]).join(', ')}`)
    }
  } catch (e: any) { console.log(`${FAIL} ${e.message}`) }
}

async function testMailboxLayer(): Promise<void> {
  console.log('\n── MailboxLayer (Email Validate) ──')
  const key = process.env.MAILBOXLAYER_API_KEY
  if (!key) { console.log(`${SKIP} Not configured`); return }

  try {
    const params = new URLSearchParams({ access_key: key, email: 'test@example.com', smtp: '1', format: '1' })
    const res = await fetch(`http://apilayer.net/api/check?${params}`, {
      signal: AbortSignal.timeout(15000)
    })
    const data = await res.json() as any
    console.log(`${PASS} MailboxLayer responded — format_valid: ${data.format_valid}, score: ${data.score}`)
  } catch (e: any) { console.log(`${FAIL} ${e.message}`) }
}

async function testAfricasTalking(): Promise<void> {
  console.log("\n── Africa's Talking (SMS) ──")
  const key = process.env.AT_API_KEY
  const user = process.env.AT_USERNAME
  if (!key) { console.log(`${SKIP} Not configured`); return }

  try {
    // Try production first, then sandbox
    const baseUrl = process.env.AT_ENV === 'production'
      ? 'https://api.africastalking.com'
      : 'https://sandbox.africastalking.com'

    const res = await fetch(`${baseUrl}/version1/user?username=${user}`, {
      headers: { apiKey: key, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000)
    })
    const data = await res.json() as any
    if (data.errorMessage) {
      console.log(`${FAIL} ${data.errorMessage}`)
    } else {
      console.log(`${PASS} Africa's Talking reachable`)
    }
  } catch (e: any) { console.log(`${FAIL} ${e.message}`) }
}

// ── RUN ALL TESTS ──────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  SAFARI ZETU OPS ENGINE — API TEST SUITE')
  console.log('═══════════════════════════════════════════')

  await testOpenCodeZen()
  await testGemini()
  await testOpenRouter()
  await testResend()
  await testApollo()
  await testSerpApi()
  await testApify()
  await testNeverBounce()
  await testMailboxLayer()
  await testAfricasTalking()

  console.log('\n═══════════════════════════════════════════')
  console.log('  TESTS COMPLETE')
  console.log('═══════════════════════════════════════════')
}

main().catch(console.error)
