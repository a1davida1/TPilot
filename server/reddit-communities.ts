import { db } from './db.js';
import {
  redditCommunities,
  type RedditCommunity,
  insertRedditCommunitySchema,
  type InsertRedditCommunity
} from '@shared/schema.js';
import { eq, ilike, desc, or } from 'drizzle-orm';

export async function listCommunities() {
  return db.select().from(redditCommunities).orderBy(desc(redditCommunities.members));
}

export async function searchCommunities(query: string) {
  const like = `%${query}%`;
  return db.select()
    .from(redditCommunities)
    .where(
      or(
        ilike(redditCommunities.name, like),
        ilike(redditCommunities.displayName, like),
        ilike(redditCommunities.description, like)
      )
    );
}

export async function createCommunity(data: unknown) {
  const value: InsertRedditCommunity = insertRedditCommunitySchema.parse(data);
  const [row] = await db.insert(redditCommunities).values(value).returning();
  return row;
}

export async function updateCommunity(id: string, data: unknown) {
  const value: Partial<InsertRedditCommunity> = insertRedditCommunitySchema
    .partial()
    .parse(data);
  const [row] = await db.update(redditCommunities).set(value).where(eq(redditCommunities.id, id)).returning();
  return row;
}

export async function deleteCommunity(id: string) {
  await db.delete(redditCommunities).where(eq(redditCommunities.id, id));
}

export async function getCommunityInsights(communityId: string) {
  const community = await db.query.redditCommunities.findFirst({ where: eq(redditCommunities.id, communityId) });
  if (!community) return { bestTimes: [], successTips: [], warnings: [] };

  const successTips: string[] = [];
  const warnings: string[] = [];

  if ((community.successProbability ?? 0) > 85) successTips.push('High success rate - great choice');
  if (community.growthTrend === 'up') successTips.push('Growing community - get in early');
  if (community.competitionLevel === 'low') successTips.push('Low competition - your content will stand out');

  if (community.verificationRequired) warnings.push('Verification required - complete r/GetVerified');
  const rules = community.rules as { minKarma?: number } | null;
  if (rules?.minKarma && rules.minKarma > 50) warnings.push(`Requires ${rules.minKarma}+ karma`);
  if (community.promotionAllowed === 'no') warnings.push('No promotion allowed - content only');

  return { bestTimes: community.bestPostingTimes || [], successTips, warnings };
}