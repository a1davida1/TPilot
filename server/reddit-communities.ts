import { db } from './db.js';
import {
  redditCommunities,
  subredditRules,
  type RedditCommunity,
  insertRedditCommunitySchema,
  type InsertRedditCommunity
} from '@shared/schema';
import { eq, ilike, desc, or } from 'drizzle-orm';
import { lintCaption } from './lib/policy-linter.js';

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
  const value: InsertRedditCommunity = insertRedditCommunitySchema.parse(data) as InsertRedditCommunity;
  const [row] = await db.insert(redditCommunities).values(value).returning();
  return row;
}

export async function updateCommunity(id: string, data: unknown) {
  const value: Partial<InsertRedditCommunity> = insertRedditCommunitySchema
    .partial()
    .parse(data) as Partial<InsertRedditCommunity>;
  const [row] = await db.update(redditCommunities).set(value).where(eq(redditCommunities.id, id)).returning();
  return row;
}

export async function deleteCommunity(id: string) {
  await db.delete(redditCommunities).where(eq(redditCommunities.id, id));
}

export async function getCommunityInsights(communityId: string): Promise<{
  bestTimes: string[];
  successTips: string[];
  warnings: string[];
}> {
  const [community] = await db
    .select()
    .from(redditCommunities)
    .where(eq(redditCommunities.id, communityId))
    .limit(1);
  if (!community) return { bestTimes: [], successTips: [], warnings: [] };

  const successTips: string[] = [];
  const warnings: string[] = [];

  // Basic success indicators
  if ((community.successProbability ?? 0) > 85) successTips.push('High success rate - great choice');
  if (community.growthTrend === 'up') successTips.push('Growing community - get in early');
  if (community.competitionLevel === 'low') successTips.push('Low competition - your content will stand out');

  // Basic community-level warnings
  if (community.verificationRequired) warnings.push('Verification required - complete r/GetVerified');
  if (community.promotionAllowed === 'no') warnings.push('No promotion allowed - content only');

  // Enhanced rule-based warnings using the new subreddit rules system
  try {
    // Use policy linter to get comprehensive rule-based warnings
    // Pass sample content to trigger rule validation
    const lintResult = await lintCaption({
      subreddit: community.name,
      title: 'Sample title for validation',
      body: 'Sample body content for rule checking',
      hasLink: false
    });
    
    if (lintResult.warnings.length > 0) {
      // Filter out generic warnings and add specific ones
      const ruleWarnings = lintResult.warnings.filter(warning => 
        !warning.includes('Sample') && // Remove sample-related warnings
        !warning.includes('upvote') // Remove generic engagement warnings
      );
      warnings.push(...ruleWarnings);
    }
  } catch (error) {
    console.warn('Failed to get enhanced rule insights for community:', community.name, error);
    
    // Fallback to legacy rule checking
    const rules = community.rules as { minKarma?: number } | null;
    if (rules?.minKarma && rules.minKarma > 50) warnings.push(`Requires ${rules.minKarma}+ karma`);
  }

  return { bestTimes: community.bestPostingTimes || [], successTips, warnings };
}

/**
 * Get enhanced community rules from the subreddit rules system
 */
export async function getCommunityRules(communityName: string) {
  // Normalize subreddit name consistently with the policy linter
  const normalizedName = communityName.replace(/[^a-z0-9_]/gi, '').toLowerCase();
  
  const [ruleData] = await db
    .select()
    .from(subredditRules)
    .where(eq(subredditRules.subreddit, normalizedName))
    .limit(1);
  
  return ruleData?.rulesJson || null;
}

/**
 * Sync a community with the enhanced rules system
 */
export async function syncCommunityRules(communityName: string) {
  try {
    // Import sync function dynamically to avoid circular imports
    const { syncSubredditRules } = await import('./scripts/sync-subreddit-rules.js');
    await syncSubredditRules(communityName);
    return true;
  } catch (error) {
    console.error('Failed to sync community rules:', error);
    return false;
  }
}