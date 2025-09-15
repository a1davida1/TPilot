import fs from 'fs/promises';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
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
    console.log('Loading full Reddit communities dataset (100 communities)...');
  } catch {
    raw = await fs.readFile(new URL('./seeds/reddit-communities.json', import.meta.url), 'utf8');
    console.log('Loading basic Reddit communities dataset...');
  }
  
  const data = insertRedditCommunitySchema
    .array()
    .parse(JSON.parse(raw)) as InsertRedditCommunity[];
  await db.insert(redditCommunities).values(data).onConflictDoNothing();
  console.log(`Successfully seeded ${data.length} Reddit communities`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedRedditCommunities().then(() => process.exit(0));
}