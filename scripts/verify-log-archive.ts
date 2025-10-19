#!/usr/bin/env tsx
import * as process from 'node:process';
import { logger, remoteLogForwarder } from '../server/bootstrap/logger.js';

async function main() {
  const forwarder = remoteLogForwarder;
  const performDryRun = process.argv.includes('--dry-run');

  if (!forwarder) {
    console.log('Remote log forwarder is not configured; skipping verification.');
    return;
  }

  await forwarder.verifyConnectivity();
  console.log('Remote log archive connectivity verified.');

  if (performDryRun) {
    const remoteKey = await forwarder.performDryRunUpload();
    if (remoteKey) {
      console.log(`Remote log dry-run object uploaded: ${remoteKey}`);
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error('Remote log archive verification failed', {
    error: message,
    alert: 'log_forwarder_dry_run_failure',
    metrics: true,
  });
  console.error('Remote log archive verification failed:', message);
  process.exit(1);
});
