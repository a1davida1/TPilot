#!/usr/bin/env node

// Test Imgbox upload directly to debug the issue

import FormData from 'form-data';
import fetch from 'node-fetch';

async function testImgboxDirectly() {
  console.log('Testing Imgbox upload directly...\n');
  
  // Small test image
  const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  const buffer = Buffer.from(testImageBase64, 'base64');
  
  try {
    // Step 1: Get token from Imgbox homepage
    console.log('1. Fetching Imgbox token...');
    const tokenResponse = await fetch('https://imgbox.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    const html = await tokenResponse.text();
    const tokenMatch = html.match(/<meta\s+content="([^"]+)"\s+name="csrf-token"/);
    
    if (!tokenMatch) {
      console.log('❌ Token not found in HTML');
      return;
    }
    
    const token = tokenMatch[1];
    console.log('✅ Got token:', token.substring(0, 20) + '...');
    
    // Get cookies
    const cookies = tokenResponse.headers.get('set-cookie') || '';
    console.log('✅ Got cookies:', cookies.substring(0, 50) + '...');
    
    // Step 2: Upload with different content types
    console.log('\n2. Testing upload with different configurations...\n');
    
    // Test 1: Without content type
    console.log('Test 1: No content type specified...');
    const form1 = new FormData();
    form1.append('utf8', '✓');
    form1.append('authenticity_token', token);
    form1.append('files[]', buffer, 'test.png');
    
    const response1 = await fetch('https://imgbox.com/upload/process', {
      method: 'POST',
      body: form1,
      headers: {
        ...form1.getHeaders(),
        'Cookie': cookies,
        'Origin': 'https://imgbox.com',
        'Referer': 'https://imgbox.com/',
      },
    });
    
    const result1 = await response1.text();
    console.log('Response:', result1.substring(0, 200));
    
    // Test 2: With image/png
    console.log('\nTest 2: With image/png content type...');
    const form2 = new FormData();
    form2.append('utf8', '✓');
    form2.append('authenticity_token', token);
    form2.append('files[]', buffer, {
      filename: 'test.png',
      contentType: 'image/png',
    });
    
    const response2 = await fetch('https://imgbox.com/upload/process', {
      method: 'POST',
      body: form2,
      headers: {
        ...form2.getHeaders(),
        'Cookie': cookies,
        'Origin': 'https://imgbox.com',
        'Referer': 'https://imgbox.com/',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json',
      },
    });
    
    const result2 = await response2.text();
    console.log('Response:', result2.substring(0, 500));
    
    // Try to parse as JSON
    try {
      const json = JSON.parse(result2);
      console.log('Parsed JSON:', JSON.stringify(json, null, 2));
      
      if (json.files && json.files[0]) {
        const file = json.files[0];
        console.log('\n✅ SUCCESS! File uploaded:');
        console.log('  URL:', file.original_url || file.url || 'no URL found');
        console.log('  All fields:', Object.keys(file));
      }
    } catch (e) {
      console.log('Not JSON, might be HTML');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testImgboxDirectly();
