import { db } from './db.js';
import {
  redditCommunities,
  subredditRules,
  type RedditCommunity,
  insertRedditCommunitySchema,
  type InsertRedditCommunity,
  type RedditCommunityRuleSet,
  redditCommunityRuleSetSchema,
  createDefaultRules
} from '@shared/schema';
import { eq, ilike, desc, or } from 'drizzle-orm';
import { lintCaption } from './lib/policy-linter.js';

// ==========================================
// ELIGIBILITY TYPES AND INTERFACES
// ==========================================

export interface CommunityEligibilityCriteria {
  karma?: number;
  accountAgeDays?: number;
  verified: boolean;
}

export interface CommunityRules {
  minKarma?: number | null;
  minAccountAge?: number | null;
  verificationRequired?: boolean;
}

export type NormalizedRedditCommunity = Omit<RedditCommunity, 'rules'> & {
  rules: RedditCommunityRuleSet;
};

/**
 * Parse community rules from the database response
 * Handles both legacy column-level rules and new structured rules
 */
export function parseCommunityRules(community: RedditCommunity): CommunityRules {
  const columnLevelVerification = community.verificationRequired;
  const structuredRules = normalizeRules(community.rules, community.promotionAllowed, community.category);
  
  return {
    minKarma: structuredRules.minKarma,
    minAccountAge: structuredRules.minAccountAge,
    verificationRequired: columnLevelVerification || structuredRules.verificationRequired
  };
}

/**
 * Filter communities based on user eligibility criteria
 */
export async function getEligibleCommunitiesForUser(criteria: CommunityEligibilityCriteria): Promise<RedditCommunity[]> {
  // Get all communities
  const allCommunities = await listCommunities();
  
  // Filter based on eligibility criteria
  return allCommunities.filter(community => {
    const rules = parseCommunityRules(community);
    
    // Check minimum karma requirement
    if (rules.minKarma !== null && rules.minKarma !== undefined) {
      if (criteria.karma === undefined || criteria.karma < rules.minKarma) {
        return false;
      }
    }
    
    // Check minimum account age requirement
    if (rules.minAccountAge !== null && rules.minAccountAge !== undefined) {
      if (criteria.accountAgeDays === undefined || criteria.accountAgeDays < rules.minAccountAge) {
        return false;
      }
    }
    
    // Check verification requirement
    if (rules.verificationRequired && !criteria.verified) {
      return false;
    }
    
    return true;
  });
}

/**
 * Normalize and hydrate community rules from database response
 * Handles backward compatibility with legacy array-based rules
 */
function normalizeRules(rawRules: unknown, promotionAllowed?: string, category?: string): RedditCommunityRuleSet {
  try {
    // Handle null or undefined
    if (!rawRules) {
      return createDefaultRules();
    }
    
    // Handle legacy array-based rules (backward compatibility)
    if (Array.isArray(rawRules)) {
      const defaults = createDefaultRules();
      return {
        ...defaults,
        contentRules: rawRules.filter(rule => typeof rule === 'string'),
        titleRules: defaults.titleRules || [],
        bannedContent: defaults.bannedContent || [],
        formattingRequirements: defaults.formattingRequirements || [],
        sellingAllowed: inferSellingPolicy(promotionAllowed || 'no', category || 'general')
      };
    }
    
    // Handle object-based rules
    if (typeof rawRules === 'object') {
      // Try to parse as structured rules
      const parsed = redditCommunityRuleSetSchema.parse(rawRules);
      
      if (parsed) {
        // If sellingAllowed is undefined/null, try to infer from promotion flags
        if (!parsed.sellingAllowed && (promotionAllowed || category)) {
          parsed.sellingAllowed = inferSellingPolicy(promotionAllowed || 'no', category || 'general', parsed);
        }
        
        return parsed;
      }
    }
    
    return createDefaultRules();
  } catch (error) {
    console.warn('Failed to parse community rules, using defaults:', error);
    return createDefaultRules();
  }
}

/**
 * Infer selling policy from promotion flags and category
 */
function inferSellingPolicy(promotionAllowed: string, category: string, rules?: RedditCommunityRuleSet): RedditCommunityRuleSet['sellingAllowed'] {
  // If rules already specify selling policy, use it
  if (rules?.sellingAllowed) {
    return rules.sellingAllowed;
  }
  
  // Infer from promotion flags and category
  if (promotionAllowed === 'yes' || category === 'selling') {
    return 'yes';
  } else if (promotionAllowed === 'limited' || promotionAllowed === 'subtle') {
    return 'limited';
  } else if (promotionAllowed === 'no' || promotionAllowed === 'strict') {
    return 'no';
  }
  
  return undefined;
}

export function normalizeCommunityRecord(community: RedditCommunity): NormalizedRedditCommunity {
  return {
    ...community,
    rules: normalizeRules(community.rules, community.promotionAllowed, community.category)
  };
}

export async function listCommunities(): Promise<NormalizedRedditCommunity[]> {
  const communities = await db.select().from(redditCommunities).orderBy(desc(redditCommunities.members));
  return communities.map(normalizeCommunityRecord);
}

export async function searchCommunities(query: string): Promise<NormalizedRedditCommunity[]> {
  const like = `%${query}%`;
  const communities = await db.select()
    .from(redditCommunities)
    .where(
      or(
        ilike(redditCommunities.name, like),
        ilike(redditCommunities.displayName, like),
        ilike(redditCommunities.description, like)
      )
    );
  
  return communities.map(normalizeCommunityRecord);
}

export async function createCommunity(data: unknown): Promise<NormalizedRedditCommunity> {
  const value: InsertRedditCommunity = insertRedditCommunitySchema.parse(data) as InsertRedditCommunity;
  const [row] = await db.insert(redditCommunities).values(value).returning();
  if (!row) {
    throw new Error('Failed to insert community');
  }
  return normalizeCommunityRecord(row);
}

export async function updateCommunity(id: string, data: unknown): Promise<NormalizedRedditCommunity | undefined> {
  const value: Partial<InsertRedditCommunity> = insertRedditCommunitySchema
    .partial()
    .parse(data) as Partial<InsertRedditCommunity>;
  const [row] = await db.update(redditCommunities).set(value).where(eq(redditCommunities.id, id)).returning();
  return row ? normalizeCommunityRecord(row) : undefined;
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

  // Normalize rules
  const rules = normalizeRules(community.rules, community.promotionAllowed, community.category);
  const successTips: string[] = [];
  const warnings: string[] = [];

  // Basic success indicators
  if ((community.successProbability ?? 0) > 85) successTips.push('High success rate - great choice');
  if (community.growthTrend === 'up') successTips.push('Growing community - get in early');
  if (community.competitionLevel === 'low') successTips.push('Low competition - your content will stand out');

  // Rule-based warnings using structured rules with safe null checks
  if (rules?.verificationRequired) warnings.push('Verification required - complete r/GetVerified');
  if (rules?.sellingAllowed === 'no') warnings.push('No promotion/selling allowed - content only');
  if (rules?.sellingAllowed === 'limited') warnings.push('Limited promotion allowed - check specific rules');
  if (rules?.watermarksAllowed === false) warnings.push('Watermarks not allowed - use clean images');
  if (rules?.minKarma && rules.minKarma > 50) warnings.push(`Requires ${rules.minKarma}+ karma`);
  if (rules?.minAccountAge && rules.minAccountAge > 7) warnings.push(`Account must be ${rules.minAccountAge}+ days old`);
  if (rules?.maxPostsPerDay && rules.maxPostsPerDay <= 1) warnings.push(`Limited to ${rules.maxPostsPerDay} post${rules.maxPostsPerDay === 1 ? '' : 's'} per day`);
  if (rules?.cooldownHours && rules.cooldownHours >= 24) warnings.push(`${rules.cooldownHours}h cooldown between posts`);
  if (rules?.requiresApproval) warnings.push('Posts require mod approval - expect delays');

  // Add title and content rule warnings with safe null checks
  if (rules?.titleRules && rules.titleRules.length > 0) {
    warnings.push(`Title rules: ${rules.titleRules.slice(0, 2).join(', ')}${rules.titleRules.length > 2 ? '...' : ''}`);
  }
  if (rules?.contentRules && rules.contentRules.length > 0) {
    warnings.push(`Content rules: ${rules.contentRules.slice(0, 2).join(', ')}${rules.contentRules.length > 2 ? '...' : ''}`);
  }

  // Enhanced rule-based warnings using the policy linter as fallback
  try {
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
        !warning.includes('upvote') && // Remove generic engagement warnings
        !warnings.some(existing => existing.includes(warning.slice(0, 20))) // Avoid duplicates
      );
      warnings.push(...ruleWarnings.slice(0, 3)); // Limit additional warnings
    }
  } catch (error) {
    console.warn('Failed to get enhanced rule insights for community:', community.name, error);
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

/**
 * Get eligible communities count for quick stats
 */
export async function getEligibleCommunitiesCount(criteria: CommunityEligibilityCriteria): Promise<number> {
  const eligibleCommunities = await getEligibleCommunitiesForUser(criteria);
  return eligibleCommunities.length;
}