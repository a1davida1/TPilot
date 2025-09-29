#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Production entry point for deployment
// This avoids top-level await issues by using dynamic imports

const currentDir = dirname(fileURLToPath(import.meta.url));

const ensureProductionBuild = () => {
  const clientIndex = join(currentDir, 'dist', 'client', 'index.html');
  const serverIndex = join(currentDir, 'dist', 'server', 'index.js');

  if (existsSync(clientIndex) && existsSync(serverIndex)) {
    return;
  }

  const buildScript = join(currentDir, 'build-production.sh');
  const isWindows = process.platform === 'win32';
  let command;
  let args;

  if (!isWindows && existsSync(buildScript)) {
    command = 'bash';
    args = [buildScript];
  } else {
    command = isWindows ? 'npm.cmd' : 'npm';
    args = ['run', 'build'];
  }

  const result = spawnSync(command, args, {
    cwd: currentDir,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    console.error('Failed to run production build:', result.error);
  }

  const exitStatus = typeof result.status === 'number' ? result.status : 1;

  if (exitStatus !== 0) {
    process.exit(exitStatus);
  }

  if (!existsSync(clientIndex) || !existsSync(serverIndex)) {
    console.error('Production build did not produce expected artifacts.');
    process.exit(1);
  }
};

const startServer = async () => {
  // Set production environment
  process.env.NODE_ENV = 'production';

  ensureProductionBuild();

  // Register tsx for TypeScript support
  await import('tsx/cjs');

  // Dynamically import and run the server
  await import('./server/index.js');
};

// Start the server
startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});