/**
 * Level 2 Reddit Intelligence Routes
 * Real-time hot posts analysis and community health tracking using snoowrap
 */

import { Router, type Response } from 'express';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { logger } from '../bootstrap/logger.js';
import { RedditManager } from '../lib/reddit.js';
import { db } from '../db.js';
import { redditCommunities } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

interface HotPost {
  id: string;
  title: string;
  score: number;
  numComments: number;
  author: string;
  createdUtc: number;
  url: string;
  permalink: string;
}

interface TitlePattern {
  hasQuestion: boolean;
  hasEmoji: boolean;
  emojiCount: number;
  length: number;
  startsWithCapital: boolean;
  hasNumbers: boolean;
}

interface HotPostsAnalysis {
  subreddit: string;
  sampleSize: number;
  fetchedAt: string;
  topPosts: HotPost[];
  patterns: {
    avgTitleLength: number;
    questionTitlePercentage: number;
    emojiUsagePercentage: number;
    avgEmojiCount: number;
    avgScore: number;
    avgComments: number;
    topKeywords: Array<{ word: string; count: number; avgScore: number }>;
    bestPerformingPattern: string;
  };
  insights: string[];
}

interface CommunityHealth {
  subreddit: string;
  fetchedAt: string;
  metrics: {
    subscribers: number;
    activeUsers: number;
    activeUserPercentage: number;
    postsPerDay: number;
    avgEngagementRate: number;
  };
  health: {
    score: number; // 0-100
    status: 'thriving' | 'healthy' | 'declining' | 'dying';
    trend: 'growing' | 'stable' | 'shrinking';
  };
  moderators: {
    count: number;
    names: string[];
  };
  recommendations: string[];
}

/**
 * Analyze title for patterns
 */
function analyzeTitlePattern(title: string): TitlePattern {
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
  const emojis = title.match(emojiRegex) || [];

  return {
    hasQuestion: title.includes('?'),
    hasEmoji: emojis.length > 0,
    emojiCount: emojis.length,
    length: title.length,
    startsWithCapital: /^[A-Z]/.test(title),
    hasNumbers: /\d/.test(title),
  };
}

/**
 * Extract keywords from titles (simple word frequency)
 */
function extractKeywords(titles: Array<{ title: string; score: number }>): Array<{ word: string; count: number; avgScore: number }> {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'us', 'them']);

  const wordScores: Record<string, { count: number; totalScore: number }> = {};

  titles.forEach(({ title, score }) => {
    const words = title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));

    words.forEach(word => {
      if (!wordScores[word]) {
        wordScores[word] = { count: 0, totalScore: 0 };
      }
      wordScores[word].count++;
      wordScores[word].totalScore += score;
    });
  });

  return Object.entries(wordScores)
    .map(([word, data]) => ({
      word,
      count: data.count,
      avgScore: Math.round(data.totalScore / data.count),
    }))
    .filter(item => item.count >= 2) // Must appear at least twice
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 10);
}

/**
 * GET /api/intelligence-level2/hot-posts/:subreddit
 * Analyze hot posts in a subreddit to identify current trends
 */
router.get('/hot-posts/:subreddit', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { subreddit } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check tier (Pro+ required)
    const userTier = req.user?.tier;
    if (userTier !== 'pro' && userTier !== 'premium') {
      return res.status(403).json({
        error: 'Pro tier or higher required for Level 2 intelligence features',
        requiredTier: 'pro'
      });
    }

    logger.info('Fetching hot posts analysis', { userId, subreddit });

    // Get Reddit client
    const redditManager = await RedditManager.forUser(userId);
    if (!redditManager) {
      return res.status(403).json({ error: 'Reddit account not connected' });
    }

    // Fetch hot posts
    const reddit = (redditManager as any).reddit;
    const hotPosts = await reddit.getSubreddit(subreddit).getHot({ limit: 50 });

    // Convert to our format
    const posts: HotPost[] = hotPosts.map((post: any) => ({
      id: post.id,
      title: post.title,
      score: post.score,
      numComments: post.num_comments,
      author: post.author.name,
      createdUtc: post.created_utc,
      url: post.url,
      permalink: post.permalink,
    }));

    // Analyze patterns
    const patterns = posts.map(post => ({
      ...analyzeTitlePattern(post.title),
      score: post.score,
    }));

    const questionTitles = patterns.filter(p => p.hasQuestion);
    const emojiTitles = patterns.filter(p => p.hasEmoji);

    const avgTitleLength = Math.round(
      patterns.reduce((sum, p) => sum + p.length, 0) / patterns.length
    );

    const avgScore = Math.round(
      posts.reduce((sum, p) => sum + p.score, 0) / posts.length
    );

    const avgComments = Math.round(
      posts.reduce((sum, p) => sum + p.numComments, 0) / posts.length
    );

    const avgEmojiCount = emojiTitles.length > 0
      ? emojiTitles.reduce((sum, p) => sum + p.emojiCount, 0) / emojiTitles.length
      : 0;

    // Extract keywords
    const keywords = extractKeywords(
      posts.map(p => ({ title: p.title, score: p.score }))
    );

    // Determine best performing pattern
    const questionAvgScore = questionTitles.length > 0
      ? questionTitles.reduce((sum, p) => sum + p.score, 0) / questionTitles.length
      : 0;

    const emojiAvgScore = emojiTitles.length > 0
      ? emojiTitles.reduce((sum, p) => sum + p.score, 0) / emojiTitles.length
      : 0;

    const nonQuestionAvgScore = patterns.filter(p => !p.hasQuestion).length > 0
      ? patterns.filter(p => !p.hasQuestion).reduce((sum, p) => sum + p.score, 0) / patterns.filter(p => !p.hasQuestion).length
      : 0;

    let bestPattern = 'statement titles';
    let bestScore = nonQuestionAvgScore;

    if (questionAvgScore > bestScore) {
      bestPattern = 'question titles';
      bestScore = questionAvgScore;
    }

    if (emojiAvgScore > bestScore) {
      bestPattern = 'titles with emojis';
      bestScore = emojiAvgScore;
    }

    // Generate insights
    const insights: string[] = [];

    if (questionTitles.length / patterns.length > 0.4) {
      insights.push(`Questions are trending: ${Math.round(questionTitles.length / patterns.length * 100)}% of hot posts use questions`);
    }

    if (emojiTitles.length / patterns.length > 0.5) {
      insights.push(`Emojis are popular: ${Math.round(emojiTitles.length / patterns.length * 100)}% of hot posts use emojis`);
    }

    if (avgTitleLength < 40) {
      insights.push(`Short titles perform well: average ${avgTitleLength} characters`);
    } else if (avgTitleLength > 70) {
      insights.push(`Longer titles trending: average ${avgTitleLength} characters`);
    }

    if (keywords.length > 0) {
      insights.push(`Top keyword "${keywords[0].word}" appears in high-scoring posts (avg ${keywords[0].avgScore} upvotes)`);
    }

    const analysis: HotPostsAnalysis = {
      subreddit,
      sampleSize: posts.length,
      fetchedAt: new Date().toISOString(),
      topPosts: posts.slice(0, 10),
      patterns: {
        avgTitleLength,
        questionTitlePercentage: Math.round((questionTitles.length / patterns.length) * 100),
        emojiUsagePercentage: Math.round((emojiTitles.length / patterns.length) * 100),
        avgEmojiCount: Math.round(avgEmojiCount * 10) / 10,
        avgScore,
        avgComments,
        topKeywords: keywords,
        bestPerformingPattern: bestPattern,
      },
      insights,
    };

    return res.json(analysis);

  } catch (error) {
    logger.error('Error analyzing hot posts', {
      error: error instanceof Error ? error.message : String(error),
      subreddit: req.params.subreddit,
    });
    return res.status(500).json({ error: 'Failed to analyze hot posts' });
  }
});

/**
 * GET /api/intelligence-level2/community-health/:subreddit
 * Analyze community health metrics
 */
router.get('/community-health/:subreddit', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { subreddit } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check tier (Pro+ required)
    const userTier = req.user?.tier;
    if (userTier !== 'pro' && userTier !== 'premium') {
      return res.status(403).json({
        error: 'Pro tier or higher required for Level 2 intelligence features',
        requiredTier: 'pro'
      });
    }

    logger.info('Fetching community health', { userId, subreddit });

    // Get Reddit client
    const redditManager = await RedditManager.forUser(userId);
    if (!redditManager) {
      return res.status(403).json({ error: 'Reddit account not connected' });
    }

    // Fetch subreddit info
    const reddit = (redditManager as any).reddit;
    const subredditInfo = await reddit.getSubreddit(subreddit).fetch();

    // Fetch moderators
    const moderators = await reddit.getSubreddit(subreddit).getModerators();

    // Calculate metrics
    const subscribers = subredditInfo.subscribers || 0;
    const activeUsers = subredditInfo.active_user_count || subredditInfo.accounts_active || 0;
    const activeUserPercentage = subscribers > 0 ? (activeUsers / subscribers) * 100 : 0;

    // Estimate posts per day based on recent activity
    const newPosts = await reddit.getSubreddit(subreddit).getNew({ limit: 100 });
    const oldestPost = newPosts[newPosts.length - 1];
    const newestPost = newPosts[0];

    const timeSpanHours = oldestPost && newestPost
      ? (newestPost.created_utc - oldestPost.created_utc) / 3600
      : 24;

    const postsPerDay = timeSpanHours > 0
      ? Math.round((newPosts.length / timeSpanHours) * 24)
      : 0;

    // Calculate average engagement rate (score per subscriber)
    const avgScore = newPosts.reduce((sum: number, post: any) => sum + post.score, 0) / newPosts.length;
    const avgEngagementRate = subscribers > 0 ? (avgScore / subscribers) * 100 : 0;

    // Calculate health score (0-100)
    let healthScore = 0;

    // Active user ratio (0-40 points)
    if (activeUserPercentage > 1) healthScore += 40;
    else if (activeUserPercentage > 0.5) healthScore += 30;
    else if (activeUserPercentage > 0.2) healthScore += 20;
    else if (activeUserPercentage > 0.1) healthScore += 10;

    // Posts per day (0-30 points)
    if (postsPerDay > 100) healthScore += 30;
    else if (postsPerDay > 50) healthScore += 25;
    else if (postsPerDay > 20) healthScore += 20;
    else if (postsPerDay > 5) healthScore += 15;
    else if (postsPerDay > 1) healthScore += 10;

    // Engagement rate (0-30 points)
    if (avgEngagementRate > 0.1) healthScore += 30;
    else if (avgEngagementRate > 0.05) healthScore += 20;
    else if (avgEngagementRate > 0.01) healthScore += 10;

    // Determine status
    let status: 'thriving' | 'healthy' | 'declining' | 'dying';
    if (healthScore >= 80) status = 'thriving';
    else if (healthScore >= 60) status = 'healthy';
    else if (healthScore >= 40) status = 'declining';
    else status = 'dying';

    // Check for growth trend from our database
    const dbCommunity = await db
      .select()
      .from(redditCommunities)
      .where(eq(redditCommunities.id, subreddit))
      .limit(1);

    let trend: 'growing' | 'stable' | 'shrinking' = 'stable';

    if (dbCommunity.length > 0) {
      const storedMembers = dbCommunity[0].members;
      if (subscribers > storedMembers * 1.05) trend = 'growing';
      else if (subscribers < storedMembers * 0.95) trend = 'shrinking';

      // Update our database with latest count
      await db
        .update(redditCommunities)
        .set({ members: subscribers })
        .where(eq(redditCommunities.id, subreddit));
    }

    // Generate recommendations
    const recommendations: string[] = [];

    if (activeUserPercentage < 0.1) {
      recommendations.push('Low engagement: Consider posting when more users are active');
    }

    if (postsPerDay < 5) {
      recommendations.push('Low posting activity: Less competition but smaller audience reach');
    } else if (postsPerDay > 200) {
      recommendations.push('Very high posting volume: Your content may get buried quickly');
    }

    if (status === 'declining' || status === 'dying') {
      recommendations.push('Community health declining: Consider diversifying to other subreddits');
    }

    if (trend === 'shrinking') {
      recommendations.push('Subscriber count dropping: Early warning of community decline');
    } else if (trend === 'growing') {
      recommendations.push('Growing community: Good opportunity to establish presence');
    }

    if (moderators.length < 3 && subscribers > 100000) {
      recommendations.push('Small mod team for large community: Slower rule enforcement possible');
    } else if (moderators.length > 10 && subscribers < 50000) {
      recommendations.push('Large mod team: Strict moderation likely, follow rules carefully');
    }

    const health: CommunityHealth = {
      subreddit,
      fetchedAt: new Date().toISOString(),
      metrics: {
        subscribers,
        activeUsers,
        activeUserPercentage: Math.round(activeUserPercentage * 100) / 100,
        postsPerDay,
        avgEngagementRate: Math.round(avgEngagementRate * 10000) / 10000,
      },
      health: {
        score: healthScore,
        status,
        trend,
      },
      moderators: {
        count: moderators.length,
        names: moderators.slice(0, 5).map((mod: any) => mod.name),
      },
      recommendations,
    };

    return res.json(health);

  } catch (error) {
    logger.error('Error analyzing community health', {
      error: error instanceof Error ? error.message : String(error),
      subreddit: req.params.subreddit,
    });
    return res.status(500).json({ error: 'Failed to analyze community health' });
  }
});

export default router;
