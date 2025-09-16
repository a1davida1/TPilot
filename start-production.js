#!/usr/bin/env node

// Production start script - uses the correct path for compiled server
// This fixes the path mismatch issue where package.json expects dist/server/server/index.js
// but TypeScript actually compiles to dist/server/index.js

const { spawn } = require('child_process');
const path = require('path');

// Set production environment
process.env.NODE_ENV = 'production';

// Correct path to the compiled server file
const serverPath = path.join(__dirname, 'dist', 'server', 'index.js');

console.log('🚀 Starting production server...');
console.log(`Server path: ${serverPath}`);

// Spawn node process with the correct server path
const server = spawn('node', [serverPath], {
  stdio: 'inherit',
  env: process.env
});

server.on('error', (err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});

server.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ Server exited with code ${code}`);
    process.exit(code);
  }
});