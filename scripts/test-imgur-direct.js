#!/usr/bin/env node

// Test Imgur upload with different client IDs

import fetch from 'node-fetch';

async function testImgur() {
  console.log('Testing Imgur anonymous upload...\n');
  
  // Small test image
  const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  
  // List of public Imgur client IDs that might work
  const clientIds = [
    '546c25a59c58ad7',  // Common public ID
    '9311bd6e1c58eb3',  // Alternative
    '4409588f10776f7',  // Another option
  ];
  
  for (const clientId of clientIds) {
    console.log(`Testing with Client ID: ${clientId}`);
    
    try {
      const response = await fetch('https://api.imgur.com/3/image', {
        method: 'POST',
        headers: {
          'Authorization': `Client-ID ${clientId}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: testImageBase64,
          type: 'base64',
        }),
      });
      
      console.log(`Status: ${response.status}`);
      console.log(`Content-Type: ${response.headers.get('content-type')}`);
      
      const text = await response.text();
      
      try {
        const data = JSON.parse(text);
        if (data.success && data.data) {
          console.log(`✅ SUCCESS! Image URL: ${data.data.link}`);
          console.log(`Delete hash: ${data.data.deletehash}`);
          return;
        } else {
          console.log(`❌ Failed:`, data.data?.error || data);
        }
      } catch (e) {
        console.log(`❌ Not JSON:`, text.substring(0, 100));
      }
    } catch (error) {
      console.log(`❌ Error:`, error.message);
    }
    
    console.log();
  }
}

testImgur();
