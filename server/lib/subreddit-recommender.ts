/**
 * Subreddit Recommendation Engine
 * Analyzes user history and platform trends to suggest optimal subreddits
 */

import { db } from '../db.js';
import { redditPostOutcomes, redditCommunities, users } from '@shared/schema';
import { eq, desc, sql, and, gte } from 'drizzle-orm';
import { logger } from '../bootstrap/logger.js';

export interface SubredditRecommendation {
  subreddit: string;
  score: number;
  reasons: string[];
  metrics: {
    avgUpvotes: number;
    avgEngagement: number;
    successRate: number;
    postCount: number;
  };
  tags: string[];
}

/**
 * Get subreddit recommendations for a user based on their history
 */
export async function getRecommendations(userId: number): Promise<SubredditRecommendation[]> {
  try {
    // Get user's posting history
    const userHistory = await db
      .select({
        subreddit: redditPostOutcomes.subreddit,
        avgUpvotes: sql<number>`avg(upvotes)::int`,
        avgEngagement: sql<number>`avg(CASE WHEN views > 0 THEN (upvotes::float / views::float) * 100 ELSE 0 END)::int`,
        successRate: sql<number>`(sum(CASE WHEN success THEN 1 ELSE 0 END)::float / count(*)::float * 100)::int`,
        postCount: sql<number>`count(*)::int`
      })
      .from(redditPostOutcomes)
      .where(
        and(
          eq(redditPostOutcomes.userId, userId),
          eq(redditPostOutcomes.success, true)
        )
      )
      .groupBy(redditPostOutcomes.subreddit)
      .orderBy(desc(sql`avg(upvotes)`))
      .limit(10);

    // Get trending subreddits across platform
    const trendingSubreddits = await db
      .select({
        subreddit: redditPostOutcomes.subreddit,
        avgUpvotes: sql<number>`avg(upvotes)::int`,
        avgEngagement: sql<number>`avg(CASE WHEN views > 0 THEN (upvotes::float / views::float) * 100 ELSE 0 END)::int`,
        totalPosts: sql<number>`count(*)::int`,
        uniqueUsers: sql<number>`count(distinct user_id)::int`
      })
      .from(redditPostOutcomes)
      .where(
        and(
          eq(redditPostOutcomes.success, true),
          gte(redditPostOutcomes.createdAt, sql`NOW() - INTERVAL '30 days'`)
        )
      )
      .groupBy(redditPostOutcomes.subreddit)
      .having(sql`count(*) > 10`) // At least 10 posts in last 30 days
      .orderBy(desc(sql`avg(upvotes)`))
      .limit(20);

    // Get subreddit metadata
    const subredditMeta = await db
      .select()
      .from(redditCommunities)
      .where(sql`over18 = true`); // Focus on NSFW subreddits for adult content

    const recommendations: SubredditRecommendation[] = [];

    // Score and analyze each subreddit
    for (const sub of trendingSubreddits) {
      const meta = subredditMeta.find(m => m.name === sub.subreddit);
      const userStats = userHistory.find(h => h.subreddit === sub.subreddit);
      
      let score = 0;
      const reasons: string[] = [];
      const tags: string[] = [];

      // High engagement rate
      if (sub.avgEngagement > 5) {
        score += 30;
        reasons.push(`High engagement (${sub.avgEngagement}%)`);
        tags.push('high-engagement');
      }

      // Good upvote average
      if (sub.avgUpvotes > 500) {
        score += 25;
        reasons.push(`Popular content (${sub.avgUpvotes} avg upvotes)`);
        tags.push('popular');
      }

      // User has history here
      if (userStats) {
        score += 20;
        reasons.push('You\'ve posted here successfully');
        tags.push('familiar');
      }

      // Active community
      if (sub.uniqueUsers > 5) {
        score += 15;
        reasons.push('Active creator community');
        tags.push('active');
      }

      // Large subscriber base
      if (meta && meta.subscribers > 100000) {
        score += 10;
        reasons.push(`Large audience (${(meta.subscribers / 1000000).toFixed(1)}M subscribers)`);
        tags.push('large-audience');
      }

      recommendations.push({
        subreddit: sub.subreddit,
        score,
        reasons,
        metrics: {
          avgUpvotes: sub.avgUpvotes,
          avgEngagement: sub.avgEngagement,
          successRate: userStats?.successRate || 0,
          postCount: userStats?.postCount || 0
        },
        tags
      });
    }

    // Sort by score and return top 10
    recommendations.sort((a, b) => b.score - a.score);
    return recommendations.slice(0, 10);

  } catch (error) {
    logger.error('Failed to generate recommendations', { error, userId });
    
    // Return fallback recommendations
    return getFallbackRecommendations();
  }
}

/**
 * Get performance metrics for a specific subreddit
 */
export async function getSubredditMetrics(subreddit: string, userId?: number) {
  try {
    // Global metrics
    const [globalMetrics] = await db
      .select({
        avgUpvotes: sql<number>`avg(upvotes)::int`,
        avgViews: sql<number>`avg(views)::int`,
        avgEngagement: sql<number>`avg(CASE WHEN views > 0 THEN (upvotes::float / views::float) * 100 ELSE 0 END)::int`,
        totalPosts: sql<number>`count(*)::int`,
        successRate: sql<number>`(sum(CASE WHEN success THEN 1 ELSE 0 END)::float / count(*)::float * 100)::int`,
        topHour: sql<number>`mode() WITHIN GROUP (ORDER BY extract(hour from created_at))::int`
      })
      .from(redditPostOutcomes)
      .where(
        and(
          eq(redditPostOutcomes.subreddit, subreddit),
          gte(redditPostOutcomes.createdAt, sql`NOW() - INTERVAL '30 days'`)
        )
      );

    // User-specific metrics if userId provided
    let userMetrics = null;
    if (userId) {
      const [userStats] = await db
        .select({
          avgUpvotes: sql<number>`avg(upvotes)::int`,
          totalPosts: sql<number>`count(*)::int`,
          successRate: sql<number>`(sum(CASE WHEN success THEN 1 ELSE 0 END)::float / count(*)::float * 100)::int`,
          lastPosted: sql<string>`max(created_at)::text`
        })
        .from(redditPostOutcomes)
        .where(
          and(
            eq(redditPostOutcomes.userId, userId),
            eq(redditPostOutcomes.subreddit, subreddit)
          )
        );
      
      userMetrics = userStats;
    }

    return {
      global: globalMetrics || {
        avgUpvotes: 0,
        avgViews: 0,
        avgEngagement: 0,
        totalPosts: 0,
        successRate: 0,
        topHour: 0
      },
      user: userMetrics
    };

  } catch (error) {
    logger.error('Failed to get subreddit metrics', { error, subreddit, userId });
    throw error;
  }
}

/**
 * Get trending topics in a subreddit
 */
export async function getTrendingTopics(subreddit: string) {
  try {
    // Analyze recent successful posts for common keywords
    const recentPosts = await db
      .select({
        title: redditPostOutcomes.title,
        upvotes: redditPostOutcomes.upvotes
      })
      .from(redditPostOutcomes)
      .where(
        and(
          eq(redditPostOutcomes.subreddit, subreddit),
          eq(redditPostOutcomes.success, true),
          gte(redditPostOutcomes.createdAt, sql`NOW() - INTERVAL '7 days'`)
        )
      )
      .orderBy(desc(redditPostOutcomes.upvotes))
      .limit(100);

    // Extract common keywords/themes
    const keywords = new Map<string, number>();
    const commonTerms = [
      'verification', 'first post', 'oc', 'amateur', 'teen', 'milf', 
      'petite', 'curvy', 'natural', 'pierced', 'tattooed', 'public',
      'outdoor', 'shower', 'mirror', 'selfie', 'video', 'gif'
    ];

    for (const post of recentPosts) {
      const title = post.title.toLowerCase();
      for (const term of commonTerms) {
        if (title.includes(term)) {
          keywords.set(term, (keywords.get(term) || 0) + post.upvotes);
        }
      }
    }

    // Sort by weighted popularity
    const trending = Array.from(keywords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([term, score]) => ({ term, score }));

    return trending;

  } catch (error) {
    logger.error('Failed to get trending topics', { error, subreddit });
    return [];
  }
}

/**
 * Fallback recommendations when database is unavailable
 */
function getFallbackRecommendations(): SubredditRecommendation[] {
  return [
    {
      subreddit: 'gonewild',
      score: 90,
      reasons: ['Most popular NSFW subreddit', 'High engagement rates'],
      metrics: { avgUpvotes: 800, avgEngagement: 8, successRate: 75, postCount: 0 },
      tags: ['popular', 'high-engagement']
    },
    {
      subreddit: 'RealGirls',
      score: 85,
      reasons: ['Large active community', 'Good for amateur content'],
      metrics: { avgUpvotes: 600, avgEngagement: 7, successRate: 70, postCount: 0 },
      tags: ['popular', 'amateur']
    },
    {
      subreddit: 'PetiteGoneWild',
      score: 80,
      reasons: ['Niche audience', 'High upvote potential'],
      metrics: { avgUpvotes: 500, avgEngagement: 9, successRate: 72, postCount: 0 },
      tags: ['niche', 'high-engagement']
    },
    {
      subreddit: 'OnlyFansPromotions',
      score: 75,
      reasons: ['Made for promotion', 'Direct monetization'],
      metrics: { avgUpvotes: 150, avgEngagement: 5, successRate: 90, postCount: 0 },
      tags: ['promotional', 'monetization']
    },
    {
      subreddit: 'OnOff',
      score: 70,
      reasons: ['Creative content format', 'Good engagement'],
      metrics: { avgUpvotes: 400, avgEngagement: 6, successRate: 65, postCount: 0 },
      tags: ['creative', 'engagement']
    }
  ];
}
