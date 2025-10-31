import { Router, type Request, type Response } from "express";
import { eq, sql, desc, gte, and } from "drizzle-orm";

import { db } from "../db.js";
import { logger } from "../bootstrap/logger.js";
import { users, contentGenerations, subscriptions, redditPostOutcomes } from "@shared/schema";
import { authenticateToken, type AuthRequest } from "../middleware/auth.js";
import {
  getUserAnalyticsOverview,
  getSubredditPerformance,
  getRecentActivity,
  getPostingActivity,
  getUserRedditStats
} from "../services/user-analytics-service.js";

interface LandingMetrics {
  creators: number;
  posts: number;
  engagement: number;
  activeSubscriptions: number;
  generatedAt: string;
}

const analyticsRouter = Router();

function sanitizeCount(value: unknown): number {
  const numericValue = typeof value === "number" ? value : Number(value ?? 0);

  if (Number.isFinite(numericValue) === false || numericValue < 0) {
    return 0;
  }

  if (numericValue > Number.MAX_SAFE_INTEGER) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Math.floor(numericValue);
}

async function loadLandingMetrics(): Promise<LandingMetrics> {
  const [userCountResult, generationCountResult, activeSubscriptionsResult] = await Promise.all([
    db
      .select({ value: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.isDeleted, false)),
    db.select({ value: sql<number>`count(*)` }).from(contentGenerations),
    db
      .select({ value: sql<number>`count(*)` })
      .from(subscriptions)
      .where(eq(subscriptions.status, "active")),
  ]);

  const creators = sanitizeCount(userCountResult[0]?.value);
  const posts = sanitizeCount(generationCountResult[0]?.value);
  const activeSubscriptions = sanitizeCount(activeSubscriptionsResult[0]?.value);

  const engagement = creators === 0
    ? 0
    : Math.min(100, Math.round((activeSubscriptions / creators) * 100));

  return {
    creators,
    posts,
    engagement,
    activeSubscriptions,
    generatedAt: new Date().toISOString(),
  };
}

async function handleLandingMetrics(_req: Request, res: Response): Promise<void> {
  try {
    const metrics = await loadLandingMetrics();
    res.json(metrics);
  } catch (error: unknown) {
    logger.error("Failed to load landing metrics", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Unable to fetch analytics summary" });
  }
}

// Tier-based analytics endpoint for the dashboard
analyticsRouter.get("/", authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userTier = req.query.tier as string || 'free';
    const range = req.query.range as string || '7d';

    // Check tier access
    const tierLevels: Record<string, number> = {
      free: 0,
      starter: 1,
      pro: 2,
      premium: 3,
      admin: 4
    };

    const tierLevel = tierLevels[userTier] || 0;

    // Free and Starter tiers don't get analytics
    if (tierLevel < 2) {
      return res.status(403).json({
        error: 'Analytics requires Pro or Premium tier',
        requiredTier: 'pro'
      });
    }

    // Calculate days back from range
    const daysBack = range === '90d' ? 90 : range === '30d' ? 30 : 7;

    // Fetch real analytics data using user-analytics-service
    const [overview, subredditPerformance, postingActivity, bestTimes] = await Promise.all([
      getUserAnalyticsOverview(userId, daysBack),
      getSubredditPerformance(userId, daysBack),
      getPostingActivity(userId, daysBack),
      getBestPostingTimes(userId, daysBack)
    ]);

    // Calculate growth rate from posting activity
    const recentDays = postingActivity.slice(-7);
    const previousDays = postingActivity.slice(-14, -7);
    const recentTotal = recentDays.reduce((sum, day) => sum + day.posts, 0);
    const previousTotal = previousDays.reduce((sum, day) => sum + day.posts, 0);
    const growthRate = previousTotal > 0
      ? ((recentTotal - previousTotal) / previousTotal) * 100
      : 0;

    // Transform to expected format
    const response = {
      overview: {
        totalPosts: overview.totalPosts,
        totalEngagement: overview.totalUpvotes + overview.totalViews,
        averageEngagementRate: overview.successRate,
        growthRate: Math.round(growthRate * 10) / 10,
        postsToday: postingActivity.find(d => d.date === new Date().toISOString().split('T')[0])?.posts || 0,
        postsThisWeek: postingActivity.slice(-7).reduce((sum, day) => sum + day.posts, 0),
        postsThisMonth: postingActivity.reduce((sum, day) => sum + day.posts, 0)
      },
      performance: {
        bestPostingTimes: bestTimes,
        topSubreddits: subredditPerformance.slice(0, 5).map(sub => ({
          name: sub.subreddit,
          posts: sub.totalPosts,
          engagement: sub.avgUpvotes + (sub.totalViews / 10), // Estimate engagement
          growth: sub.successRate
        })),
        contentPerformance: [
          { type: 'Posts', count: overview.totalPosts, avgEngagement: overview.averageScore }
        ] // TODO: Break down by content type when available
      },
      trends: {
        weeklyGrowth: postingActivity.slice(-7).map(day => ({
          date: day.date,
          posts: day.posts,
          engagement: day.successful * 100 // Estimate engagement from successful posts
        })),
        monthlyGrowth: [], // TODO: Aggregate by month
        projections: tierLevel >= 3 ? {
          nextWeek: Math.round(recentTotal * 1.1) || 0,
          nextMonth: Math.round(overview.totalPosts * 1.2) || 0,
          confidence: 78
        } : { nextWeek: 0, nextMonth: 0, confidence: 0 }
      },
      intelligence: tierLevel >= 3 ? {
        recommendations: buildRecommendations(overview, subredditPerformance),
        warnings: buildWarnings(overview, postingActivity),
        opportunities: buildOpportunities(subredditPerformance),
        competitors: [] // TODO: Implement competitor analysis
      } : {
        recommendations: [] as string[],
        warnings: [] as string[],
        opportunities: [] as unknown[],
        competitors: [] as unknown[]
      }
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to fetch analytics', { error });
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Helper functions for intelligence features
function buildRecommendations(overview: any, subredditPerf: any[]): string[] {
  const recommendations: string[] = [];

  if (overview.successRate < 50) {
    recommendations.push('Your success rate is below 50% - review subreddit rules before posting');
  }

  const topSub = subredditPerf[0];
  if (topSub && topSub.successRate > 80) {
    recommendations.push(`r/${topSub.subreddit} has ${topSub.successRate}% success rate - great fit for your content`);
  }

  if (overview.totalCaptionsGenerated > overview.totalPosts * 2) {
    recommendations.push('You generate more captions than posts - consider scheduling more content');
  }

  return recommendations;
}

function buildWarnings(overview: any, activity: any[]): string[] {
  const warnings: string[] = [];
  const recentDays = activity.slice(-7);
  const recentPosts = recentDays.reduce((sum, day) => sum + day.posts, 0);

  if (recentPosts < 3) {
    warnings.push('Posting frequency low - aim for 5+ posts per week for better growth');
  }

  if (overview.failedPosts > overview.successfulPosts) {
    warnings.push('More failed posts than successful - check validation warnings before posting');
  }

  return warnings;
}

function buildOpportunities(subredditPerf: any[]): Array<{ subreddit: string; reason: string; potential: number }> {
  return subredditPerf
    .filter(sub => sub.totalPosts >= 3 && sub.successRate >= 70)
    .slice(0, 3)
    .map(sub => ({
      subreddit: sub.subreddit,
      reason: `${sub.successRate}% success rate with ${sub.avgUpvotes} avg upvotes`,
      potential: Math.min(95, sub.successRate + 10)
    }));
}

async function getBestPostingTimes(userId: number, daysBack: number): Promise<Array<{ hour: number; day: string; engagement: number }>> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const results = await db
    .select({
      hour: sql<number>`EXTRACT(HOUR FROM occurred_at)`,
      dayName: sql<string>`TO_CHAR(occurred_at, 'Day')`,
      postCount: sql<number>`COUNT(*)`,
      avgEngagement: sql<number>`AVG(COALESCE(upvotes, 0) + COALESCE(views, 0))`,
      successRate: sql<number>`COUNT(CASE WHEN success = true THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100`
    })
    .from(redditPostOutcomes)
    .where(
      and(
        eq(redditPostOutcomes.userId, userId),
        gte(redditPostOutcomes.occurredAt, startDate)
      )
    )
    .groupBy(sql`EXTRACT(HOUR FROM occurred_at), TO_CHAR(occurred_at, 'Day')`)
    .having(sql`COUNT(*) >= 3`)
    .orderBy(desc(sql`AVG(COALESCE(upvotes, 0) + COALESCE(views, 0))`), desc(sql`COUNT(CASE WHEN success = true THEN 1 END)::float / NULLIF(COUNT(*), 0)`))
    .limit(3);

  return results.map(r => ({
    hour: Math.floor(Number(r.hour)),
    day: r.dayName.trim(),
    engagement: Math.round(Number(r.avgEngagement))
  }));
}

analyticsRouter.get("/landing/summary", handleLandingMetrics);
analyticsRouter.get("/metrics", handleLandingMetrics);
analyticsRouter.get("/summary", handleLandingMetrics);

/**
 * GET /api/analytics/overview
 * User-specific analytics overview with post stats and engagement
 */
analyticsRouter.get("/overview", authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const daysBack = parseInt(req.query.days as string) || 30;
    const overview = await getUserAnalyticsOverview(userId, daysBack);

    res.json(overview);
  } catch (error) {
    logger.error('Failed to fetch analytics overview', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch analytics overview' });
  }
});

/**
 * GET /api/analytics/subreddits
 * Per-subreddit performance metrics
 */
analyticsRouter.get("/subreddits", authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const daysBack = parseInt(req.query.days as string) || 30;
    const performance = await getSubredditPerformance(userId, daysBack);

    res.json({ subreddits: performance });
  } catch (error) {
    logger.error('Failed to fetch subreddit performance', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch subreddit performance' });
  }
});

/**
 * GET /api/analytics/activity
 * Recent activity timeline
 */
analyticsRouter.get("/activity", authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const activity = await getRecentActivity(userId, limit);

    res.json({ activity });
  } catch (error) {
    logger.error('Failed to fetch recent activity', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
});

/**
 * GET /api/analytics/posting-activity
 * Daily posting stats for charts
 */
analyticsRouter.get("/posting-activity", authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const daysBack = parseInt(req.query.days as string) || 30;
    const activity = await getPostingActivity(userId, daysBack);

    res.json({ activity });
  } catch (error) {
    logger.error('Failed to fetch posting activity', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch posting activity' });
  }
});

/**
 * GET /api/analytics/reddit-stats
 * User's Reddit account stats (karma, age, username)
 */
analyticsRouter.get("/reddit-stats", authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const stats = await getUserRedditStats(userId);

    if (!stats) {
      return res.status(404).json({ error: 'Reddit account not connected' });
    }

    res.json(stats);
  } catch (error) {
    logger.error('Failed to fetch Reddit stats', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch Reddit stats' });
  }
});

export { analyticsRouter, loadLandingMetrics };

// QW-7: Post Performance Predictor
import { predictionService } from '../services/prediction-service.js';

analyticsRouter.post('/predict-performance', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check tier access (Pro or Premium required)
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !['pro', 'premium'].includes(user.tier)) {
      return res.status(403).json({
        error: 'Performance prediction requires Pro or Premium tier',
        requiredTier: 'pro'
      });
    }

    const { subreddit, title, scheduledTime } = req.body;

    if (!subreddit || !title) {
      return res.status(400).json({ error: 'Missing required fields: subreddit, title' });
    }

    const prediction = await predictionService.predictPerformance({
      userId,
      subreddit,
      title,
      scheduledTime: scheduledTime ? new Date(scheduledTime) : new Date()
    });

    res.json(prediction);
  } catch (error) {
    logger.error('Failed to predict performance', { error });
    res.status(500).json({ error: 'Failed to predict performance' });
  }
});

// QW-8: Smart Subreddit Recommendations
import { recommendationService } from '../services/recommendation-service.js';

analyticsRouter.get('/subreddit-recommendations', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check tier access (Pro or Premium required)
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !['pro', 'premium'].includes(user.tier)) {
      return res.status(403).json({
        error: 'Subreddit recommendations require Pro or Premium tier',
        requiredTier: 'pro'
      });
    }

    const limit = parseInt(req.query.limit as string) || 10;

    const recommendations = await recommendationService.generateRecommendations(userId, limit);

    res.json({ recommendations });
  } catch (error) {
    logger.error('Failed to get subreddit recommendations', { error });
    res.status(500).json({ error: 'Failed to get subreddit recommendations' });
  }
});

// QW-6: Subreddit Health Score
import { subredditHealthService } from '../services/subreddit-health-service.js';

analyticsRouter.get('/subreddit-health', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check tier access (Pro or Premium required)
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !['pro', 'premium'].includes(user.tier)) {
      return res.status(403).json({
        error: 'Subreddit health scores require Pro or Premium tier',
        requiredTier: 'pro'
      });
    }

    const daysBack = parseInt(req.query.daysBack as string) || 30;
    const healthScores = await subredditHealthService.calculateAllHealth(userId, daysBack);

    res.json({ healthScores });
  } catch (error) {
    logger.error('Failed to get subreddit health', { error });
    res.status(500).json({ error: 'Failed to get subreddit health' });
  }
});

analyticsRouter.get('/subreddit-health/:subreddit', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check tier access (Pro or Premium required)
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !['pro', 'premium'].includes(user.tier)) {
      return res.status(403).json({
        error: 'Subreddit health scores require Pro or Premium tier',
        requiredTier: 'pro'
      });
    }

    const { subreddit } = req.params;
    const daysBack = parseInt(req.query.daysBack as string) || 30;

    const health = await subredditHealthService.calculateHealth(userId, subreddit, daysBack);

    res.json(health);
  } catch (error) {
    logger.error('Failed to get subreddit health', { error });
    res.status(500).json({ error: 'Failed to get subreddit health' });
  }
});

// QW-2: Post Removal Tracker
import { removalTrackerService } from '../services/removal-tracker-service.js';

analyticsRouter.get('/removal-history', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check tier access (Pro or Premium required)
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !['pro', 'premium'].includes(user.tier)) {
      return res.status(403).json({
        error: 'Removal tracking requires Pro or Premium tier',
        requiredTier: 'pro'
      });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const daysBack = parseInt(req.query.daysBack as string) || 90;

    const history = await removalTrackerService.getRemovalHistory(userId, limit, daysBack);

    res.json({ removals: history });
  } catch (error) {
    logger.error('Failed to get removal history', { error });
    res.status(500).json({ error: 'Failed to get removal history' });
  }
});

analyticsRouter.get('/removal-stats', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check tier access (Pro or Premium required)
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !['pro', 'premium'].includes(user.tier)) {
      return res.status(403).json({
        error: 'Removal statistics require Pro or Premium tier',
        requiredTier: 'pro'
      });
    }

    const daysBack = parseInt(req.query.daysBack as string) || 90;

    const stats = await removalTrackerService.getRemovalStats(userId, daysBack);

    res.json(stats);
  } catch (error) {
    logger.error('Failed to get removal stats', { error });
    res.status(500).json({ error: 'Failed to get removal stats' });
  }
});

// QW-3: Enhanced Rule Validator
import { ruleValidatorService } from '../services/rule-validator-service.js';

analyticsRouter.post('/validate-post', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { subreddit, title, content, flair } = req.body;

    if (!subreddit || !title) {
      return res.status(400).json({ error: 'Missing required fields: subreddit, title' });
    }

    const validation = await ruleValidatorService.validatePost(
      userId,
      subreddit,
      title,
      content,
      flair
    );

    res.json(validation);
  } catch (error) {
    logger.error('Failed to validate post', { error });
    res.status(500).json({ error: 'Failed to validate post' });
  }
});

// MISSING-1: Comment Engagement Tracker
import { commentEngagementService } from '../services/comment-engagement-service.js';

analyticsRouter.get('/comment-engagement', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check tier access (Pro or Premium required)
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !['pro', 'premium'].includes(user.tier)) {
      return res.status(403).json({
        error: 'Comment engagement tracking requires Pro or Premium tier',
        requiredTier: 'pro'
      });
    }

    const daysBack = parseInt(req.query.daysBack as string) || 30;
    const limit = parseInt(req.query.limit as string) || 50;

    const metrics = await commentEngagementService.getEngagementMetrics(userId, daysBack, limit);

    res.json({ metrics });
  } catch (error) {
    logger.error('Failed to get comment engagement', { error });
    res.status(500).json({ error: 'Failed to get comment engagement' });
  }
});

analyticsRouter.get('/comment-engagement/stats', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check tier access (Pro or Premium required)
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !['pro', 'premium'].includes(user.tier)) {
      return res.status(403).json({
        error: 'Comment engagement statistics require Pro or Premium tier',
        requiredTier: 'pro'
      });
    }

    const daysBack = parseInt(req.query.daysBack as string) || 30;

    const stats = await commentEngagementService.getEngagementStats(userId, daysBack);

    res.json(stats);
  } catch (error) {
    logger.error('Failed to get comment engagement stats', { error });
    res.status(500).json({ error: 'Failed to get comment engagement stats' });
  }
});

// QW-4: Success Rate Dashboard Widget
analyticsRouter.get('/success-rate', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const daysBack = parseInt(req.query.daysBack as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.setDate() - daysBack);

    // Get current period stats
    const currentStats = await db
      .select({
        totalPosts: sql<number>`COUNT(*)::int`,
        successfulPosts: sql<number>`COUNT(CASE WHEN ${redditPostOutcomes.success} = true THEN 1 END)::int`,
      })
      .from(redditPostOutcomes)
      .where(
        and(
          eq(redditPostOutcomes.userId, userId),
          gte(redditPostOutcomes.occurredAt, startDate)
        )
      );

    const { totalPosts, successfulPosts } = currentStats[0] || { totalPosts: 0, successfulPosts: 0 };
    const successRate = totalPosts > 0 ? (successfulPosts / totalPosts) * 100 : 0;

    // Get previous period for trend
    const previousStart = new Date();
    previousStart.setDate(previousStart.getDate() - (daysBack * 2));
    const previousEnd = new Date();
    previousEnd.setDate(previousEnd.getDate() - daysBack);

    const previousStats = await db
      .select({
        totalPosts: sql<number>`COUNT(*)::int`,
        successfulPosts: sql<number>`COUNT(CASE WHEN ${redditPostOutcomes.success} = true THEN 1 END)::int`,
      })
      .from(redditPostOutcomes)
      .where(
        and(
          eq(redditPostOutcomes.userId, userId),
          gte(redditPostOutcomes.occurredAt, previousStart),
          sql`${redditPostOutcomes.occurredAt} < ${previousEnd}`
        )
      );

    const previousTotal = previousStats[0]?.totalPosts || 0;
    const previousSuccessful = previousStats[0]?.successfulPosts || 0;
    const previousRate = previousTotal > 0 ? (previousSuccessful / previousTotal) * 100 : 0;

    const trend = previousRate > 0 ? Math.round(((successRate - previousRate) / previousRate) * 100) : 0;

    res.json({
      successRate: Math.round(successRate * 10) / 10,
      totalPosts,
      successfulPosts,
      trend,
    });
  } catch (error) {
    logger.error('Failed to get success rate', { error });
    res.status(500).json({ error: 'Failed to get success rate' });
  }
});

// QW-9: Engagement Heatmap
import { heatmapService } from '../services/heatmap-service.js';

analyticsRouter.get('/engagement-heatmap', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check tier access (Pro or Premium required)
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !['pro', 'premium'].includes(user.tier)) {
      return res.status(403).json({
        error: 'Engagement heatmap requires Pro or Premium tier',
        requiredTier: 'pro'
      });
    }

    const subreddit = req.query.subreddit as string | undefined;
    const daysBack = parseInt(req.query.daysBack as string) || 90;

    const heatmap = await heatmapService.generateHeatmap(userId, subreddit, daysBack);

    res.json({ heatmap });
  } catch (error) {
    logger.error('Failed to get engagement heatmap', { error });
    res.status(500).json({ error: 'Failed to get engagement heatmap' });
  }
});

analyticsRouter.get('/best-posting-times', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check tier access (Pro or Premium required)
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !['pro', 'premium'].includes(user.tier)) {
      return res.status(403).json({
        error: 'Best posting times require Pro or Premium tier',
        requiredTier: 'pro'
      });
    }

    const subreddit = req.query.subreddit as string | undefined;
    const daysBack = parseInt(req.query.daysBack as string) || 90;

    const bestTimes = await heatmapService.getBestTimes(userId, subreddit, daysBack);

    res.json({ bestTimes });
  } catch (error) {
    logger.error('Failed to get best posting times', { error });
    res.status(500).json({ error: 'Failed to get best posting times' });
  }
});
