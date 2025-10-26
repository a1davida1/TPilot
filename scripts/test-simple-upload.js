#!/usr/bin/env node

// Test the simplest possible upload to various services

import FormData from 'form-data';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Create a small test image (1x1 red pixel PNG)
const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
const buffer = Buffer.from(testImageBase64, 'base64');

console.log('Testing direct uploads with a small test image (68 bytes)...\n');

// Test File.io
async function testFileIO() {
  console.log('Testing File.io...');
  try {
    const form = new FormData();
    form.append('file', buffer, {
      filename: 'test.png',
      contentType: 'image/png',
    });
    
    const response = await fetch('https://file.io/?expires=1d', {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });
    
    const data = await response.json();
    console.log('File.io response:', data);
    if (data.success && data.link) {
      console.log('✅ SUCCESS! URL:', data.link);
    } else {
      console.log('❌ FAILED');
    }
  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }
  console.log();
}

// Test 0x0.st
async function test0x0() {
  console.log('Testing 0x0.st...');
  try {
    const form = new FormData();
    form.append('file', buffer, {
      filename: 'test.png',
      contentType: 'image/png',
    });
    
    const response = await fetch('https://0x0.st', {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });
    
    const url = await response.text();
    console.log('0x0.st response:', url);
    if (url && url.startsWith('https://')) {
      console.log('✅ SUCCESS! URL:', url.trim());
    } else {
      console.log('❌ FAILED');
    }
  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }
  console.log();
}

// Test Uguu
async function testUguu() {
  console.log('Testing Uguu.se...');
  try {
    const form = new FormData();
    form.append('files[]', buffer, {
      filename: 'test.png',
      contentType: 'image/png',
    });
    
    const response = await fetch('https://uguu.se/upload.php', {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });
    
    const text = await response.text();
    console.log('Uguu response:', text.substring(0, 200));
    
    try {
      const data = JSON.parse(text);
      if (data.success && data.files && data.files[0]) {
        console.log('✅ SUCCESS! URL:', data.files[0].url);
      } else {
        console.log('❌ FAILED:', data);
      }
    } catch (e) {
      console.log('❌ Not JSON:', text.substring(0, 100));
    }
  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }
  console.log();
}

// Test Litterbox
async function testLitterbox() {
  console.log('Testing Litterbox (temporary Catbox)...');
  try {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('time', '1h');
    form.append('fileToUpload', buffer, {
      filename: 'test.png',
      contentType: 'image/png',
    });
    
    const response = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });
    
    const url = await response.text();
    console.log('Litterbox response:', url);
    if (url && url.startsWith('https://')) {
      console.log('✅ SUCCESS! URL:', url.trim());
    } else {
      console.log('❌ FAILED');
    }
  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }
  console.log();
}

// Run all tests
async function runTests() {
  await testFileIO();
  await test0x0();
  await testUguu();
  await testLitterbox();
  
  console.log('\nDone! At least one of these should work.');
}

runTests();
