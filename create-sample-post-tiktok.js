// Script to create a real sample post on TikTok via Buffer
// Location: create-sample-post-tiktok.js

const fs = require('fs');
const path = require('path');

function loadEnv(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        process.env[match[1]] = (match[2] || '').replace(/['"]/g, '').trim();
      }
    }
  } catch {}
}

loadEnv(path.join(__dirname, 'safarizetu-ops-engine', '.env'));

const BUFFER_TOKEN = process.env.BUFFER_ACCESS_TOKEN;
const BUFFER_API = 'https://api.buffer.com';

// TikTok channel ID
const TIKTOK_CHANNEL_ID = '6a3668a238b5579345b6dc6d';

async function createTikTokPost() {
  if (!BUFFER_TOKEN) {
    console.error('Error: BUFFER_ACCESS_TOKEN not loaded.');
    return;
  }

  console.log('Creating sample TikTok post...');

  const caption = 'Hwange National Park at dawn. Elephants drinking at the waterhole. This is Africa.\n\n#SafariZetu #Zimbabwe #Hwange #Elephants #AfricanSafari #Wildlife #TravelTikTok #ExploreAfrica #SafariLife #Nature';

  const mutation = `
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        __typename
        ... on PostActionSuccess {
          post { id status }
        }
        ... on NotFoundError { message }
        ... on UnauthorizedError { message }
        ... on UnexpectedError { message }
        ... on InvalidInputError { message }
      }
    }
  `;

  const variables = {
    input: {
      channelId: TIKTOK_CHANNEL_ID,
      schedulingType: 'automatic',
      mode: 'addToQueue',
      text: caption,
      assets: [
        {
          image: {
            url: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&w=1200&q=80'
          }
        }
      ],
      metadata: {
        tiktok: {
          title: 'Hwange Elephants at Dawn',
          isAiGenerated: false
        }
      }
    }
  };

  try {
    const res = await fetch(BUFFER_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BUFFER_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: mutation, variables })
    });

    const result = await res.json();
    console.log(JSON.stringify(result, null, 2));

    const payload = result.data?.createPost;
    if (payload?.__typename === 'PostActionSuccess') {
      const post = payload.post;
      console.log('\nSUCCESS!');
      console.log('Post ID:', post.id);
      console.log('Status:', post.status);
      console.log('\nOpen Buffer app on your phone.');
      console.log('Go to TikTok Queue ("safarizetu_zw").');
      console.log('You will see the Scheduled TikTok Post!');
      
      fs.writeFileSync(path.join(__dirname, 'last-tiktok-post-id.txt'), post.id);
    } else {
      console.error('Failed:', payload?.message || 'Unknown error');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

createTikTokPost();
