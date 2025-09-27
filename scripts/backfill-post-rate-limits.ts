
import { db } from '../server/db.js';
import { postDuplicates, postRateLimits } from '../shared/schema.js';
import { and, eq, isNull } from 'drizzle-orm';

const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 100;

type RateLimitSeed = {
  userId: number;
  subreddit: string;
  lastPostAt: Date;
  postCount24h: number;
};

function createSeedKey(userId: number, subreddit: string): string {
  return `${userId}:${subreddit}`;
}

function normalizeDate(value: Date | null): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  return new Date(0);
}

export async function backfillPostRateLimits(): Promise<void> {
  console.error('🔄 Starting post rate limits backfill...');

  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

  const duplicates = await db
    .select({
      userId: postDuplicates.userId,
      subreddit: postDuplicates.subreddit,
      createdAt: postDuplicates.createdAt,
    })
    .from(postDuplicates)
    .leftJoin(
      postRateLimits,
      and(
        eq(postRateLimits.userId, postDuplicates.userId),
        eq(postRateLimits.subreddit, postDuplicates.subreddit)
      )
    )
    .where(isNull(postRateLimits.id));

  if (duplicates.length === 0) {
    console.error('✅ No missing rate limit records found. Backfill complete.');
    return;
  }

  console.error(`📊 Found ${duplicates.length} historical posts missing rate limit coverage`);

  const seeds = new Map<string, RateLimitSeed>();

  for (const duplicate of duplicates) {
    const { userId, subreddit, createdAt } = duplicate;

    if (userId === null || subreddit === null) {
      continue;
    }

    const key = createSeedKey(userId, subreddit);
    const postTimestamp = normalizeDate(createdAt);

    const existing = seeds.get(key);

    if (!existing) {
      seeds.set(key, {
        userId,
        subreddit,
        lastPostAt: postTimestamp,
        postCount24h: postTimestamp >= windowStart ? 1 : 0,
      });
      continue;
    }

    if (postTimestamp > existing.lastPostAt) {
      existing.lastPostAt = postTimestamp;
    }

    if (postTimestamp >= windowStart) {
      existing.postCount24h += 1;
    }
  }

  if (seeds.size === 0) {
    console.error('✅ No new rate limit seeds required after filtering existing records.');
    return;
  }

  const seedArray = Array.from(seeds.values());

  console.error(`🧮 Preparing to insert ${seedArray.length} rate limit records`);

  let processed = 0;

  for (let index = 0; index < seedArray.length; index += BATCH_SIZE) {
    const batch = seedArray.slice(index, index + BATCH_SIZE);

    await db
      .insert(postRateLimits)
      .values(
        batch.map((seed) => ({
          userId: seed.userId,
          subreddit: seed.subreddit,
          postCount24h: seed.postCount24h,
          lastPostAt: seed.lastPostAt,
          updatedAt: seed.lastPostAt,
        }))
      )
      .onConflictDoNothing();

    processed += batch.length;
    console.error(`⏳ Processed ${processed}/${seedArray.length} rate limit seeds`);
  }

  console.error(`✅ Successfully backfilled ${processed} rate limit records`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  backfillPostRateLimits()
    .then(() => {
      console.error('🎉 Backfill completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Backfill failed:', error);
      process.exit(1);
    });
}
