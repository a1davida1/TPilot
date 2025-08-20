#!/usr/bin/env node

// Production startup script that bypasses TypeScript compilation
process.env.NODE_ENV = 'production';

// Use tsx to run TypeScript directly in production
import('tsx').then(tsx => {
  require('./index.ts');
}).catch(err => {
  console.error('Failed to start production server:', err);
  process.exit(1);
});