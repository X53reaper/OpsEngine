// Script to delete the sample post from Buffer
// Location: delete-sample-post.js

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

async function deletePost(postId) {
  if (!BUFFER_TOKEN) {
    console.error('Error: BUFFER_ACCESS_TOKEN not loaded.');
    return;
  }

  console.log('Deleting post:', postId);

  const mutation = `
    mutation DeletePost($input: DeletePostInput!) {
      deletePost(input: $input) {
        __typename
        ... on PostActionSuccess {
          post { id status }
        }
        ... on NotFoundError { message }
        ... on UnauthorizedError { message }
        ... on UnexpectedError { message }
      }
    }
  `;

  const variables = {
    input: {
      postId: postId
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

    const payload = result.data?.deletePost;
    if (payload?.__typename === 'PostActionSuccess') {
      console.log('\nSUCCESS! Post deleted from Buffer queue.');
    } else {
      console.error('Failed:', payload?.message || 'Unknown error');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Read the post ID from file or use the one we just created
const postIdFile = path.join(__dirname, 'last-scheduled-post-id.txt');
let postId = '6a375a4f8f0197acb5d5577c'; // Default to the one we just created

if (fs.existsSync(postIdFile)) {
  postId = fs.readFileSync(postIdFile, 'utf8').trim();
}

deletePost(postId);
