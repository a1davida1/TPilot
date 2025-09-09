#!/usr/bin/env node

// Production entry point for deployment
// This avoids top-level await issues by using dynamic imports

const startServer = async () => {
  // Set production environment
  process.env.NODE_ENV = 'production';
  
  // Register tsx for TypeScript support
  await import('tsx/cjs');
  
  // Dynamically import and run the server
  await import('./server/index.ts');
};

// Start the server
startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});