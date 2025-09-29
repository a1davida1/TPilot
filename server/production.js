#!/usr/bin/env node

// Production server entry point that bypasses TypeScript
process.env.NODE_ENV = 'production';

// Only load dotenv if NOT in Replit deployment
// In Replit deployments, secrets are already available as env vars
if (process.env.REPLIT_DEPLOYMENT !== '1') {
  // Load environment variables for local/dev production testing
  import('dotenv').then(dotenv => dotenv.config());
}

// Use tsx to run TypeScript directly
import('./index.js');