#!/usr/bin/env tsx
import { db } from './db.js';
import { sql } from 'drizzle-orm';

import { logger } from './bootstrap/logger.js';
import { formatLogArgs } from './lib/logger-utils.js';
async function fixSubscriptionStatus() {
  logger.error(...formatLogArgs('🔧 Fixing subscription_status values in database...'));
  
  try {
    // First, check what values exist
    const result = await db.execute(sql`
      SELECT DISTINCT subscription_status, COUNT(*) as count 
      FROM users 
      GROUP BY subscription_status 
      ORDER BY count DESC
    `);
    
    logger.error(...formatLogArgs('Current subscription_status values:'));
    logger.error(...formatLogArgs(result.rows));
    
    // Fix any invalid values
    const updateResult = await db.execute(sql`
      UPDATE users 
      SET subscription_status = 'inactive'
      WHERE subscription_status IS NULL 
         OR subscription_status = ''
         OR subscription_status = 'expired'
         OR subscription_status = 'canceled'
         OR subscription_status NOT IN ('active', 'inactive', 'cancelled', 'past_due')
    `);
    
    logger.error(...formatLogArgs(`✅ Updated ${updateResult.rowCount} users with invalid subscription_status`));
    
    // Verify the fix
    const verifyResult = await db.execute(sql`
      SELECT DISTINCT subscription_status, COUNT(*) as count 
      FROM users 
      GROUP BY subscription_status 
      ORDER BY count DESC
    `);
    
    logger.error(...formatLogArgs('\nUpdated subscription_status values:'));
    logger.error(...formatLogArgs(verifyResult.rows));
    
    logger.error(...formatLogArgs('✅ Database fixed successfully!'));
    logger.error(...formatLogArgs('You can now retry your deployment.'));
    
  } catch (error) {
    logger.error(...formatLogArgs('❌ Error fixing database:', error));
    process.exit(1);
  }
  
  process.exit(0);
}

fixSubscriptionStatus();