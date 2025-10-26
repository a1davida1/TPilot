#!/usr/bin/env node

// Quick test to verify Imgbox parsing

const testResponse = {
  "files": [{
    "id": "abc123",
    "original_url": "https://images.imgbox.com/test/image.jpg",
    "thumbnail_url": "https://thumbs.imgbox.com/test/image_t.jpg",
    "delete_url": "https://imgbox.com/delete/abc123"
  }]
};

console.log('Testing Imgbox response parsing...\n');

// OLD LOGIC (broken)
const oldCheck = testResponse.success || (testResponse.files && testResponse.files.length > 0);
console.log('Old logic - has success field?', !!testResponse.success);
console.log('Old logic - would fail?', !testResponse.success);

// NEW LOGIC (fixed)  
const newCheck = testResponse.files && testResponse.files.length > 0;
console.log('\nNew logic - has files?', !!testResponse.files);
console.log('New logic - has items?', testResponse.files?.length > 0);
console.log('New logic - would succeed?', newCheck);

if (newCheck) {
  console.log('\n✅ SUCCESS! Found image URL:', testResponse.files[0].original_url);
} else {
  console.log('\n❌ FAILED - No files found');
}
