// Script to test real Buffer connection and fetch channels without external dependencies
// Location: test-real-buffer.js

const fs = require('fs');
const path = require('path');

// Custom simple .env parser
function loadEnv(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error('.env file not found at:', filePath);
      return;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        // Remove quotes if present
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value.trim();
      }
    }
  } catch (error) {
    console.error('Failed to parse .env file:', error.message);
  }
}

// Load env
loadEnv(path.join(__dirname, 'safarizetu-ops-engine', '.env'));

const BUFFER_TOKEN = process.env.BUFFER_ACCESS_TOKEN;
const BUFFER_ORG_ID = process.env.BUFFER_ORG_ID;
const BUFFER_API = 'https://api.buffer.com';

async function testConnection() {
  console.log('BUFFER_TOKEN:', BUFFER_TOKEN ? 'Present (starts with ' + BUFFER_TOKEN.substring(0, 6) + ')' : 'Missing');
  console.log('BUFFER_ORG_ID:', BUFFER_ORG_ID ? 'Present' : 'Missing');
  
  if (!BUFFER_TOKEN || !BUFFER_ORG_ID) {
    console.error('Error: Buffer credentials are not loaded correctly.');
    return;
  }

  const query = `{
    channels(input: { organizationId: "${BUFFER_ORG_ID}" }) {
      id
      service
      name
    }
  }`;

  try {
    const res = await fetch(BUFFER_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BUFFER_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    if (!res.ok) {
      console.error('HTTP Error:', res.status, res.statusText);
      const text = await res.text();
      console.error('Response body:', text);
      return;
    }

    const result = await res.json();
    console.log('\n--- API Response ---');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Fetch Error:', error);
  }
}

testConnection();
