#!/usr/bin/env node

// Test script to verify caption API response
// Run with: node test-caption-api.js

async function testCaptionAPI() {
  const API_URL = 'http://localhost:3010/api/caption/generate';
  
  const testPayload = {
    imageUrl: 'https://files.catbox.moe/example.jpg', // Replace with a real image URL
    platform: 'reddit',
    voice: 'seductive_goddess',
    style: 'explicit',
    mood: 'seductive',
    nsfw: true,
    promotionMode: 'none'
  };
  
  console.log('Testing caption API...');
  console.log('Request payload:', testPayload);
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add auth token if needed
        // 'Authorization': 'Bearer YOUR_TOKEN'
      },
      body: JSON.stringify(testPayload)
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const data = await response.json();
    console.log('\nResponse data:');
    console.log(JSON.stringify(data, null, 2));
    
    // Check for expected fields
    console.log('\n=== Response Analysis ===');
    console.log('Has topVariants:', !!data.topVariants);
    console.log('topVariants length:', data.topVariants?.length);
    console.log('Has final:', !!data.final);
    console.log('Final type:', typeof data.final);
    
    if (data.topVariants) {
      console.log('\nTop Variants:');
      data.topVariants.forEach((v, i) => {
        console.log(`  [${i}] Caption: ${v.caption?.substring(0, 50)}...`);
      });
    }
    
    if (data.final) {
      const finalCaption = typeof data.final === 'string' ? data.final : data.final.caption;
      console.log(`\nFinal caption: ${finalCaption?.substring(0, 50)}...`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Check if server is running
fetch('http://localhost:3010/health')
  .then(() => {
    console.log('Server is running. Testing caption API...\n');
    testCaptionAPI();
  })
  .catch(() => {
    console.error('Server is not running. Please start the server first.');
    console.log('Run: npm run dev');
  });
