/**
 * Reddit Intelligence API Routes
 * Provides AI-powered insights and analytics for content creators
 */

import { Router, type Response } from 'express';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db.js';
import { redditPostOutcomes, redditCommunities, contentGenerations } from '@shared/schema';
import { eq, desc, gte, and, sql, count } from 'drizzle-orm';
import { logger } from '../bootstrap/logger.js';
import { subDays } from 'date-fns';
import {
  generateContentSuggestions,
  getTopPerformingPosts,
  analyzeContentPatterns,
  generateTitleSuggestions
} from '../lib/ai-content-advisor.js';

const router = Router();

// Tier access levels
const TIER_ACCESS = {
  free: 0,
  starter: 1,
  pro: 2,
  premium: 3,
  admin: 4
};

/**
 * GET /api/intelligence/trends/:subreddit
 * Get trending topics for a specific subreddit based on user's posting patterns
 */
router.get('/trends/:subreddit', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const subreddit = req.params.subreddit;
    const userId = req.user?.id;
    const userTier = req.user?.tier || 'free';
    const tierLevel = TIER_ACCESS[userTier as keyof typeof TIER_ACCESS] || 0;

    // Premium feature only
    if (tierLevel < TIER_ACCESS.premium) {
      return res.status(403).json({
        error: 'Trending topics require Premium tier',
        requiredTier: 'premium'
      });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Analyze user's recent successful vs older posts to identify trends
    const twoWeeksAgo = subDays(new Date(), 14);
    const thirtyDaysAgo = subDays(new Date(), 30);

    // Get recent successful posts
    const recentSuccess = await db
      .select({
        status: redditPostOutcomes.status,
        postCount: count(),
        avgEngagement: sql<number>`AVG(COALESCE(upvotes, 0) + COALESCE(views, 0))`,
        successRate: sql<number>`COUNT(CASE WHEN success = true THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100`
      })
      .from(redditPostOutcomes)
      .where(
        and(
          eq(redditPostOutcomes.userId, userId),
          eq(redditPostOutcomes.subreddit, subreddit),
          gte(redditPostOutcomes.occurredAt, twoWeeksAgo)
        )
      )
      .groupBy(redditPostOutcomes.status);

    // Get older posts for comparison
    const olderPosts = await db
      .select({
        status: redditPostOutcomes.status,
        postCount: count(),
        avgEngagement: sql<number>`AVG(COALESCE(upvotes, 0) + COALESCE(views, 0))`,
        successRate: sql<number>`COUNT(CASE WHEN success = true THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100`
      })
      .from(redditPostOutcomes)
      .where(
        and(
          eq(redditPostOutcomes.userId, userId),
          eq(redditPostOutcomes.subreddit, subreddit),
          gte(redditPostOutcomes.occurredAt, thirtyDaysAgo),
          sql`occurred_at < ${twoWeeksAgo}`
        )
      )
      .groupBy(redditPostOutcomes.status);

    // Build trends map
    const trendsMap = new Map<string, { recent: number; older: number; recentEngagement: number; recentSuccess: number }>();

    recentSuccess.forEach(r => {
      trendsMap.set(r.status, {
        recent: Number(r.postCount),
        older: 0,
        recentEngagement: Number(r.avgEngagement),
        recentSuccess: Number(r.successRate)
      });
    });

    olderPosts.forEach(o => {
      const existing = trendsMap.get(o.status);
      if (existing) {
        existing.older = Number(o.postCount);
      } else {
        trendsMap.set(o.status, {
          recent: 0,
          older: Number(o.postCount),
          recentEngagement: 0,
          recentSuccess: 0
        });
      }
    });

    // Calculate trends
    const trends = Array.from(trendsMap.entries())
      .map(([status, data]) => {
        const growth = data.older > 0
          ? ((data.recent - data.older) / data.older) * 100
          : data.recent > 0 ? 100 : 0;

        const totalPosts = data.recent + data.older;
        let engagement: 'high' | 'medium' | 'low' = 'low';
        if (data.recentSuccess > 70) engagement = 'high';
        else if (data.recentSuccess > 40) engagement = 'medium';

        // Calculate score based on recent activity and success
        const score = Math.min(100, Math.round((data.recentSuccess * 0.7) + (Math.min(data.recent, 10) * 3)));

        return {
          topic: status === 'successful' ? 'Successful posting strategy' : `${status} posts trend`,
          score,
          growth: Math.round(growth * 10) / 10,
          posts: totalPosts,
          engagement,
          recentPosts: data.recent,
          successRate: Math.round(data.recentSuccess)
        };
      })
      .filter(t => t.posts > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // If no data, return helpful message
    if (trends.length === 0) {
      return res.json([{
        topic: 'No trend data yet',
        score: 0,
        growth: 0,
        posts: 0,
        engagement: 'unknown' as const,
        note: 'Post more in this subreddit to see trending patterns'
      }]);
    }

    return res.json(trends);
  } catch (error) {
    logger.error('Failed to fetch trends', { error });
    return res.status(500).json({ error: 'Failed to fetch trending topics' });
  }
});

/**
 * GET /api/intelligence/optimal-times/:subreddit
 * Get optimal posting times for a subreddit
 */
router.get('/optimal-times/:subreddit', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const subreddit = req.params.subreddit;
    const userId = req.user?.id;
    const userTier = req.user?.tier || 'free';
    const tierLevel = TIER_ACCESS[userTier as keyof typeof TIER_ACCESS] || 0;

    // Pro feature or higher
    if (tierLevel < TIER_ACCESS.pro) {
      return res.status(403).json({
        error: 'Optimal times require Pro tier or higher',
        requiredTier: 'pro'
      });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Calculate optimal times based on historical data
    const startDate = subDays(new Date(), 90); // Look at last 90 days

    const results = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM occurred_at)`,
        dayName: sql<string>`TO_CHAR(occurred_at, 'Day')`,
        dayOfWeek: sql<number>`EXTRACT(DOW FROM occurred_at)`,
        postCount: sql<number>`COUNT(*)`,
        avgEngagement: sql<number>`AVG(COALESCE(upvotes, 0) + COALESCE(views, 0))`,
        successRate: sql<number>`COUNT(CASE WHEN success = true THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100`
      })
      .from(redditPostOutcomes)
      .where(
        and(
          eq(redditPostOutcomes.userId, userId),
          eq(redditPostOutcomes.subreddit, subreddit),
          gte(redditPostOutcomes.occurredAt, startDate)
        )
      )
      .groupBy(sql`EXTRACT(HOUR FROM occurred_at), TO_CHAR(occurred_at, 'Day'), EXTRACT(DOW FROM occurred_at)`)
      .having(sql`COUNT(*) >= 2`) // At least 2 posts at this time
      .orderBy(desc(sql`AVG(COALESCE(upvotes, 0) + COALESCE(views, 0))`), desc(sql`COUNT(CASE WHEN success = true THEN 1 END)::float / NULLIF(COUNT(*), 0)`))
      .limit(5);

    const optimalTimes = results.map(r => {
      const engagement = Number(r.avgEngagement);
      const posts = Number(r.postCount);
      const successRate = Number(r.successRate);

      // Calculate score based on engagement and success rate
      const score = Math.min(100, Math.round((engagement / 10) + successRate));

      // Determine competition level based on post frequency
      let competition: 'low' | 'medium' | 'high' = 'low';
      if (posts > 10) competition = 'high';
      else if (posts > 5) competition = 'medium';

      return {
        day: r.dayName.trim(),
        hour: Math.floor(Number(r.hour)),
        minute: 0,
        timezone: 'UTC',
        score,
        competition,
        sampleSize: posts,
        avgEngagement: Math.round(engagement),
        successRate: Math.round(successRate)
      };
    });

    // If no data, return intelligent defaults based on general Reddit patterns
    if (optimalTimes.length === 0) {
      return res.json([
        {
          day: 'Friday',
          hour: 20,
          minute: 0,
          timezone: 'UTC',
          score: 0,
          competition: 'unknown',
          sampleSize: 0,
          note: 'No historical data - these are general Reddit peak times'
        },
        {
          day: 'Saturday',
          hour: 21,
          minute: 0,
          timezone: 'UTC',
          score: 0,
          competition: 'unknown',
          sampleSize: 0,
          note: 'No historical data - these are general Reddit peak times'
        }
      ]);
    }

    return res.json(optimalTimes);
  } catch (error) {
    logger.error('Failed to fetch optimal times', { error });
    return res.status(500).json({ error: 'Failed to fetch optimal posting times' });
  }
});

/**
 * GET /api/intelligence/suggestions
 * Get AI-powered content suggestions based on user's posting patterns
 */
router.get('/suggestions', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userTier = req.user?.tier || 'free';
    const tierLevel = TIER_ACCESS[userTier as keyof typeof TIER_ACCESS] || 0;

    // Premium feature only
    if (tierLevel < TIER_ACCESS.premium) {
      return res.status(403).json({
        error: 'AI suggestions require Premium tier',
        requiredTier: 'premium'
      });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const suggestions: Array<{
      title: string;
      description: string;
      confidence: number;
      reasoning: string;
      examples?: string[];
    }> = [];

    // Analyze user's posting patterns
    const thirtyDaysAgo = subDays(new Date(), 30);

    // 1. Check posting frequency
    const [postStats] = await db
      .select({
        totalPosts: count(),
        successfulPosts: sql<number>`COUNT(CASE WHEN success = true THEN 1 END)`,
        recentPosts: sql<number>`COUNT(CASE WHEN occurred_at >= ${subDays(new Date(), 7)} THEN 1 END)`,
        subredditCount: sql<number>`COUNT(DISTINCT subreddit)`
      })
      .from(redditPostOutcomes)
      .where(
        and(
          eq(redditPostOutcomes.userId, userId),
          gte(redditPostOutcomes.occurredAt, thirtyDaysAgo)
        )
      );

    const total = Number(postStats?.totalPosts || 0);
    const successful = Number(postStats?.successfulPosts || 0);
    const recentPosts = Number(postStats?.recentPosts || 0);
    const subredditCount = Number(postStats?.subredditCount || 0);
    const successRate = total > 0 ? (successful / total) * 100 : 0;

    // Suggestion 1: Posting frequency
    if (recentPosts < 5) {
      suggestions.push({
        title: 'Increase Posting Frequency',
        description: `You've posted ${recentPosts} times this week. Aim for 5-7 posts for better growth`,
        confidence: 90,
        reasoning: 'Consistent posting builds audience and improves algorithm visibility',
        examples: [
          'Schedule 1 post per day',
          'Focus on your top 3 subreddits',
          'Use scheduling to maintain consistency'
        ]
      });
    }

    // Suggestion 2: Success rate improvement
    if (successRate < 70 && total > 5) {
      suggestions.push({
        title: 'Improve Validation Success Rate',
        description: `Your success rate is ${successRate.toFixed(1)}%. Use pre-post validation to avoid rejections`,
        confidence: 95,
        reasoning: `Analysis of ${total} posts shows room for improvement`,
        examples: [
          'Always validate before posting',
          'Review subreddit rules carefully',
          'Check karma and age requirements'
        ]
      });
    }

    // Suggestion 3: Diversify subreddits
    if (subredditCount < 3 && total > 10) {
      suggestions.push({
        title: 'Expand to More Subreddits',
        description: `You're posting in ${subredditCount} subreddits. Try 3-5 for better reach`,
        confidence: 85,
        reasoning: 'Diversification reduces risk and increases audience',
        examples: [
          'Find similar subreddits to your top performers',
          'Start with verification posts in new communities',
          'Test engagement before committing'
        ]
      });
    }

    // 4. Analyze best performing subreddits
    const topSubreddits = await db
      .select({
        subreddit: redditPostOutcomes.subreddit,
        posts: count(),
        successRate: sql<number>`COUNT(CASE WHEN success = true THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100`
      })
      .from(redditPostOutcomes)
      .where(
        and(
          eq(redditPostOutcomes.userId, userId),
          gte(redditPostOutcomes.occurredAt, thirtyDaysAgo)
        )
      )
      .groupBy(redditPostOutcomes.subreddit)
      .having(sql`COUNT(*) >= 3`)
      .orderBy(desc(sql`COUNT(CASE WHEN success = true THEN 1 END)::float / NULLIF(COUNT(*), 0)`))
      .limit(1);

    if (topSubreddits.length > 0 && Number(topSubreddits[0].successRate) > 80) {
      const sub = topSubreddits[0];
      suggestions.push({
        title: `Focus on r/${sub.subreddit}`,
        description: `${Number(sub.successRate).toFixed(0)}% success rate in this subreddit - your best performer!`,
        confidence: 92,
        reasoning: `Based on ${Number(sub.posts)} successful posts`,
        examples: [
          `Post 2-3 times per week in r/${sub.subreddit}`,
          'Maintain the content style that works here',
          'Consider similar subreddits with the same audience'
        ]
      });
    }

    // 5. Check for caption generation usage
    const [captionStats] = await db
      .select({
        totalGenerations: count()
      })
      .from(contentGenerations)
      .where(
        and(
          eq(contentGenerations.userId, userId),
          gte(contentGenerations.createdAt, thirtyDaysAgo)
        )
      );

    const captionCount = Number(captionStats?.totalGenerations || 0);
    if (captionCount < total * 0.5 && total > 5) {
      suggestions.push({
        title: 'Use AI Caption Generation More',
        description: 'AI-generated captions can improve engagement by suggesting proven formats',
        confidence: 80,
        reasoning: `You're using captions on ${Math.round((captionCount / total) * 100)}% of posts`,
        examples: [
          'Generate 2-3 caption options per post',
          'A/B test different caption styles',
          'Questions and CTAs increase engagement'
        ]
      });
    }

    // If no specific suggestions, provide general best practices
    if (suggestions.length === 0) {
      suggestions.push({
        title: 'Keep Up the Great Work!',
        description: 'Your posting strategy is performing well. Maintain consistency.',
        confidence: 85,
        reasoning: `${successRate.toFixed(0)}% success rate across ${total} posts`,
        examples: [
          'Continue your current posting schedule',
          'Experiment with new subreddits carefully',
          'Track your analytics to identify trends'
        ]
      });
    }

    return res.json(suggestions.slice(0, 5)); // Return top 5 suggestions
  } catch (error) {
    logger.error('Failed to generate suggestions', { error });
    return res.status(500).json({ error: 'Failed to generate content suggestions' });
  }
});

/**
 * GET /api/intelligence/performance
 * Get performance metrics for a subreddit
 */
router.get('/performance', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const subreddit = req.query.subreddit as string || 'gonewild';
    const userTier = req.user?.tier || 'free';
    const tierLevel = TIER_ACCESS[userTier as keyof typeof TIER_ACCESS] || 0;
    
    // Pro feature or higher
    if (tierLevel < TIER_ACCESS.pro) {
      return res.status(403).json({ 
        error: 'Performance metrics require Pro tier or higher',
        requiredTier: 'pro' 
      });
    }

    // Get subreddit info
    const [subredditInfo] = await db
      .select()
      .from(redditCommunities)
      .where(eq(redditCommunities.name, subreddit))
      .limit(1);

    // Get user's performance in this subreddit
    const thirtyDaysAgo = subDays(new Date(), 30);
    const userPerformance = await db
      .select({
        totalPosts: count(),
        successfulPosts: sql<number>`count(*) filter (where status = 'successful')`
      })
      .from(redditPostOutcomes)
      .where(
        and(
          eq(redditPostOutcomes.userId, userId ?? 0),
          eq(redditPostOutcomes.subreddit, subreddit),
          gte(redditPostOutcomes.occurredAt, thirtyDaysAgo)
        )
      );

    // Get top performing content types based on user's actual posts
    const contentTypePerformance = await db
      .select({
        status: redditPostOutcomes.status,
        postCount: count(),
        avgEngagement: sql<number>`AVG(COALESCE(upvotes, 0) + COALESCE(views, 0))`
      })
      .from(redditPostOutcomes)
      .where(
        and(
          eq(redditPostOutcomes.userId, userId ?? 0),
          eq(redditPostOutcomes.subreddit, subreddit),
          gte(redditPostOutcomes.occurredAt, thirtyDaysAgo)
        )
      )
      .groupBy(redditPostOutcomes.status)
      .orderBy(desc(sql`AVG(COALESCE(upvotes, 0) + COALESCE(views, 0))`))
      .limit(5);

    const topContent = contentTypePerformance.map(ct => ({
      type: ct.status === 'successful' ? 'Successful Posts' : ct.status === 'removed' ? 'Removed Posts' : 'Other Posts',
      engagement: Math.round(Number(ct.avgEngagement)),
      count: Number(ct.postCount)
    }));

    // Calculate growth rate based on post frequency trend
    const twoWeeksAgo = subDays(new Date(), 14);
    const [recentPosts, olderPosts] = await Promise.all([
      db.select({ count: count() })
        .from(redditPostOutcomes)
        .where(and(
          eq(redditPostOutcomes.userId, userId ?? 0),
          eq(redditPostOutcomes.subreddit, subreddit),
          gte(redditPostOutcomes.occurredAt, twoWeeksAgo)
        )),
      db.select({ count: count() })
        .from(redditPostOutcomes)
        .where(and(
          eq(redditPostOutcomes.userId, userId ?? 0),
          eq(redditPostOutcomes.subreddit, subreddit),
          gte(redditPostOutcomes.occurredAt, thirtyDaysAgo),
          sql`occurred_at < ${twoWeeksAgo}`
        ))
    ]);

    const recentCount = Number(recentPosts[0]?.count || 0);
    const olderCount = Number(olderPosts[0]?.count || 0);
    const growthRate = olderCount > 0
      ? Number(((recentCount - olderCount) / olderCount * 100).toFixed(1))
      : 0;

    const metrics = {
      members: subredditInfo?.members || 0,
      activeUsers: Math.floor((subredditInfo?.members || 0) * 0.05),
      growthRate,
      topContent: topContent.length > 0 ? topContent : [{ type: 'No data yet', engagement: 0, count: 0 }],
      userStats: {
        posts: userPerformance[0]?.totalPosts || 0,
        successRate: userPerformance[0]?.successfulPosts
          ? ((userPerformance[0].successfulPosts / userPerformance[0].totalPosts) * 100).toFixed(1)
          : 0
      }
    };

    return res.json(metrics);
  } catch (error) {
    logger.error('Failed to fetch performance metrics', { error });
    return res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
});

/**
 * GET /api/intelligence/competitors
 * Analyze competitive landscape in user's subreddits (Premium only)
 */
router.get('/competitors', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userTier = req.user?.tier || 'free';
    const tierLevel = TIER_ACCESS[userTier as keyof typeof TIER_ACCESS] || 0;

    // Premium feature only
    if (tierLevel < TIER_ACCESS.premium) {
      return res.status(403).json({
        error: 'Competitor analysis requires Premium tier',
        requiredTier: 'premium'
      });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user's top subreddits to analyze competitive landscape
    const thirtyDaysAgo = subDays(new Date(), 30);
    const userSubreddits = await db
      .select({
        subreddit: redditPostOutcomes.subreddit,
        posts: count(),
        successRate: sql<number>`COUNT(CASE WHEN success = true THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100`,
        avgEngagement: sql<number>`AVG(COALESCE(upvotes, 0) + COALESCE(views, 0))`
      })
      .from(redditPostOutcomes)
      .where(
        and(
          eq(redditPostOutcomes.userId, userId),
          gte(redditPostOutcomes.occurredAt, thirtyDaysAgo)
        )
      )
      .groupBy(redditPostOutcomes.subreddit)
      .having(sql`COUNT(*) >= 2`)
      .orderBy(desc(count()))
      .limit(5);

    // Get community info for each subreddit
    const competitiveInsights = await Promise.all(
      userSubreddits.map(async (sub) => {
        const [communityInfo] = await db
          .select()
          .from(redditCommunities)
          .where(eq(redditCommunities.name, sub.subreddit))
          .limit(1);

        const members = communityInfo?.members || 0;
        const posts = Number(sub.posts);
        const successRate = Number(sub.successRate);
        const avgEng = Number(sub.avgEngagement);

        // Calculate estimated competition level
        let competition: 'low' | 'medium' | 'high' = 'medium';
        if (members > 500000) competition = 'high';
        else if (members < 100000) competition = 'low';

        // Estimate posting frequency needed for visibility
        let suggestedFrequency = '3-4x per week';
        if (competition === 'high') suggestedFrequency = 'Daily';
        else if (competition === 'low') suggestedFrequency = '2-3x per week';

        // Calculate performance vs expected
        const performanceScore = successRate > 70 ? 'excellent' : successRate > 50 ? 'good' : 'needs improvement';

        return {
          subreddit: sub.subreddit,
          members,
          yourPosts: posts,
          yourSuccessRate: Math.round(successRate),
          yourAvgEngagement: Math.round(avgEng),
          competition,
          suggestedFrequency,
          performanceScore,
          insights: [
            `${members.toLocaleString()} members - ${competition} competition`,
            `Your success rate: ${Math.round(successRate)}%`,
            `Suggested posting: ${suggestedFrequency}`,
            performanceScore === 'excellent'
              ? '✓ You\'re performing well here'
              : performanceScore === 'good'
                ? '→ Room for improvement'
                : '⚠ Consider reviewing your strategy'
          ]
        };
      })
    );

    // Add strategic recommendations
    const analysis = {
      overview: {
        totalSubreddits: userSubreddits.length,
        competitiveLandscape: competitiveInsights.filter(c => c.competition === 'high').length > 2
          ? 'Highly competitive - focus on differentiation'
          : competitiveInsights.filter(c => c.competition === 'low').length > 2
            ? 'Low competition - good opportunity for growth'
            : 'Mixed competition - balanced strategy needed',
        averageSuccessRate: Math.round(
          userSubreddits.reduce((sum, s) => sum + Number(s.successRate), 0) / userSubreddits.length
        )
      },
      subreddits: competitiveInsights,
      recommendations: [
        {
          priority: 'high',
          suggestion: competitiveInsights.filter(c => c.performanceScore === 'needs improvement').length > 0
            ? 'Focus on improving success rate in underperforming subreddits'
            : 'Maintain your strong performance across communities',
          action: competitiveInsights.filter(c => c.performanceScore === 'needs improvement').length > 0
            ? 'Review validation rules and timing for struggling subreddits'
            : 'Consider expanding to similar subreddits'
        },
        {
          priority: 'medium',
          suggestion: competitiveInsights.filter(c => c.competition === 'high').length > 2
            ? 'High competition in multiple subreddits - increase posting frequency'
            : 'Competition level is manageable with current strategy',
          action: 'Post during optimal times and use high-quality content to stand out'
        }
      ],
      note: 'Full competitor tracking (specific creators) requires Reddit API partnership - coming soon'
    };

    return res.json(analysis);
  } catch (error) {
    logger.error('Failed to fetch competitor data', { error });
    return res.status(500).json({ error: 'Failed to fetch competitor analysis' });
  }
});

/**
 * POST /api/intelligence/suggest-content
 * AI-powered content suggestions based on user's top posts (NEW)
 */
router.post('/suggest-content', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { subreddit } = req.body;
    const userTier = req.user?.tier || 'free';
    const tierLevel = TIER_ACCESS[userTier as keyof typeof TIER_ACCESS] || 0;
    
    // Premium feature
    if (tierLevel < TIER_ACCESS.premium) {
      return res.status(403).json({ 
        error: 'AI content suggestions require Premium tier',
        requiredTier: 'premium' 
      });
    }

    if (!subreddit || !userId) {
      return res.status(400).json({ error: 'Subreddit and user ID required' });
    }

    const suggestions = await generateContentSuggestions(userId, subreddit);
    return res.json({ success: true, data: suggestions });
  } catch (error) {
    logger.error('Failed to generate content suggestions', { error });
    return res.status(500).json({ error: 'Failed to generate suggestions' });
  }
});

/**
 * GET /api/intelligence/top-posts
 * Get user's top performing posts (NEW)
 */
router.get('/top-posts', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const subreddit = req.query.subreddit as string;
    const limit = parseInt(req.query.limit as string) || 10;
    
    if (!subreddit || !userId) {
      return res.status(400).json({ error: 'Subreddit required' });
    }

    const posts = await getTopPerformingPosts(userId, subreddit, limit);
    return res.json({ success: true, count: posts.length, data: posts });
  } catch (error) {
    logger.error('Failed to fetch top posts', { error });
    return res.status(500).json({ error: 'Failed to fetch top posts' });
  }
});

/**
 * GET /api/intelligence/content-patterns
 * Analyze content patterns from user's posts (NEW)
 */
router.get('/content-patterns', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const subreddit = req.query.subreddit as string;
    
    if (!subreddit || !userId) {
      return res.status(400).json({ error: 'Subreddit required' });
    }

    const posts = await getTopPerformingPosts(userId, subreddit, 20);
    const patterns = analyzeContentPatterns(posts);
    return res.json({ success: true, sampleSize: posts.length, data: patterns });
  } catch (error) {
    logger.error('Failed to analyze patterns', { error });
    return res.status(500).json({ error: 'Failed to analyze content patterns' });
  }
});

/**
 * POST /api/intelligence/suggest-titles
 * Generate AI title suggestions (NEW)
 */
router.post('/suggest-titles', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { subreddit, count = 5 } = req.body;
    const userTier = req.user?.tier || 'free';
    const tierLevel = TIER_ACCESS[userTier as keyof typeof TIER_ACCESS] || 0;
    
    // Premium feature
    if (tierLevel < TIER_ACCESS.premium) {
      return res.status(403).json({ 
        error: 'AI title generation requires Premium tier',
        requiredTier: 'premium' 
      });
    }

    if (!subreddit || !userId) {
      return res.status(400).json({ error: 'Subreddit required' });
    }

    const posts = await getTopPerformingPosts(userId, subreddit, 10);
    const patterns = analyzeContentPatterns(posts);
    const suggestions = await generateTitleSuggestions(patterns, subreddit, Math.min(count, 10));
    
    return res.json({ success: true, count: suggestions.length, data: suggestions });
  } catch (error) {
    logger.error('Failed to generate title suggestions', { error });
    return res.status(500).json({ error: 'Failed to generate title suggestions' });
  }
});

export { router as intelligenceRouter };
