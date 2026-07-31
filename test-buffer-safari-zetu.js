// Test script for Buffer social media posting functionality
// Location: test-buffer-safari-zetu.js
// Purpose: Test posting Safari Zetu content across all connected platforms

const { getChannels, isBufferConfigured, createPost, postToAllPlatforms, schedulePost, getPosts, getEngagementSummary, getSafariContentIdeas } = require('./src/services/buffer.service')

async function testBufferFunctionality() {
  console.log('Testing Buffer Social Media Integration...');
  console.log();
  
  // Test 1: Configuration Check
  console.log('Test 1: Configuration Status');
  const isConfigured = isBufferConfigured()
  console.log('Buffer Configured: ' + (isConfigured ? 'YES' : 'NO (test mode)'));
  console.log('Token: ' + (isConfigured ? 'Present' : 'Missing'));
  console.log('Org ID: ' + (isConfigured ? 'Present' : 'Missing'));
  console.log();
  
  // Test 2: Get Connected Channels
  console.log('Test 2: Connected Channels');
  try {
    const channels = await getChannels()
    console.log('Found ' + channels.length + ' connected platform(s):')
    channels.forEach(ch => {
      console.log('* ' + ch.service + ': ' + ch.name + ' (ID: ' + ch.id + ')');
    })
    console.log()
  } catch (error) {
    console.log('Failed to get channels: ' + error.message);
    console.log()
  }
  
  // Test 3: Safari Content Ideas
  console.log('Test 3: Safari Content Ideas Generation');
  const contentIdeas = getSafariContentIdeas()
  console.log('Generated ' + contentIdeas.length + ' content ideas:');
  contentIdeas.forEach((idea, index) => {
    console.log((index + 1) + '. [' + idea.type.toUpperCase() + '] ' + idea.caption);
    if (idea.image) console.log('   Image: ' + idea.image);
    console.log();
  })
  console.log()
  
  // Test 4: Post to All Platforms
  console.log('Test 4: Post to All Connected Platforms');
  const testPost = contentIdeas[0];
  
  try {
    const result = await postToAllPlatforms({
      caption: testPost.caption,
      image: testPost.image,
      link: 'https://safarizetu.com'
    })
    
    console.log('Post attempt completed:');
    console.log('Posted to: ' + result.posted.length + ' platform(s): ' + result.posted.join(', '));
    if (result.failed.length > 0) {
      console.log('Failed: ' + result.failed.length + ' platform(s): ' + result.failed.join(', '));
    }
    console.log()
  } catch (error) {
    console.log('Post failed: ' + error.message);
    console.log()
  }
  
  console.log('Buffer testing completed!');
}

if (require.main === module) {
  testBufferFunctionality()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test suite failed:', error);
      process.exit(1)
    })
}

module.exports = { testBufferFunctionality }