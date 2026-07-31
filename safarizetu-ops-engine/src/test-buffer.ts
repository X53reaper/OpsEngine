import dotenv from 'dotenv'
dotenv.config()

const token = process.env.BUFFER_ACCESS_TOKEN!
const orgId = '6a323da6247f4a6d8e5dbf68'

async function test() {
  // Get channels
  const res = await fetch('https://api.buffer.com', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `{ channels(input: { organizationId: "${orgId}" }) { id service name } }` }),
    signal: AbortSignal.timeout(10000)
  })
  const data = await res.json() as any
  const channels = data.data?.channels || []
  console.log(`\nConnected channels (${channels.length}):`)
  for (const ch of channels) {
    console.log(`  ${ch.service} | ${ch.name} | id: ${ch.id}`)
  }

  // Test posting to first channel
  if (channels.length > 0) {
    const ch = channels[0]
    console.log(`\nCreating test post on ${ch.service}...`)
    const postRes = await fetch('https://api.buffer.com', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation { createPost(input: { channelIds: ["${ch.id}"], text: "Safari Zetu test post - ignore 🌍" }) { post { id status } } }`
      }),
      signal: AbortSignal.timeout(10000)
    })
    const postData = await postRes.json() as any
    console.log('Post result:', JSON.stringify(postData).substring(0, 400))
  }
}

test().catch(console.error)
