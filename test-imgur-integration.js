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

console.warn('🔍 Testing Imgur Integration...\n');

// 1. Check if environment variable is set
const checkEnvVar = () => {
  console.warn('1️⃣  Checking environment variables...');
  const hasImgurClientId = !!process.env.IMGUR_CLIENT_ID;
  
  if (!hasImgurClientId) {
    console.warn('   ⚠️  IMGUR_CLIENT_ID not set in environment');
    console.warn('   ℹ️  Add to .env: IMGUR_CLIENT_ID=your_client_id_here');
  } else {
    console.warn('   ✅ IMGUR_CLIENT_ID is configured');
  }
  
  return hasImgurClientId;
};

// 2. Check if server files exist
const checkServerFiles = () => {
  console.warn('\n2️⃣  Checking server files...');
  
  const files = [
    'server/services/imgur-uploader.ts',
    'server/routes/imgur-uploads.ts',
    'dist/server/services/imgur-uploader.js',
    'dist/server/routes/imgur-uploads.js'
  ];
  
  let allExist = true;
  files.forEach(file => {
    const exists = fs.existsSync(path.join(__dirname, file));
    console.warn(`   ${exists ? '✅' : '❌'} ${file}`);
    if (!exists) allExist = false;
  });
  
  return allExist;
};

// 3. Check if client component exists
const checkClientFiles = () => {
  console.warn('\n3️⃣  Checking client files...');
  
  const files = [
    'client/src/components/ImgurUploadPortal.tsx',
    'client/src/components/GeminiCaptionGeneratorTabs.tsx'
  ];
  
  let allExist = true;
  files.forEach(file => {
    const exists = fs.existsSync(path.join(__dirname, file));
    console.warn(`   ${exists ? '✅' : '❌'} ${file}`);
    if (!exists) allExist = false;
  });
  
  return allExist;
};

// 4. Check if routes are mounted
const checkRouteMounting = () => {
  console.warn('\n4️⃣  Checking route mounting...');
  
  const routesFile = path.join(__dirname, 'dist/server/routes.js');
  if (fs.existsSync(routesFile)) {
    const content = fs.readFileSync(routesFile, 'utf8');
    
    const hasImport = content.includes('imgur-uploads.js');
    const hasMounting = content.includes("app.use('/api/uploads'");
    
    console.warn(`   ${hasImport ? '✅' : '❌'} Import statement found`);
    console.warn(`   ${hasMounting ? '✅' : '❌'} Route mounting found`);
    
    return hasImport && hasMounting;
  } else {
    console.error('   ❌ dist/server/routes.js not found - run npm run build');
    return false;
  }
};

// 5. Check database migration
const checkMigration = () => {
  console.warn('\n5️⃣  Checking database migration...');
  
  const migrationFile = path.join(__dirname, 'migrations/0013_add_user_storage_assets.sql');
  const exists = fs.existsSync(migrationFile);
  
  console.warn(`   ${exists ? '✅' : '❌'} Migration file exists`);
  
  if (exists) {
    console.warn('   ℹ️  Run: npm run db:migrate to apply');
  }
  
  return exists;
};

// 6. Test API endpoints (if server is running)
const testApiEndpoints = async () => {
  console.warn('\n6️⃣  Testing API endpoints...');
  
  try {
    const { default: fetch } = await import('node-fetch');
    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5000';
    
    // Test stats endpoint
    const statsRes = await fetch(`${baseUrl}/api/uploads/imgur/stats`);
    if (statsRes.ok) {
      const stats = await statsRes.json();
      console.warn('   ✅ Stats endpoint working');
      console.warn(`      Usage: ${stats.used}/${stats.limit} (${stats.percentUsed}%)`);
    } else {
      console.warn(`   ⚠️  Stats endpoint returned ${statsRes.status}`);
    }
    
    return true;
  } catch (_error) {
    console.warn('   ⚠️  Server not running or not accessible');
    console.warn('   ℹ️  Start server with: npm run dev');
    return false;
  }
};

// Run all checks
const runTests = async () => {
  console.warn('🚀 Imgur Integration Test Suite');
  console.warn('================================\n');
  
  const results = {
    env: checkEnvVar(),
    server: checkServerFiles(),
    client: checkClientFiles(),
    routes: checkRouteMounting(),
    migration: checkMigration(),
    api: await testApiEndpoints()
  };
  
  console.warn('\n📊 Summary');
  console.warn('==========');
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;
  
  console.warn(`   Passed: ${passed}/${total} checks`);
  
  if (passed === total) {
    console.warn('\n✅ All checks passed! Imgur integration is ready.');
  } else {
    console.warn('\n⚠️  Some checks failed. Review the output above.');
    
    if (!results.env) {
      console.warn('\n🔧 Next steps:');
      console.warn('1. Get Imgur Client ID from: https://api.imgur.com/oauth2/addclient');
      console.warn('2. Add to .env: IMGUR_CLIENT_ID=your_client_id');
    }
    
    if (!results.server || !results.routes) {
      console.warn('3. Run: npm run build');
    }
    
    if (!results.api) {
      console.warn('4. Start server: npm run dev');
    }
  }
  
  process.exit(passed === total ? 0 : 1);
};

// Execute
runTests().catch(console.error);
