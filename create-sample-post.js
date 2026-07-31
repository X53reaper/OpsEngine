// Script to create a real scheduled sample post on Buffer (final corrected)
// Location: create-sample-post.js

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
const BUFFER_ORG_ID = process.env.BUFFER_ORG_ID;
const BUFFER_API = 'https://api.buffer.com';

const INSTAGRAM_CHANNEL_ID = '6a366d2538b5579345b6ea35';

async function scheduleSamplePost() {
  if (!BUFFER_TOKEN || !BUFFER_ORG_ID) {
    console.error('Error: Buffer credentials not loaded.');
    return;
  }

  console.log('Adding sample post to Instagram queue...');

  const photoUrl = 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&w=1200&q=80';
  const caption = 'Morning magic in Hwange National Park, Zimbabwe.\n\nWitnessing these majestic giants at sunrise is a feeling you will never forget. Are you ready for your next wild adventure?\n\nBook your dream African safari today at safarizetu.com\n\n#SafariZetu #ZimbabweTourism #Hwange #ExploreZimbabwe #AfricanSafari #TravelGram';

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
        ... on RestProxyError { message }
        ... on LimitReachedError { message }
        ... on InvalidInputError { message }
      }
    }
  `;

  const variables = {
    input: {
      channelId: INSTAGRAM_CHANNEL_ID,
      schedulingType: 'automatic',
      mode: 'addToQueue',
      text: caption,
      assets: [
        {
          image: {
            url: photoUrl,
            thumbnailUrl: photoUrl
          }
        }
      ],
      metadata: {
        instagram: {
          type: 'post',
          shouldShareToFeed: true
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

    if (result.errors) {
      console.error('GraphQL errors:', result.errors);
      return;
    }

    const payload = result.data?.createPost;
    if (payload?.__typename === 'PostActionSuccess') {
      const post = payload.post;
      console.log('\nSUCCESS!');
      console.log('Post ID:', post.id);
      console.log('Status:', post.status);
      console.log('\nOpen Buffer app on your phone.');
      console.log('Go to Instagram Queue ("safarizetu_zw").');
      console.log('You will see the Scheduled Safari Post!');
      
      fs.writeFileSync(path.join(__dirname, 'last-scheduled-post-id.txt'), post.id);
    } else {
      console.error('Failed:', payload?.message || 'Unknown error');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

scheduleSamplePost();
