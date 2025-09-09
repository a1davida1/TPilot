import fs from 'fs/promises';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { redditCommunities, insertRedditCommunitySchema } from '@shared/schema.js';

export async function seedRedditCommunities() {
  const raw = await fs.readFile(new URL('./seeds/reddit-communities.json', import.meta.url), 'utf8');
  const data = insertRedditCommunitySchema.array().parse(JSON.parse(raw));
  await db.insert(redditCommunities).values(data).onConflictDoNothing();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedRedditCommunities().then(() => process.exit(0));
}