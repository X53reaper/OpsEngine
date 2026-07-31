// Script to query the schema of AssetInput and InstagramPostMetadataInput
// Location: query-asset-input.js

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

async function queryAssetInput() {
  const query = `
    query {
      assetInput: __type(name: "AssetInput") {
        inputFields {
          name
          type { name kind ofType { name kind } }
        }
      }
      instagramPostMetadata: __type(name: "InstagramPostMetadataInput") {
        inputFields {
          name
          type { name kind ofType { name kind } }
        }
      }
      postType: __type(name: "PostType") {
        enumValues { name }
      }
    }
  `;

  try {
    const res = await fetch(BUFFER_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BUFFER_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    const result = await res.json();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error);
  }
}

queryAssetInput();
