/**
 * Reddit Community Database Manager
 * Handles adding and updating discovered communities from user OAuth
 */

import { db } from '../db.js';
import { redditCommunities } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../bootstrap/logger.js';
import type { RedditSubredditInfo } from './reddit-user-data.js';
import { parseRulesFromDescription, mergeRules } from './reddit-rule-parser.js';

/**
 * Add or update a community in the database
 */
export async function upsertCommunity(
  community: RedditSubredditInfo,
  contributorUserId: number
): Promise<void> {
  try {
    const communityId = community.name.toLowerCase();

    // Check if community already exists
    const existing = await db
      .select()
      .from(redditCommunities)
      .where(eq(redditCommunities.id, communityId))
      .limit(1);

    if (existing.length > 0) {
      // Update existing community (refresh subscriber count)
      await db
        .update(redditCommunities)
        .set({
          members: community.subscribers,
          subscribers: community.subscribers,
          over18: community.over18,
          description: community.description || existing[0].description,
        })
        .where(eq(redditCommunities.id, communityId));

      logger.info('Updated existing community', {
        community: community.name,
        subscribers: community.subscribers,
        contributorUserId,
      });
    } else {
      // Parse rules from description
      const parsedRules = parseRulesFromDescription(
        community.description + '\n' + community.publicDescription,
        community.over18
      );

      // Create new community
      await db.insert(redditCommunities).values({
        id: communityId,
        name: community.name,
        displayName: community.displayName,
        members: community.subscribers,
        subscribers: community.subscribers,
        over18: community.over18,
        description: community.description || community.publicDescription || null,
        engagementRate: 50, // Default, will be updated by analytics later
        category: community.over18 ? 'nsfw' : 'general',
        verificationRequired: parsedRules.eligibility?.verificationRequired ?? false,
        promotionAllowed: parsedRules.content?.promotionalLinks === 'yes'
          ? 'yes'
          : parsedRules.content?.promotionalLinks === 'limited'
            ? 'limited'
            : 'no',
        rules: parsedRules,
        postingLimits: parsedRules.posting?.maxPostsPerDay
          ? { perDay: parsedRules.posting.maxPostsPerDay, cooldownHours: parsedRules.posting.cooldownHours }
          : null,
        tags: [], // Can be enhanced later
        averageUpvotes: null,
        successProbability: null,
        growthTrend: null,
        modActivity: null,
        competitionLevel: null,
        bestPostingTimes: null,
      });

      logger.info('Added new community from user discovery', {
        community: community.name,
        subscribers: community.subscribers,
        over18: community.over18,
        contributorUserId,
        rulesDetected: {
          minKarma: parsedRules.eligibility?.minKarma,
          minAccountAge: parsedRules.eligibility?.minAccountAgeDays,
          verification: parsedRules.eligibility?.verificationRequired,
          promotionalLinks: parsedRules.content?.promotionalLinks,
        },
      });
    }
  } catch (error) {
    logger.error('Failed to upsert community', {
      community: community.name,
      contributorUserId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - we don't want to fail OAuth if community upsert fails
  }
}

/**
 * Batch upsert multiple communities from user discovery
 */
export async function upsertCommunitiesFromUser(
  communities: RedditSubredditInfo[],
  userId: number
): Promise<{ added: number; updated: number; failed: number }> {
  let added = 0;
  let updated = 0;
  let failed = 0;

  for (const community of communities) {
    try {
      const communityId = community.name.toLowerCase();
      const existing = await db
        .select()
        .from(redditCommunities)
        .where(eq(redditCommunities.id, communityId))
        .limit(1);

      if (existing.length > 0) {
        await upsertCommunity(community, userId);
        updated++;
      } else {
        await upsertCommunity(community, userId);
        added++;
      }
    } catch (error) {
      failed++;
      logger.error('Failed to upsert community in batch', {
        community: community.name,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info('Batch community upsert completed', {
    userId,
    total: communities.length,
    added,
    updated,
    failed,
  });

  return { added, updated, failed };
}
