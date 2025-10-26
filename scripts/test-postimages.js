#!/usr/bin/env node

// Test PostImages upload

import fs from 'fs/promises';
import { PostImagesService } from '../dist/server/lib/postimages-service.js';

async function testPostImages() {
  console.log('Testing PostImages upload...\n');
  
  try {
    // Create a test image (1x1 red pixel PNG)
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    const buffer = Buffer.from(testImageBase64, 'base64');
    
    console.log('Uploading test image (1x1 red pixel, 68 bytes)...\n');
    
    const result = await PostImagesService.upload({
      buffer,
      filename: 'test-image.png',
      contentType: 'image/png',
      adult: false,
    });
    
    if (result.success) {
      console.log('✅ Upload successful!');
      console.log('URL:', result.url);
      console.log('Thumbnail:', result.thumbnailUrl);
      console.log('Delete URL:', result.deleteUrl);
    } else {
      console.log('❌ Upload failed:', result.error);
      
      // Try web form method
      console.log('\nTrying web form method...\n');
      
      const webResult = await PostImagesService.uploadViaWebForm({
        buffer,
        filename: 'test-image.png',
        contentType: 'image/png',
        adult: false,
      });
      
      if (webResult.success) {
        console.log('✅ Web form upload successful!');
        console.log('URL:', webResult.url);
        console.log('Thumbnail:', webResult.thumbnailUrl);
      } else {
        console.log('❌ Web form upload also failed:', webResult.error);
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testPostImages();
