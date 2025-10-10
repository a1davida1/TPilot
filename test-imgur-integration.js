#!/usr/bin/env node

/**
 * Test script to verify Imgur integration is working
 * Run with: node test-imgur-integration.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Testing Imgur Integration...\n');

// 1. Check if environment variable is set
const checkEnvVar = () => {
  console.log('1️⃣  Checking environment variables...');
  const hasImgurClientId = !!process.env.IMGUR_CLIENT_ID;
  
  if (!hasImgurClientId) {
    console.log('   ⚠️  IMGUR_CLIENT_ID not set in environment');
    console.log('   ℹ️  Add to .env: IMGUR_CLIENT_ID=your_client_id_here');
  } else {
    console.log('   ✅ IMGUR_CLIENT_ID is configured');
  }
  
  return hasImgurClientId;
};

// 2. Check if server files exist
const checkServerFiles = () => {
  console.log('\n2️⃣  Checking server files...');
  
  const files = [
    'server/services/imgur-uploader.ts',
    'server/routes/imgur-uploads.ts',
    'dist/server/services/imgur-uploader.js',
    'dist/server/routes/imgur-uploads.js'
  ];
  
  let allExist = true;
  files.forEach(file => {
    const exists = fs.existsSync(path.join(__dirname, file));
    console.log(`   ${exists ? '✅' : '❌'} ${file}`);
    if (!exists) allExist = false;
  });
  
  return allExist;
};

// 3. Check if client component exists
const checkClientFiles = () => {
  console.log('\n3️⃣  Checking client files...');
  
  const files = [
    'client/src/components/ImgurUploadPortal.tsx',
    'client/src/components/GeminiCaptionGeneratorTabs.tsx'
  ];
  
  let allExist = true;
  files.forEach(file => {
    const exists = fs.existsSync(path.join(__dirname, file));
    console.log(`   ${exists ? '✅' : '❌'} ${file}`);
    if (!exists) allExist = false;
  });
  
  return allExist;
};

// 4. Check if routes are mounted
const checkRouteMounting = () => {
  console.log('\n4️⃣  Checking route mounting...');
  
  const routesFile = path.join(__dirname, 'dist/server/routes.js');
  if (fs.existsSync(routesFile)) {
    const content = fs.readFileSync(routesFile, 'utf8');
    
    const hasImport = content.includes('imgur-uploads.js');
    const hasMounting = content.includes("app.use('/api/uploads'");
    
    console.log(`   ${hasImport ? '✅' : '❌'} Import statement found`);
    console.log(`   ${hasMounting ? '✅' : '❌'} Route mounting found`);
    
    return hasImport && hasMounting;
  } else {
    console.log('   ❌ dist/server/routes.js not found - run npm run build');
    return false;
  }
};

// 5. Check database migration
const checkMigration = () => {
  console.log('\n5️⃣  Checking database migration...');
  
  const migrationFile = path.join(__dirname, 'migrations/0013_add_user_storage_assets.sql');
  const exists = fs.existsSync(migrationFile);
  
  console.log(`   ${exists ? '✅' : '❌'} Migration file exists`);
  
  if (exists) {
    console.log('   ℹ️  Run: npm run db:migrate to apply');
  }
  
  return exists;
};

// 6. Test API endpoints (if server is running)
const testApiEndpoints = async () => {
  console.log('\n6️⃣  Testing API endpoints...');
  
  try {
    const { default: fetch } = await import('node-fetch');
    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5000';
    
    // Test stats endpoint
    const statsRes = await fetch(`${baseUrl}/api/uploads/imgur/stats`);
    if (statsRes.ok) {
      const stats = await statsRes.json();
      console.log('   ✅ Stats endpoint working');
      console.log(`      Usage: ${stats.used}/${stats.limit} (${stats.percentUsed}%)`);
    } else {
      console.log(`   ⚠️  Stats endpoint returned ${statsRes.status}`);
    }
    
    return true;
  } catch (error) {
    console.log('   ⚠️  Server not running or not accessible');
    console.log('   ℹ️  Start server with: npm run dev');
    return false;
  }
};

// Run all checks
const runTests = async () => {
  console.log('🚀 Imgur Integration Test Suite');
  console.log('================================\n');
  
  const results = {
    env: checkEnvVar(),
    server: checkServerFiles(),
    client: checkClientFiles(),
    routes: checkRouteMounting(),
    migration: checkMigration(),
    api: await testApiEndpoints()
  };
  
  console.log('\n📊 Summary');
  console.log('==========');
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;
  
  console.log(`   Passed: ${passed}/${total} checks`);
  
  if (passed === total) {
    console.log('\n✅ All checks passed! Imgur integration is ready.');
  } else {
    console.log('\n⚠️  Some checks failed. Review the output above.');
    
    if (!results.env) {
      console.log('\n🔧 Next steps:');
      console.log('1. Get Imgur Client ID from: https://api.imgur.com/oauth2/addclient');
      console.log('2. Add to .env: IMGUR_CLIENT_ID=your_client_id');
    }
    
    if (!results.server || !results.routes) {
      console.log('3. Run: npm run build');
    }
    
    if (!results.api) {
      console.log('4. Start server: npm run dev');
    }
  }
  
  process.exit(passed === total ? 0 : 1);
};

// Execute
runTests().catch(console.error);
