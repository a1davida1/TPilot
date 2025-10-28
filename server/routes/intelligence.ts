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

/**
 * GET /api/intelligence/subreddit-recommendations
 * Suggest new subreddits based on user's successful communities (Level 1 Quick Win)
 * Finds similar communities with audience overlap and risk scoring
 */
router.get('/subreddit-recommendations', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userTier = req.user?.tier || 'free';
    const tierLevel = TIER_ACCESS[userTier as keyof typeof TIER_ACCESS] || 0;

    // Pro feature or higher
    if (tierLevel < TIER_ACCESS.pro) {
      return res.status(403).json({
        error: 'Subreddit recommendations require Pro tier or higher',
        requiredTier: 'pro'
      });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user's successful subreddits (60 days)
    const sixtyDaysAgo = subDays(new Date(), 60);
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
          gte(redditPostOutcomes.occurredAt, sixtyDaysAgo)
        )
      )
      .groupBy(redditPostOutcomes.subreddit)
      .having(sql`COUNT(*) >= 3`)
      .orderBy(desc(sql`COUNT(CASE WHEN success = true THEN 1 END)::float / NULLIF(COUNT(*), 0)`));

    if (userSubreddits.length === 0) {
      return res.json({
        sampleSize: 0,
        message: 'Post in at least 1 subreddit to get recommendations',
        recommendations: []
      });
    }

    // Get top 3 subreddits to base recommendations on
    const topSubreddits = userSubreddits.slice(0, 3);

    // Get details for user's top subreddits
    const topSubredditNames = topSubreddits.map(s => s.subreddit);
    const topCommunities = await db
      .select()
      .from(redditCommunities)
      .where(sql`${redditCommunities.name} = ANY(${topSubredditNames})`);

    if (topCommunities.length === 0) {
      return res.json({
        sampleSize: userSubreddits.length,
        message: 'Could not find community data for your subreddits',
        recommendations: []
      });
    }

    // Calculate average characteristics of user's successful subreddits
    const avgMembers = topCommunities.reduce((sum, c) => sum + (c.members || 0), 0) / topCommunities.length;
    const userPrefersNsfw = topCommunities.filter(c => c.over18).length / topCommunities.length > 0.5;

    // Find similar communities
    // Criteria: similar size, same NSFW preference, not already posting there
    const recommendations = await db
      .select()
      .from(redditCommunities)
      .where(
        and(
          // Not in user's current subreddits
          sql`${redditCommunities.name} != ALL(${topSubredditNames})`,
          // Same NSFW preference
          eq(redditCommunities.over18, userPrefersNsfw),
          // Similar size (0.3x to 3x average)
          sql`${redditCommunities.members} BETWEEN ${Math.floor(avgMembers * 0.3)} AND ${Math.ceil(avgMembers * 3)}`,
          // Has members data
          sql`${redditCommunities.members} > 0`
        )
      )
      .limit(50);

    if (recommendations.length === 0) {
      return res.json({
        sampleSize: userSubreddits.length,
        basedOn: topSubredditNames,
        message: 'No similar communities found. Try different subreddits.',
        recommendations: []
      });
    }

    // Score and rank recommendations
    const scoredRecommendations = recommendations.map(community => {
      const memberCount = community.members || 0;

      // 1. Size similarity score (0-100)
      const sizeRatio = memberCount / avgMembers;
      const sizeScore = Math.max(0, 100 - Math.abs(Math.log(sizeRatio)) * 30);

      // 2. Promotion friendliness score (0-100)
      let promotionScore = 0;
      if (community.promotionAllowed === 'yes') promotionScore = 100;
      else if (community.promotionAllowed === 'limited') promotionScore = 60;
      else if (community.promotionAllowed === 'no') promotionScore = 20;
      else promotionScore = 50; // unknown

      // 3. Entry barrier score (lower is better, inverted to 0-100)
      const rules = community.rules as any;
      const minKarma = rules?.eligibility?.minKarma || 0;
      const minAgeDays = rules?.eligibility?.minAccountAgeDays || 0;
      const verificationRequired = rules?.eligibility?.verificationRequired || false;

      let barrierScore = 100;
      if (verificationRequired) barrierScore -= 30;
      if (minKarma > 1000) barrierScore -= 20;
      else if (minKarma > 500) barrierScore -= 10;
      if (minAgeDays > 90) barrierScore -= 15;
      else if (minAgeDays > 30) barrierScore -= 7;
      barrierScore = Math.max(0, barrierScore);

      // 4. Competition level (based on size)
      let competition: 'low' | 'medium' | 'high' = 'medium';
      if (memberCount > 500000) competition = 'high';
      else if (memberCount < 100000) competition = 'low';

      // 5. Calculate final score (weighted average)
      const finalScore = Math.round(
        (sizeScore * 0.4) +
        (promotionScore * 0.3) +
        (barrierScore * 0.3)
      );

      // 6. Risk assessment
      const risks: string[] = [];
      if (verificationRequired) risks.push('Verification required');
      if (minKarma > 500) risks.push(`${minKarma} karma required`);
      if (minAgeDays > 30) risks.push(`${minAgeDays} day account age required`);
      if (community.promotionAllowed === 'no') risks.push('No promotion allowed');
      if (competition === 'high') risks.push('High competition');

      const riskLevel = risks.length === 0 ? 'low' as const :
        risks.length <= 2 ? 'medium' as const : 'high' as const;

      // 7. Opportunity assessment
      const opportunities: string[] = [];
      if (competition === 'low') opportunities.push('Low competition');
      if (memberCount >= 50000 && memberCount <= 200000) opportunities.push('Sweet spot size');
      if (community.promotionAllowed === 'yes') opportunities.push('Promotion friendly');
      if (barrierScore >= 80) opportunities.push('Easy entry');
      if (Math.abs(sizeRatio - 1) < 0.3) opportunities.push('Very similar to your successes');

      return {
        subreddit: community.name,
        members: memberCount,
        description: community.description?.substring(0, 150) || 'No description',
        score: finalScore,
        competition,
        riskLevel,
        risks,
        opportunities,
        requirements: {
          verification: verificationRequired,
          minKarma,
          minAccountAge: minAgeDays,
          promotionAllowed: community.promotionAllowed || 'unknown'
        },
        similarity: {
          sizeRatio: Number(sizeRatio.toFixed(2)),
          nsfwMatch: community.over18 === userPrefersNsfw,
          avgMemberCount: Math.round(avgMembers)
        }
      };
    });

    // Sort by score and filter by risk
    const sortedRecommendations = scoredRecommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);

    // Group by risk level
    const lowRisk = sortedRecommendations.filter(r => r.riskLevel === 'low');
    const mediumRisk = sortedRecommendations.filter(r => r.riskLevel === 'medium');
    const highRisk = sortedRecommendations.filter(r => r.riskLevel === 'high');

    return res.json({
      sampleSize: userSubreddits.length,
      basedOn: topSubredditNames.map((name, i) => ({
        subreddit: name,
        successRate: Math.round(Number(topSubreddits[i].successRate)),
        posts: Number(topSubreddits[i].posts)
      })),
      summary: {
        totalRecommendations: sortedRecommendations.length,
        lowRisk: lowRisk.length,
        mediumRisk: mediumRisk.length,
        highRisk: highRisk.length,
        avgCompetition: community => {
          const counts = { low: 0, medium: 0, high: 0 };
          sortedRecommendations.forEach(r => counts[r.competition]++);
          const max = Math.max(counts.low, counts.medium, counts.high);
          if (counts.low === max) return 'low';
          if (counts.medium === max) return 'medium';
          return 'high';
        }
      },
      recommendations: {
        lowRisk: lowRisk.slice(0, 5),
        mediumRisk: mediumRisk.slice(0, 5),
        highRisk: highRisk.slice(0, 3)
      },
      insights: [
        `Found ${sortedRecommendations.length} similar communities to your top ${topSubredditNames.length} subreddits`,
        `${lowRisk.length} low-risk opportunities perfect for immediate expansion`,
        `Average community size: ${Math.round(avgMembers).toLocaleString()} members`,
        userPrefersNsfw ? 'Focusing on NSFW communities' : 'Focusing on SFW communities'
      ]
    });
  } catch (error) {
    logger.error('Failed to generate subreddit recommendations', { error });
    return res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

/**
 * GET /api/intelligence/posting-cadence/:subreddit
 * Analyze posting cadence and detect over/under-posting (Level 1 Quick Win)
 * Detects diminishing returns, optimal gaps, and burnout patterns
 */
router.get('/posting-cadence/:subreddit', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const subreddit = req.params.subreddit;
    const userId = req.user?.id;
    const userTier = req.user?.tier || 'free';
    const tierLevel = TIER_ACCESS[userTier as keyof typeof TIER_ACCESS] || 0;

    // Pro feature or higher
    if (tierLevel < TIER_ACCESS.pro) {
      return res.status(403).json({
        error: 'Posting cadence analysis requires Pro tier or higher',
        requiredTier: 'pro'
      });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get posts from last 90 days
    const ninetyDaysAgo = subDays(new Date(), 90);

    const posts = await db
      .select({
        occurredAt: redditPostOutcomes.occurredAt,
        success: redditPostOutcomes.success,
        upvotes: sql<number>`COALESCE(upvotes, 0)`,
        views: sql<number>`COALESCE(views, 0)`
      })
      .from(redditPostOutcomes)
      .where(
        and(
          eq(redditPostOutcomes.userId, userId),
          eq(redditPostOutcomes.subreddit, subreddit),
          gte(redditPostOutcomes.occurredAt, ninetyDaysAgo)
        )
      )
      .orderBy(redditPostOutcomes.occurredAt);

    if (posts.length < 5) {
      return res.json({
        sampleSize: posts.length,
        message: 'Not enough posts to analyze cadence. Need at least 5 posts.',
        recommendation: 'Post more consistently to get cadence insights',
        optimalGapHours: 48,
        currentStatus: 'insufficient-data'
      });
    }

    // Calculate gaps between posts (in hours)
    const gaps: number[] = [];
    const gapEngagements: Array<{ gap: number; engagement: number }> = [];

    for (let i = 1; i < posts.length; i++) {
      const prevPost = posts[i - 1];
      const currPost = posts[i];
      const gapHours = (currPost.occurredAt.getTime() - prevPost.occurredAt.getTime()) / (1000 * 60 * 60);
      gaps.push(gapHours);

      const engagement = Number(currPost.upvotes) + Number(currPost.views);
      gapEngagements.push({ gap: gapHours, engagement });
    }

    const avgGap = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
    const minGap = Math.min(...gaps);
    const maxGap = Math.max(...gaps);

    // Analyze engagement by gap buckets
    const gapBuckets = {
      tooFrequent: { label: '< 12 hours', gaps: [] as number[], engagements: [] as number[] },
      frequent: { label: '12-24 hours', gaps: [] as number[], engagements: [] as number[] },
      moderate: { label: '24-48 hours', gaps: [] as number[], engagements: [] as number[] },
      spaced: { label: '48-72 hours', gaps: [] as number[], engagements: [] as number[] },
      infrequent: { label: '> 72 hours', gaps: [] as number[], engagements: [] as number[] }
    };

    gapEngagements.forEach(({ gap, engagement }) => {
      if (gap < 12) {
        gapBuckets.tooFrequent.gaps.push(gap);
        gapBuckets.tooFrequent.engagements.push(engagement);
      } else if (gap < 24) {
        gapBuckets.frequent.gaps.push(gap);
        gapBuckets.frequent.engagements.push(engagement);
      } else if (gap < 48) {
        gapBuckets.moderate.gaps.push(gap);
        gapBuckets.moderate.engagements.push(engagement);
      } else if (gap < 72) {
        gapBuckets.spaced.gaps.push(gap);
        gapBuckets.spaced.engagements.push(engagement);
      } else {
        gapBuckets.infrequent.gaps.push(gap);
        gapBuckets.infrequent.engagements.push(engagement);
      }
    });

    const gapAnalysis = Object.entries(gapBuckets)
      .filter(([, data]) => data.gaps.length > 0)
      .map(([key, data]) => {
        const avgEng = data.engagements.reduce((sum, e) => sum + e, 0) / data.engagements.length;
        return {
          range: data.label,
          posts: data.gaps.length,
          avgEngagement: Math.round(avgEng),
          percentage: Math.round((data.gaps.length / gaps.length) * 100)
        };
      })
      .sort((a, b) => b.avgEngagement - a.avgEngagement);

    // Detect diminishing returns (posting too frequently)
    const tooFrequentAvg = gapBuckets.tooFrequent.engagements.length > 0
      ? gapBuckets.tooFrequent.engagements.reduce((sum, e) => sum + e, 0) / gapBuckets.tooFrequent.engagements.length
      : 0;

    const moderateAvg = gapBuckets.moderate.engagements.length > 0
      ? gapBuckets.moderate.engagements.reduce((sum, e) => sum + e, 0) / gapBuckets.moderate.engagements.length
      : 0;

    const diminishingReturns = tooFrequentAvg > 0 && moderateAvg > 0 && tooFrequentAvg < moderateAvg * 0.7;

    // Calculate optimal gap (best performing bucket)
    let optimalGapHours = 48; // Default
    if (gapAnalysis.length > 0) {
      const bestBucket = gapAnalysis[0];
      // Parse range to get midpoint
      if (bestBucket.range.includes('< 12')) optimalGapHours = 8;
      else if (bestBucket.range.includes('12-24')) optimalGapHours = 18;
      else if (bestBucket.range.includes('24-48')) optimalGapHours = 36;
      else if (bestBucket.range.includes('48-72')) optimalGapHours = 60;
      else optimalGapHours = 84;
    }

    // Detect burnout pattern (engagement dropping over time)
    const firstHalfPosts = posts.slice(0, Math.floor(posts.length / 2));
    const secondHalfPosts = posts.slice(Math.floor(posts.length / 2));

    const firstHalfAvgEng = firstHalfPosts.reduce((sum, p) => sum + (Number(p.upvotes) + Number(p.views)), 0) / firstHalfPosts.length;
    const secondHalfAvgEng = secondHalfPosts.reduce((sum, p) => sum + (Number(p.upvotes) + Number(p.views)), 0) / secondHalfPosts.length;

    const engagementTrend = secondHalfAvgEng > firstHalfAvgEng * 1.1 ? 'improving' :
      secondHalfAvgEng < firstHalfAvgEng * 0.8 ? 'declining' : 'stable';

    const burnoutDetected = engagementTrend === 'declining' && avgGap < 24;

    // Determine posting frequency status
    let status: 'over-posting' | 'optimal' | 'under-posting' | 'inconsistent';
    let recommendation: string;

    if (diminishingReturns) {
      status = 'over-posting';
      recommendation = `You're posting too frequently (avg ${Math.round(avgGap)}h gap). Increase to ${optimalGapHours}h between posts to improve engagement by ${Math.round((moderateAvg / tooFrequentAvg - 1) * 100)}%`;
    } else if (avgGap > 72 && gapAnalysis.some(g => g.range.includes('24-48') && g.avgEngagement > 0)) {
      status = 'under-posting';
      recommendation = `Post more frequently - your best engagement is at ${optimalGapHours}h gaps, not ${Math.round(avgGap)}h`;
    } else if (maxGap > avgGap * 3) {
      status = 'inconsistent';
      recommendation = `Your posting is inconsistent (${Math.round(minGap)}h to ${Math.round(maxGap)}h). Try to maintain ${optimalGapHours}h between posts`;
    } else {
      status = 'optimal';
      recommendation = `Your cadence is working well! Keep posting every ${Math.round(avgGap)}h`;
    }

    // Generate insights
    const insights: string[] = [];

    if (burnoutDetected) {
      insights.push(`⚠️ Burnout detected: Engagement down ${Math.round((1 - secondHalfAvgEng / firstHalfAvgEng) * 100)}% - take a break or reduce frequency`);
    }

    if (diminishingReturns) {
      insights.push(`📉 Diminishing returns: Posts < 12h apart get ${Math.round((1 - tooFrequentAvg / moderateAvg) * 100)}% less engagement`);
    }

    if (gapAnalysis.length > 0) {
      const best = gapAnalysis[0];
      insights.push(`✅ Best performance: ${best.range} gaps (${best.avgEngagement} avg engagement)`);
    }

    if (engagementTrend === 'improving') {
      insights.push(`📈 Engagement trending up ${Math.round((secondHalfAvgEng / firstHalfAvgEng - 1) * 100)}% - keep it up!`);
    }

    const postsPerWeek = (posts.length / 90) * 7;
    insights.push(`📊 Current pace: ${postsPerWeek.toFixed(1)} posts/week`);

    const optimalPostsPerWeek = (7 * 24) / optimalGapHours;
    if (Math.abs(postsPerWeek - optimalPostsPerWeek) > 1) {
      insights.push(`🎯 Optimal pace: ${optimalPostsPerWeek.toFixed(1)} posts/week (${Math.round(optimalGapHours)}h gaps)`);
    }

    return res.json({
      sampleSize: posts.length,
      daysAnalyzed: 90,
      currentCadence: {
        avgGapHours: Math.round(avgGap),
        minGapHours: Math.round(minGap),
        maxGapHours: Math.round(maxGap),
        postsPerWeek: Number(postsPerWeek.toFixed(1)),
        consistency: maxGap > avgGap * 2 ? 'inconsistent' : 'consistent'
      },
      optimalCadence: {
        recommendedGapHours: optimalGapHours,
        postsPerWeek: Number(optimalPostsPerWeek.toFixed(1))
      },
      gapAnalysis,
      status,
      engagementTrend: {
        direction: engagementTrend,
        firstHalfAvg: Math.round(firstHalfAvgEng),
        secondHalfAvg: Math.round(secondHalfAvgEng),
        changePercent: Math.round((secondHalfAvgEng / firstHalfAvgEng - 1) * 100)
      },
      warnings: {
        diminishingReturns,
        burnoutDetected,
        overPosting: status === 'over-posting',
        inconsistentSchedule: status === 'inconsistent'
      },
      recommendation,
      insights
    });
  } catch (error) {
    logger.error('Failed to analyze posting cadence', { error });
    return res.status(500).json({ error: 'Failed to analyze posting cadence' });
  }
});

/**
 * GET /api/intelligence/title-analysis/:subreddit
 * Comprehensive title intelligence analysis (Level 1 Quick Win)
 * Analyzes successful post titles to extract patterns and provide recommendations
 */
router.get('/title-analysis/:subreddit', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const subreddit = req.params.subreddit;
    const userId = req.user?.id;
    const userTier = req.user?.tier || 'free';
    const tierLevel = TIER_ACCESS[userTier as keyof typeof TIER_ACCESS] || 0;

    // Pro feature or higher
    if (tierLevel < TIER_ACCESS.pro) {
      return res.status(403).json({
        error: 'Title analysis requires Pro tier or higher',
        requiredTier: 'pro'
      });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get successful posts from last 60 days
    const sixtyDaysAgo = subDays(new Date(), 60);

    const successfulPosts = await db
      .select({
        title: sql<string>`COALESCE(title, '')`,
        upvotes: sql<number>`COALESCE(upvotes, 0)`,
        views: sql<number>`COALESCE(views, 0)`,
        occurredAt: redditPostOutcomes.occurredAt
      })
      .from(redditPostOutcomes)
      .where(
        and(
          eq(redditPostOutcomes.userId, userId),
          eq(redditPostOutcomes.subreddit, subreddit),
          eq(redditPostOutcomes.success, true),
          gte(redditPostOutcomes.occurredAt, sixtyDaysAgo)
        )
      )
      .orderBy(desc(sql`COALESCE(upvotes, 0) + COALESCE(views, 0)`))
      .limit(50);

    if (successfulPosts.length === 0) {
      return res.json({
        sampleSize: 0,
        message: 'Not enough successful posts to analyze. Post more in this subreddit!',
        recommendations: [
          'Post consistently to build up data',
          'Try different title styles to see what works',
          'Use questions and emojis to increase engagement'
        ]
      });
    }

    // Calculate metrics
    const titles = successfulPosts.map(p => String(p.title || ''));
    const engagementScores = successfulPosts.map(p => Number(p.upvotes) + Number(p.views));

    // 1. Average title length
    const lengths = titles.map(t => t.length);
    const avgLength = Math.round(lengths.reduce((sum, l) => sum + l, 0) / lengths.length);
    const minLength = Math.min(...lengths);
    const maxLength = Math.max(...lengths);

    // 2. Question ratio (titles ending with ?)
    const questionsCount = titles.filter(t => t.trim().endsWith('?')).length;
    const questionRatio = Math.round((questionsCount / titles.length) * 100);

    // Calculate avg engagement for questions vs statements
    const questionEngagement = successfulPosts
      .filter(p => String(p.title).trim().endsWith('?'))
      .reduce((sum, p) => sum + (Number(p.upvotes) + Number(p.views)), 0) / (questionsCount || 1);

    const statementEngagement = successfulPosts
      .filter(p => !String(p.title).trim().endsWith('?'))
      .reduce((sum, p) => sum + (Number(p.upvotes) + Number(p.views)), 0) / ((titles.length - questionsCount) || 1);

    // 3. Emoji effectiveness
    const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
    const titlesWithEmojis = titles.filter(t => emojiRegex.test(t));
    const titlesWithoutEmojis = titles.filter(t => !emojiRegex.test(t));

    const emojiUsageRate = Math.round((titlesWithEmojis.length / titles.length) * 100);

    const emojiEngagement = successfulPosts
      .filter(p => emojiRegex.test(String(p.title)))
      .reduce((sum, p) => sum + (Number(p.upvotes) + Number(p.views)), 0) / (titlesWithEmojis.length || 1);

    const noEmojiEngagement = successfulPosts
      .filter(p => !emojiRegex.test(String(p.title)))
      .reduce((sum, p) => sum + (Number(p.upvotes) + Number(p.views)), 0) / (titlesWithoutEmojis.length || 1);

    // Extract most common emojis
    const allEmojis = titles.flatMap(t => t.match(emojiRegex) || []);
    const emojiFreq: Record<string, number> = {};
    allEmojis.forEach(e => emojiFreq[e] = (emojiFreq[e] || 0) + 1);
    const topEmojis = Object.entries(emojiFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([emoji, count]) => ({ emoji, count, percentage: Math.round((count / titles.length) * 100) }));

    // 4. Common keywords (excluding stop words)
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'my', 'me', 'i', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must', 'this', 'that', 'these', 'those', 'it', 'its', 'you', 'your', 'he', 'she', 'they', 'them', 'their']);
    const wordFreq: Record<string, number> = {};

    titles.forEach(title => {
      const words = title.toLowerCase().match(/\w+/g) || [];
      words.forEach(word => {
        if (!stopWords.has(word) && word.length > 2) {
          wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
      });
    });

    const topKeywords = Object.entries(wordFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word, count]) => ({ word, count, percentage: Math.round((count / titles.length) * 100) }));

    // 5. Sentiment hints (playful vs serious)
    const playfulWords = ['hehe', 'oops', 'uh oh', 'first time', 'shy', 'nervous', 'maybe', 'should i', 'what do you think', 'be nice', 'be gentle', 'thoughts', 'opinions'];
    const directWords = ['here', 'just', 'look', 'check out', 'showing', 'new', 'fresh', 'ready', 'waiting'];

    const playfulCount = titles.filter(t =>
      playfulWords.some(pw => t.toLowerCase().includes(pw))
    ).length;

    const directCount = titles.filter(t =>
      directWords.some(dw => t.toLowerCase().includes(dw))
    ).length;

    const sentimentScore = playfulCount > directCount
      ? { type: 'playful' as const, confidence: Math.round((playfulCount / titles.length) * 100) }
      : { type: 'direct' as const, confidence: Math.round((directCount / titles.length) * 100) };

    // 6. Length vs engagement correlation
    const lengthBuckets = {
      veryShort: { range: '0-30 chars', posts: 0, totalEngagement: 0 },
      short: { range: '31-50 chars', posts: 0, totalEngagement: 0 },
      medium: { range: '51-70 chars', posts: 0, totalEngagement: 0 },
      long: { range: '71-100 chars', posts: 0, totalEngagement: 0 },
      veryLong: { range: '100+ chars', posts: 0, totalEngagement: 0 }
    };

    successfulPosts.forEach((p, i) => {
      const len = String(p.title).length;
      const eng = engagementScores[i];

      if (len <= 30) {
        lengthBuckets.veryShort.posts++;
        lengthBuckets.veryShort.totalEngagement += eng;
      } else if (len <= 50) {
        lengthBuckets.short.posts++;
        lengthBuckets.short.totalEngagement += eng;
      } else if (len <= 70) {
        lengthBuckets.medium.posts++;
        lengthBuckets.medium.totalEngagement += eng;
      } else if (len <= 100) {
        lengthBuckets.long.posts++;
        lengthBuckets.long.totalEngagement += eng;
      } else {
        lengthBuckets.veryLong.posts++;
        lengthBuckets.veryLong.totalEngagement += eng;
      }
    });

    const lengthAnalysis = Object.entries(lengthBuckets)
      .filter(([, data]) => data.posts > 0)
      .map(([key, data]) => ({
        range: data.range,
        posts: data.posts,
        avgEngagement: Math.round(data.totalEngagement / data.posts),
        percentage: Math.round((data.posts / titles.length) * 100)
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement);

    // Generate recommendations
    const recommendations: string[] = [];

    // Length recommendation
    if (lengthAnalysis.length > 0) {
      const bestLength = lengthAnalysis[0];
      recommendations.push(`Your best performing length is ${bestLength.range} (${bestLength.avgEngagement} avg engagement)`);
    }
    recommendations.push(`Optimal range for you: ${Math.max(avgLength - 15, 20)}-${avgLength + 15} characters`);

    // Question recommendation
    if (questionRatio > 0) {
      const effectiveness = questionEngagement > statementEngagement ?
        `${Math.round((questionEngagement / statementEngagement - 1) * 100)}% more effective` :
        `${Math.round((1 - questionEngagement / statementEngagement) * 100)}% less effective`;
      recommendations.push(`Questions are ${effectiveness} than statements for you`);
    } else {
      recommendations.push('Try adding questions to your titles - they typically increase engagement by 20-40%');
    }

    // Emoji recommendation
    if (emojiUsageRate > 0) {
      if (emojiEngagement > noEmojiEngagement * 1.1) {
        recommendations.push(`Keep using emojis - they boost your engagement by ${Math.round((emojiEngagement / noEmojiEngagement - 1) * 100)}%`);
      } else if (emojiEngagement < noEmojiEngagement * 0.9) {
        recommendations.push(`Consider using fewer emojis - posts without them perform ${Math.round((1 - emojiEngagement / noEmojiEngagement) * 100)}% better`);
      }
    } else {
      recommendations.push('Try adding 1-2 emojis to your titles - they can increase engagement');
    }

    // Keyword recommendation
    if (topKeywords.length > 0) {
      recommendations.push(`Your power words: ${topKeywords.slice(0, 3).map(k => k.word).join(', ')}`);
    }

    // Sentiment recommendation
    if (sentimentScore.confidence > 30) {
      recommendations.push(`Your ${sentimentScore.type} tone works well - stick with it`);
    }

    return res.json({
      sampleSize: successfulPosts.length,
      daysAnalyzed: 60,
      overview: {
        avgTitleLength: avgLength,
        lengthRange: { min: minLength, max: maxLength },
        questionRatio,
        emojiUsageRate,
        sentiment: sentimentScore
      },
      questionAnalysis: {
        percentage: questionRatio,
        avgEngagement: Math.round(questionEngagement),
        vsStatements: Math.round(statementEngagement),
        verdict: questionEngagement > statementEngagement ? 'Questions work better for you' : 'Statements work better for you'
      },
      emojiAnalysis: {
        usageRate: emojiUsageRate,
        avgEngagementWithEmoji: Math.round(emojiEngagement),
        avgEngagementWithoutEmoji: Math.round(noEmojiEngagement),
        topEmojis,
        verdict: emojiEngagement > noEmojiEngagement ? 'Emojis increase engagement' : 'Emojis decrease engagement'
      },
      lengthAnalysis,
      topKeywords,
      recommendations
    });
  } catch (error) {
    logger.error('Failed to analyze titles', { error });
    return res.status(500).json({ error: 'Failed to analyze title patterns' });
  }
});

export { router as intelligenceRouter };
