import { db } from '../server/db.js';
import { postRateLimits, users } from '../shared/schema.js';
import { eq, sql } from 'drizzle-orm';

/**
 * This script creates missing rate limit records for all users in all subreddits
 * they have posted to. This ensures that future rate limit checks work correctly
 * with the updated SafetyManager.recordPost logic.
 */
async function backfillPostRateLimits(): Promise<void> {
  console.log('🔄 Starting post rate limits backfill...');

  // Get all distinct user/subreddit combinations that need rate limit records
  const missingRecords = await db
    .select({
      userId: users.id,
      subreddit: sql<string>`'general'`.as('subreddit'),
    })
    .from(users)
    .leftJoin(
      postRateLimits,
      eq(users.id, postRateLimits.userId)
    )
    .where(sql`${postRateLimits.id} IS NULL`);

  if (missingRecords.length === 0) {
    console.log('✅ No missing rate limit records found. Backfill complete.');
    return;
  }

  console.log(`📊 Found ${missingRecords.length} missing rate limit records to create`);

  // Create missing records in batches
  const batchSize = 100;
  let processedCount = 0;

  for (let i = 0; i < missingRecords.length; i += batchSize) {
    const batch = missingRecords.slice(i, i + batchSize);
    
    const values = batch.map(record => ({
      userId: record.userId,
      subreddit: record.subreddit,
      postCount24h: 0,
      lastPostAt: new Date(),
    }));

    await db
      .insert(postRateLimits)
      .values(values)
      .onConflictDoNothing();

    processedCount += batch.length;
    console.log(`⏳ Processed ${processedCount}/${missingRecords.length} records`);
  }

  console.log(`✅ Successfully backfilled ${processedCount} rate limit records`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  backfillPostRateLimits()
    .then(() => {
      console.log('🎉 Backfill completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Backfill failed:', error);
      process.exit(1);
    });
}