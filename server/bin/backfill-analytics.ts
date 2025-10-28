#!/usr/bin/env node
/**
 * Analytics Backfill CLI Tool
 *
 * Backfills analytics data for a date range
 * Useful for initial setup or fixing gaps in analytics data
 *
 * Usage:
 *   npm run backfill-analytics -- --days 30          # Backfill last 30 days
 *   npm run backfill-analytics -- --start 2025-01-01 --end 2025-01-31
 */

import { logger } from '../bootstrap/logger.js';
import { backfillAnalytics } from '../services/analytics-aggregation.js';

async function main() {
  const args = process.argv.slice(2);

  let startDate: Date;
  let endDate: Date = new Date();
  endDate.setHours(0, 0, 0, 0);

  // Parse arguments
  if (args.includes('--days')) {
    const daysIndex = args.indexOf('--days');
    const days = parseInt(args[daysIndex + 1]);

    if (isNaN(days) || days <= 0) {
      logger.error('❌ Invalid --days value. Must be a positive number.');
      process.exit(1);
    }

    startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    logger.info(`📅 Backfilling analytics for last ${days} days`, {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });

  } else if (args.includes('--start') && args.includes('--end')) {
    const startIndex = args.indexOf('--start');
    const endIndex = args.indexOf('--end');

    const startStr = args[startIndex + 1];
    const endStr = args[endIndex + 1];

    startDate = new Date(startStr);
    endDate = new Date(endStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      logger.error('❌ Invalid date format. Use YYYY-MM-DD format.');
      process.exit(1);
    }

    if (startDate > endDate) {
      logger.error('❌ Start date must be before end date.');
      process.exit(1);
    }

    logger.info('📅 Backfilling analytics for date range', {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });

  } else {
    logger.error('❌ Invalid arguments. Usage:');
    logger.info('  npm run backfill-analytics -- --days 30');
    logger.info('  npm run backfill-analytics -- --start 2025-01-01 --end 2025-01-31');
    process.exit(1);
  }

  try {
    await backfillAnalytics(startDate, endDate);
    logger.info('✅ Analytics backfill completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Analytics backfill failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

main();
