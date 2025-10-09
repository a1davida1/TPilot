#!/usr/bin/env node
/**
 * Diagnostic script to check Reddit OAuth configuration
 * Run with: node scripts/check-reddit-config.js
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
dotenv.config({ path: resolve(__dirname, '..', '.env') });

console.log('\n=== Reddit OAuth Configuration Check ===\n');

const {
  REDDIT_CLIENT_ID,
  REDDIT_CLIENT_SECRET,
  REDDIT_REDIRECT_URI,
  REPLIT_DOMAINS,
  APP_BASE_URL,
  NODE_ENV
} = process.env;

console.log('Environment:', NODE_ENV || 'development');
console.log('\n--- Reddit API Credentials ---');
console.log('REDDIT_CLIENT_ID:', REDDIT_CLIENT_ID ? `✓ Set (${REDDIT_CLIENT_ID.substring(0, 8)}...)` : '✗ NOT SET');
console.log('REDDIT_CLIENT_SECRET:', REDDIT_CLIENT_SECRET ? '✓ Set' : '✗ NOT SET');

console.log('\n--- Redirect URI Configuration ---');
console.log('REDDIT_REDIRECT_URI:', REDDIT_REDIRECT_URI || '✗ NOT SET');

if (!REDDIT_REDIRECT_URI) {
  console.log('\n⚠️  REDDIT_REDIRECT_URI is not set. Fallback will be used:');
  const domain = REPLIT_DOMAINS?.split(',')[0] || 'thottopilot.com';
  const protocol = domain.includes('localhost') ? 'http' : 'https';
  const fallbackUri = `${protocol}://${domain}/api/reddit/callback`;
  console.log('   Fallback URI:', fallbackUri);
  console.log('   Based on REPLIT_DOMAINS:', REPLIT_DOMAINS || '✗ NOT SET');
}

console.log('\n--- Other Relevant Config ---');
console.log('APP_BASE_URL:', APP_BASE_URL || '✗ NOT SET');
console.log('REPLIT_DOMAINS:', REPLIT_DOMAINS || '✗ NOT SET');

console.log('\n--- What Should Be Configured ---');
console.log('\n1. In your production .env file:');
console.log('   REDDIT_REDIRECT_URI=https://YOUR-PRODUCTION-DOMAIN.com/api/reddit/callback');
console.log('\n2. In your Reddit app settings at https://www.reddit.com/prefs/apps:');
console.log('   Redirect URI: https://YOUR-PRODUCTION-DOMAIN.com/api/reddit/callback');
console.log('\n3. These MUST match exactly (including http/https)');

console.log('\n--- Current Flow ---');
console.log('✓ Frontend calls: /api/reddit/connect');
console.log('✓ Server generates auth URL with redirect_uri');
console.log('✓ User authorizes on Reddit');
console.log('→ Reddit redirects to: [the redirect_uri from step 2]');
console.log('✓ Server handles at: /api/reddit/callback');
console.log('✓ Server saves account and redirects to: /dashboard or /reddit');
console.log('\n===========================================\n');
