import fs from 'node:fs/promises';
import { db } from './db.js';
import {
  redditCommunities,
  subredditRules,
  type RedditCommunity,
  type CompetitionLevel,
  type ModActivity,
  insertRedditCommunitySchema,
  type InsertRedditCommunity,
  type RedditCommunityRuleSet,
  type LegacyRedditCommunityRuleSet,
  type RedditCommunitySellingPolicy,
  redditCommunityRuleSetSchema,
  createDefaultRules,
  canonicalizeCompetitionLevel,
  canonicalizeModActivity
} from '@shared/schema';
import { normalizeRulesToStructured } from '@shared/reddit-utils.js';
import { getGrowthTrendLabel } from '@shared/growth-trends';
import { eq, ilike, desc, or } from 'drizzle-orm';
import { lintCaption } from './lib/policy-linter.js';
import { logger } from './bootstrap/logger.js';

let hasLoggedCompetitionFallback = false;
let hasLoggedModActivityFallback = false;

const safeCanonicalizeCompetitionLevel =
  typeof canonicalizeCompetitionLevel === 'function'
    ? canonicalizeCompetitionLevel
    : (value: string | null | undefined): CompetitionLevel => {
        if (!hasLoggedCompetitionFallback) {
          logger.warn('canonicalizeCompetitionLevel fallback engaged');
          hasLoggedCompetitionFallback = true;
        }
        if (!value) {
          return null;
        }
        const normalized = value.toLowerCase();
        if (normalized.includes('low')) {
          return 'low';
        }
        if (normalized.includes('high')) {
          return 'high';
        }
        if (normalized.includes('medium')) {
          return 'medium';
        }
        return null;
      };

const safeCanonicalizeModActivity =
  typeof canonicalizeModActivity === 'function'
    ? canonicalizeModActivity
    : (value: string | null | undefined): ModActivity => {
        if (!hasLoggedModActivityFallback) {
          logger.warn('canonicalizeModActivity fallback engaged');
          hasLoggedModActivityFallback = true;
        }
        if (!value) {
          return null;
        }
        const normalized = value.toLowerCase();
        if (normalized.includes('low')) {
          return 'low';
        }
        if (normalized.includes('high')) {
          return 'high';
        }
        if (normalized.includes('medium')) {
          return 'medium';
        }
        return 'unknown';
      };


async function loadSeedCommunities(): Promise<InsertRedditCommunity[]> {
  // Prefer the larger dataset when available so production environments stay populated.
  try {
    const raw = await fs.readFile(new URL('./seeds/reddit-communities-full.json', import.meta.url), 'utf8');
    return insertRedditCommunitySchema.array().parse(JSON.parse(raw)) as InsertRedditCommunity[];
  } catch (fullDatasetError) {
    if ((fullDatasetError as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn('Failed to load full reddit communities dataset:', fullDatasetError);
    }

    const raw = await fs.readFile(new URL('./seeds/reddit-communities.json', import.meta.url), 'utf8');
    return insertRedditCommunitySchema.array().parse(JSON.parse(raw)) as InsertRedditCommunity[];
  }
}

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
  checkedAt?: string | null;
};

/**
 * Parse community rules from the database response
 * Handles both legacy column-level rules and new structured rules
 */
export function parseCommunityRules(community: RedditCommunity): CommunityRules {
  const columnLevelVerification = community.verificationRequired;
  const structuredRules = normalizeRules(community.rules, community.promotionAllowed, community.category);
  
  return {
    minKarma: structuredRules?.eligibility?.minKarma ?? null,
    minAccountAge: structuredRules?.eligibility?.minAccountAgeDays ?? null,
    verificationRequired: columnLevelVerification || (structuredRules?.eligibility?.verificationRequired ?? false)
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
 * Handles backward compatibility with legacy flat rules and new structured rules
 */
export function normalizeRules(rawRules: unknown, promotionAllowed?: string, category?: string): RedditCommunityRuleSet {
  try {
    // Handle null or undefined - infer policy from flags if available
    if (!rawRules) {
      const defaults = createDefaultRules();
      if (defaults && (promotionAllowed || category)) {
        const inferredPolicy = inferSellingPolicy(promotionAllowed || 'no', category || 'general');
        if (defaults.content) {
          defaults.content.sellingPolicy = inferredPolicy;
        }
      }
      return defaults;
    }
    
    // Handle legacy array-based rules (backward compatibility)
    if (Array.isArray(rawRules)) {
      const defaults = createDefaultRules();
      if (!defaults || !defaults.content) {
        logger.error('Failed to create default rules');
        return createDefaultRules();
      }
      
      return {
        ...defaults,
        content: {
          ...defaults.content,
          contentGuidelines: rawRules.filter(rule => typeof rule === 'string'),
          sellingPolicy: inferSellingPolicy(promotionAllowed || 'no', category || 'general'),
        }
      };
    }
    
    // Handle object-based rules
    if (typeof rawRules === 'object') {
      // First try to parse as new structured rules
      try {
        const parsed = redditCommunityRuleSetSchema.parse(rawRules);
        if (parsed) {
          // If sellingPolicy is not explicitly set, try to infer from promotion flags
          // Only infer if it's undefined or if there's no content object
          const shouldInferPolicy = !parsed.content || 
                                   parsed.content.sellingPolicy === undefined;
          
          if (shouldInferPolicy && (promotionAllowed || category)) {
            const inferredPolicy = inferSellingPolicy(promotionAllowed || 'no', category || 'general');
            if (!parsed.content) {
              const defaults = createDefaultRules();
              if (defaults?.content) {
                parsed.content = {
                  ...defaults.content,
                  sellingPolicy: inferredPolicy,
                };
              }
            } else if (parsed.content.sellingPolicy === undefined) {
              parsed.content.sellingPolicy = inferredPolicy;
            }
          }
          return parsed;
        }
      } catch (_e) {
        // Fall back to legacy handling
      }
      
      // Try to handle legacy flat structure
      const legacyRules = rawRules as LegacyRedditCommunityRuleSet;
      const normalized = normalizeRulesToStructured(legacyRules);
      if (normalized) {
        // Infer selling policy if not present
        if (!normalized.content?.sellingPolicy && (promotionAllowed || category)) {
          const inferredPolicy = inferSellingPolicy(promotionAllowed || 'no', category || 'general');
          if (normalized.content) {
            normalized.content.sellingPolicy = inferredPolicy;
          }
        }
        return normalized;
      }
    }
    
    return createDefaultRules();
  } catch (error) {
    logger.warn('Failed to parse community rules, using defaults:', error);
    return createDefaultRules();
  }
}

/**
 * Infer selling policy from promotion flags and category
 */
export function inferSellingPolicy(promotionAllowed: string, category: string, rules?: RedditCommunityRuleSet): RedditCommunitySellingPolicy {
  // If rules already specify selling policy, use it
  if (rules?.content?.sellingPolicy) {
    return rules.content.sellingPolicy;
  }
  
  // Infer from promotion flags and category
  if (promotionAllowed === 'yes' || category === 'selling') {
    return 'allowed';
  } else if (promotionAllowed === 'limited' || promotionAllowed === 'subtle') {
    return 'limited';
  } else if (promotionAllowed === 'no' || promotionAllowed === 'strict') {
    return 'not_allowed';
  }
  
  return 'unknown';
}

export function normalizeCommunityRecord(community: RedditCommunity): NormalizedRedditCommunity {
  return {
    ...community,
    rules: normalizeRules(community.rules, community.promotionAllowed, community.category),
    competitionLevel: safeCanonicalizeCompetitionLevel(community.competitionLevel),
    modActivity: safeCanonicalizeModActivity(community.modActivity)
  };
}

export async function listCommunities(): Promise<NormalizedRedditCommunity[]> {
  const communities = await db.select().from(redditCommunities).orderBy(desc(redditCommunities.members));
  if (communities.length > 0) {
    return communities.map(normalizeCommunityRecord);
  }

  // Ensure first-run environments have data without hiding real database issues.
  try {
    const seedCommunities = await loadSeedCommunities();

    if (seedCommunities.length === 0) {
      return [];
    }

    try {
      await db.insert(redditCommunities).values(seedCommunities).onConflictDoNothing();
      const hydrated = await db.select().from(redditCommunities).orderBy(desc(redditCommunities.members));
      if (hydrated.length > 0) {
        return hydrated.map(normalizeCommunityRecord);
      }
    } catch (insertError) {
      logger.warn('Unable to persist seed reddit communities, returning in-memory fallback instead:', insertError);
    }

    return seedCommunities.map(community =>
      normalizeCommunityRecord(community as unknown as RedditCommunity)
    );
  } catch (seedError) {
    logger.error('Failed to load seed reddit communities dataset:', seedError);
    return [];
  }
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
  if (community.growthTrend === 'up') successTips.push(`${getGrowthTrendLabel('up')} community - get in early`);
  if (community.competitionLevel === 'low') successTips.push('Low competition - your content will stand out');

  // Rule-based warnings using structured rules with safe null checks
  if (rules?.eligibility?.verificationRequired) warnings.push('Verification required - complete r/GetVerified');
  if (rules?.content?.sellingPolicy === 'not_allowed') warnings.push('No promotion/selling allowed - content only');
  if (rules?.content?.sellingPolicy === 'limited') warnings.push('Limited promotion allowed - check specific rules');
  if (rules?.content?.sellingPolicy === 'unknown') warnings.push('Selling policy unclear - check community rules');
  if (rules?.content?.watermarksAllowed === false) warnings.push('Watermarks not allowed - use clean images');
  if (rules?.eligibility?.minKarma && rules.eligibility.minKarma > 50) warnings.push(`Requires ${rules.eligibility.minKarma}+ karma`);
  if (rules?.eligibility?.minAccountAgeDays && rules.eligibility.minAccountAgeDays > 7) warnings.push(`Account must be ${rules.eligibility.minAccountAgeDays}+ days old`);
  if (rules?.posting?.maxPostsPerDay && rules.posting.maxPostsPerDay <= 1) warnings.push(`Limited to ${rules.posting.maxPostsPerDay} post${rules.posting.maxPostsPerDay === 1 ? '' : 's'} per day`);
  if (rules?.posting?.cooldownHours && rules.posting.cooldownHours >= 24) warnings.push(`${rules.posting.cooldownHours}h cooldown between posts`);
  if (rules?.eligibility?.requiresApproval) warnings.push('Posts require mod approval - expect delays');

  // Add title and content rule warnings with safe null checks
  if (rules?.content?.titleGuidelines && rules.content.titleGuidelines.length > 0) {
    warnings.push(`Title rules: ${rules.content.titleGuidelines.slice(0, 2).join(', ')}${rules.content.titleGuidelines.length > 2 ? '...' : ''}`);
  }
  if (rules?.content?.contentGuidelines && rules.content.contentGuidelines.length > 0) {
    warnings.push(`Content rules: ${rules.content.contentGuidelines.slice(0, 2).join(', ')}${rules.content.contentGuidelines.length > 2 ? '...' : ''}`);
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
    logger.warn('Failed to get enhanced rule insights for community:', community.name, error);
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
    logger.error('Failed to sync community rules:', error);
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