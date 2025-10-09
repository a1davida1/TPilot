import fs from 'fs/promises';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { logger } from './bootstrap/logger.js';
import { formatLogArgs } from './lib/logger-utils.js';
import {
  redditCommunities,
  insertRedditCommunitySchema,
  type InsertRedditCommunity
} from '@shared/schema';

export async function seedRedditCommunities() {
  // Try the full dataset first, fallback to basic if not found
  let raw;
  try {
    raw = await fs.readFile(new URL('./seeds/reddit-communities-full.json', import.meta.url), 'utf8');
    logger.error(...formatLogArgs('Loading full Reddit communities dataset (100 communities))...');
  } catch {
    raw = await fs.readFile(new URL('./seeds/reddit-communities.json', import.meta.url), 'utf8');
    logger.error(...formatLogArgs('Loading basic Reddit communities dataset...'));
  }
  
  const data: InsertRedditCommunity[] = insertRedditCommunitySchema
    .array()
    .parse(JSON.parse(raw)) as InsertRedditCommunity[];
  await db.insert(redditCommunities).values(data).onConflictDoNothing();
  logger.error(...formatLogArgs(`Successfully seeded ${data.length} Reddit communities`));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedRedditCommunities().then(() => process.exit(0));
}