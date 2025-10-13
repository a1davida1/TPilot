#!/usr/bin/env npx tsx
import { db } from '../server/database.js';
import { sql } from 'drizzle-orm';

async function fixDatabaseColumns() {
  console.log('🔧 Running database column fixes...\n');
  
  try {
    // Fix reddit_post_outcomes
    console.log('1️⃣ Fixing reddit_post_outcomes table...');
    await db.execute(sql`
      ALTER TABLE reddit_post_outcomes 
      ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS title TEXT,
      ADD COLUMN IF NOT EXISTS upvotes INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0
    `);
    console.log('   ✅ Added missing columns to reddit_post_outcomes\n');
    
    // Fix reddit_communities
    console.log('2️⃣ Fixing reddit_communities table...');
    await db.execute(sql`
      ALTER TABLE reddit_communities 
      ADD COLUMN IF NOT EXISTS over18 BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS allow_images BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS subscribers INTEGER DEFAULT 0
    `);
    console.log('   ✅ Added missing columns to reddit_communities\n');
    
    // Create billing_history table
    console.log('3️⃣ Creating billing_history table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS billing_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        amount INTEGER,
        status VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   ✅ Created billing_history table\n');
    
    // Verify changes
    console.log('4️⃣ Verifying changes...');
    
    const outcomeCols = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'reddit_post_outcomes' 
      AND column_name IN ('success', 'title', 'upvotes', 'views')
    `);
    console.log('   Reddit post outcomes columns:', outcomeCols.rows);
    
    const communityCols = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'reddit_communities' 
      AND column_name IN ('over18', 'allow_images', 'subscribers')
    `);
    console.log('   Reddit communities columns:', communityCols.rows);
    
    const billingTable = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'billing_history'
    `);
    console.log('   Billing history table exists:', billingTable.rows.length > 0);
    
    console.log('\n✅ All database fixes applied successfully!');
    console.log('🎉 Your database schema is now compatible with the codebase.\n');
    
  } catch (error) {
    console.error('❌ Error fixing database:', error);
    if (error instanceof Error && error.message.includes('DATABASE_URL')) {
      console.error('\n⚠️  Please set DATABASE_URL environment variable first:');
      console.error('   export DATABASE_URL="postgresql://user:password@localhost:5432/dbname"');
    }
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the fixes
fixDatabaseColumns();
