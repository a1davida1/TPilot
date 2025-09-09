#!/usr/bin/env node

/**
 * Production server entry point
 * This file provides an ESM wrapper to run the TypeScript server in production
 */

// Load environment variables
if (process.env.NODE_ENV === 'production') {
  process.env.NODE_OPTIONS = '--max-old-space-size=4096';
}

// Run the server
const startServer = async () => {
  // Register tsx to handle TypeScript files
  await import('tsx/cjs');
  
  // Load and run the main server
  await import('./server/index.ts');
};

startServer().catch(err => {
  console.error('Failed to start production server:', err);
  process.exit(1);
});