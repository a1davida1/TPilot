#!/usr/bin/env tsx
import { db } from './db.js';
import { users } from '@shared/schema';
import { sql } from 'drizzle-orm';

async function fixSubscriptionStatus() {
  console.error('🔧 Fixing subscription_status values in database...');
  
  try {
    // First, check what values exist
    const result = await db.execute(sql`
      SELECT DISTINCT subscription_status, COUNT(*) as count 
      FROM users 
      GROUP BY subscription_status 
      ORDER BY count DESC
    `);
    
    console.error('Current subscription_status values:');
    console.error(result.rows);
    
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
    
    console.error(`✅ Updated ${updateResult.rowCount} users with invalid subscription_status`);
    
    // Verify the fix
    const verifyResult = await db.execute(sql`
      SELECT DISTINCT subscription_status, COUNT(*) as count 
      FROM users 
      GROUP BY subscription_status 
      ORDER BY count DESC
    `);
    
    console.error('\nUpdated subscription_status values:');
    console.error(verifyResult.rows);
    
    console.error('✅ Database fixed successfully!');
    console.error('You can now retry your deployment.');
    
  } catch (error) {
    console.error('❌ Error fixing database:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

fixSubscriptionStatus();