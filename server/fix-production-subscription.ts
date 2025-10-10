#!/usr/bin/env tsx
/**
 * Production-safe fix for subscription_status constraint violations
 * Uses a 4-step approach to avoid failures on existing data
 */

import { db } from './db.js';
import { sql } from 'drizzle-orm';
import { logger } from './bootstrap/logger.js';

async function fixProductionSubscriptionStatus() {
  logger.error('🔧 Starting production-safe subscription_status fix...\n');
  
  try {
    // STEP 1: Inspect unexpected statuses
    logger.error('📊 STEP 1: Inspecting current subscription_status values...');
    const inspectResult = await db.execute(sql`
      SELECT DISTINCT subscription_status, COUNT(*) as count
      FROM users
      WHERE subscription_status IS NULL
         OR subscription_status NOT IN ('active','inactive','cancelled','past_due')
      GROUP BY subscription_status
    `);
    
    if (inspectResult.rows.length > 0) {
      logger.error('Found invalid subscription_status values:');
      logger.error(inspectResult.rows);
    } else {
      logger.error('✅ No invalid subscription_status values found');
    }
    
    // STEP 2: Normalize bad rows
    logger.error('\n🔄 STEP 2: Normalizing invalid values to "inactive"...');
    const updateResult = await db.execute(sql`
      UPDATE users
      SET subscription_status = 'inactive'
      WHERE subscription_status IS NULL
         OR subscription_status NOT IN ('active','inactive','cancelled','past_due')
    `);
    
    logger.error(`✅ Updated ${updateResult.rowCount} rows with invalid subscription_status`);
    
    // STEP 3: Add constraint without validation (NOT VALID)
    logger.error('\n🔒 STEP 3: Adding constraint (NOT VALID - won\'t check existing rows)...');
    try {
      // First check if constraint already exists
      const constraintExists = await db.execute(sql`
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'users' 
        AND constraint_name = 'valid_subscription_status'
      `);
      
      if (constraintExists.rows.length > 0) {
        logger.error('⚠️  Constraint already exists, skipping creation');
      } else {
        await db.execute(sql`
          ALTER TABLE users
          ADD CONSTRAINT valid_subscription_status
          CHECK (subscription_status IN ('active','inactive','cancelled','past_due'))
          NOT VALID
        `);
        logger.error('✅ Constraint added (not validated yet)');
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        if ((error as Error).message.includes('already exists')) {
          logger.error('⚠️  Constraint already exists, continuing...');
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }
    
    // STEP 4: Validate the constraint
    logger.error('\n✔️  STEP 4: Validating constraint for all existing rows...');
    try {
      await db.execute(sql`
        ALTER TABLE users
        VALIDATE CONSTRAINT valid_subscription_status
      `);
      logger.error('✅ Constraint validated successfully');
    } catch (error: unknown) {
      if (error instanceof Error) {
        if ((error as Error).message.includes('is already validated')) {
          logger.error('✅ Constraint was already validated');
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }
    
    // Final verification
    logger.error('\n📈 Final subscription_status distribution:');
    const finalResult = await db.execute(sql`
      SELECT subscription_status, COUNT(*) as count
      FROM users
      GROUP BY subscription_status
      ORDER BY count DESC
    `);
    
    logger.error(finalResult.rows);
    
    logger.error('\n✅ Production database fixed successfully!');
    logger.error('You can now retry your deployment.');
    
  } catch (error) {
    logger.error('\n❌ Error fixing production database:', error);
    logger.error('\nIf this script fails, you can run the SQL manually in the database pane.');
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the fix
fixProductionSubscriptionStatus();