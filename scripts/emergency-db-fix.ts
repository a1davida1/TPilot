import { db } from '../server/database.js';
import { sql } from 'drizzle-orm';

async function emergencyFix() {
  console.log('🚨 Running emergency database fixes...');
  
  try {
    // Fix reddit_post_outcomes
    await db.execute(sql`
      ALTER TABLE reddit_post_outcomes 
      ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS title TEXT,
      ADD COLUMN IF NOT EXISTS upvotes INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0
    `);
    console.log('✅ Fixed reddit_post_outcomes');
    
    // Fix reddit_communities
    await db.execute(sql`
      ALTER TABLE reddit_communities
      ADD COLUMN IF NOT EXISTS over18 BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS subscribers INTEGER DEFAULT 0
    `);
    console.log('✅ Fixed reddit_communities');
    
    // Create billing_history if missing
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS billing_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        amount INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Created billing_history');
    
    console.log('🎉 All database fixes applied!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database fix failed:', error);
    process.exit(1);
  }
}

emergencyFix();
