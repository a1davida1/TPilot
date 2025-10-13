#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log("🔍 Render Deployment Diagnostic");
console.log("================================");

// Check Node version
console.log(`✓ Node Version: ${process.version}`);

// Check environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET', 
  'SESSION_SECRET',
  'NODE_ENV'
];

console.log("\n📋 Environment Variables:");
requiredEnvVars.forEach(envVar => {
  const value = process.env[envVar];
  const status = value ? '✓' : '✗';
  const display = value ? (envVar === 'DATABASE_URL' ? 'Set (hidden)' : `Set (${value.length} chars)`) : 'NOT SET';
  console.log(`  ${status} ${envVar}: ${display}`);
});

// Check if dist folder exists
console.log("\n📁 Build Artifacts:");
const distExists = fs.existsSync(path.join(process.cwd(), 'dist'));
console.log(`  ${distExists ? '✓' : '✗'} dist/ folder exists: ${distExists}`);

if (distExists) {
  const serverFile = fs.existsSync(path.join(process.cwd(), 'dist/server/index.js'));
  console.log(`  ${serverFile ? '✓' : '✗'} dist/server/index.js exists: ${serverFile}`);
  
  const clientFile = fs.existsSync(path.join(process.cwd(), 'dist/index.html'));
  console.log(`  ${clientFile ? '✓' : '✗'} dist/index.html exists: ${clientFile}`);
}

// Test database connection
if (process.env.DATABASE_URL) {
  console.log("\n🗄️ Database Connection:");
  const dbUrl = process.env.DATABASE_URL;
  const cleanUrl = dbUrl.split('?')[0];
  const needsSSL = dbUrl.includes('render.com');
  
  const pool = new Pool({
    connectionString: cleanUrl,
    ssl: needsSSL ? { rejectUnauthorized: false } : undefined
  });
  
  try {
    const result = await pool.query('SELECT NOW()');
    console.log(`  ✓ Database connected successfully at ${result.rows[0].now}`);
  } catch (err) {
    console.log(`  ✗ Database connection FAILED: ${err.message}`);
  }
  
  await pool.end();
} else {
  console.log("\n⚠️ Skipping database test (DATABASE_URL not set)");
}

console.log("\n💡 If any checks failed above, that's your issue!");
