import { db } from '../db.js';
import { postMetrics, trendingTopics } from '@shared/schema';
import { eq, gte, desc, and, sql } from 'drizzle-orm';
import { logger } from '../bootstrap/logger.js';
import { formatLogArgs } from '../lib/logger-utils.js';

// Customize stop words for NSFW: Include generic + common promo fillers to reduce noise (e.g., "DM", "OC")
const stopWords = new Set<string>([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can',
  // NSFW promo filters (allow short slang like "bdsm" but block fillers)
  'hot', 'new', 'just', 'dm', 'oc', 'f', 'm', 'nsfw', 'ama', 'ask', 'pic', 'pics', 'photo', 'image', 'tease', 'custom'
]);

const HASHTAG_REGEX = /#\w+/g;
const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/ug;

interface TrendingKeyword {
  topic: string;
  score: number;
}

interface PostingTimeInsight {
  hour: number;
  avgScore: number;
  postCount: number;
  uplift: number;
}

interface TitlePatternStats {
  count: number;
  avgScore: number;
  total: number;
}

interface TitlePatterns {
  questions: TitlePatternStats;
  statements: TitlePatternStats;
  short: TitlePatternStats;
  medium: TitlePatternStats;
  long: TitlePatternStats;
}

interface ContentPatterns {
  byContentType: Array<{ contentType: string | null; avgScore: number | null; count: number }>;
  titlePatterns: TitlePatterns;
  engagementTrend: Array<{ week: string; avgScore: number | null; totalPosts: number }>;
}

export class TrendDetectionService {
  /**
   * Detect trending topics in a subreddit
   */
  async detectTrendingTopics(subreddit: string, hours = 24): Promise<TrendingKeyword[]> {
    try {
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

      const recentPosts = await db
        .select({
          title: postMetrics.title,
          score: postMetrics.score,
          comments: postMetrics.comments
        })
        .from(postMetrics)
        .where(and(
          eq(postMetrics.subreddit, subreddit),
          gte(postMetrics.postedAt, cutoff),
          gte(postMetrics.score, 5),
          eq(postMetrics.nsfwFlagged, true)
        ))
        .orderBy(desc(postMetrics.score))
        .limit(100);

      if (recentPosts.length === 0) {
        return [];
      }

      const keywords = new Map<string, number>();

      for (const post of recentPosts) {
        const title = (post.title ?? '').toLowerCase();
        const sanitized = title
          .replace(/[^\w\s#😀🔥💋]/g, ' ')
          .replace(EMOJI_REGEX, ' emoji ')
          .split(/\s+/)
          .filter(word =>
            word.length > 2 &&
            !stopWords.has(word) &&
            !word.startsWith('http')
          );

        const hashtags = (post.title ?? '').match(HASHTAG_REGEX) ?? [];
        const normalizedHashtags = hashtags.map(tag => tag.slice(1).toLowerCase()).filter(tag => tag.length > 0);

        const emojiCount = ((post.title ?? '').match(EMOJI_REGEX) ?? []).length;
        const emojiToken = `emoji_${emojiCount}`;

        const words = [...sanitized, ...normalizedHashtags, emojiToken];
        const weightedScore = (post.score ?? 0) + ((post.comments ?? 0) * 0.1);

        for (const word of words) {
          if (word.length === 0) {
            continue;
          }

          const current = keywords.get(word) ?? 0;
          keywords.set(word, current + weightedScore);
        }
      }

      if (keywords.size === 0) {
        return [];
      }

      const recencyBoost = hours > 0 ? 24 / hours : 1;

      const trending = Array.from(keywords.entries())
        .map(([topic, score]) => ({
          topic,
          score: score * recencyBoost
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      for (const { topic, score } of trending) {
        await db.insert(trendingTopics).values({
          subreddit,
          topic,
          mentions: 1,
          trendScore: score,
          detectedAt: new Date()
        }).onConflictDoUpdate({
          target: [trendingTopics.subreddit, trendingTopics.topic],
          set: {
            mentions: sql`COALESCE(${trendingTopics.mentions}, 0) + 1`,
            trendScore: sql`GREATEST(${trendingTopics.trendScore}, ${score})`,
            detectedAt: new Date()
          }
        });
      }

      return trending;
    } catch (error) {
      logger.error(...formatLogArgs('Error detecting trends', { subreddit, errorMessage: (error as Error).message }));
      return [];
    }
  }

  /**
   * Get optimal posting times for a subreddit
   */
  async getOptimalPostingTimes(subreddit: string): Promise<PostingTimeInsight[]> {
    try {
      const stats = await db
        .select({
          hour: sql<number>`EXTRACT(HOUR FROM ${postMetrics.postedAt})::integer`,
          avgScore: sql<number>`AVG(${postMetrics.score})`,
          postCount: sql<number>`COUNT(*)`
        })
        .from(postMetrics)
        .where(and(
          eq(postMetrics.subreddit, subreddit),
          gte(postMetrics.postedAt, sql`NOW() - INTERVAL '90 days'`),
          eq(postMetrics.nsfwFlagged, true)
        ))
        .groupBy(sql`EXTRACT(HOUR FROM ${postMetrics.postedAt})`)
        .having(sql`COUNT(*) >= 5`)
        .orderBy(desc(sql`AVG(${postMetrics.score})`));

      if (stats.length === 0) {
        return [];
      }

      const overallAvg = stats.reduce((sum, stat) => sum + (stat.avgScore ?? 0), 0) / (stats.length || 1);

      return stats.slice(0, 5).map(stat => {
        const uplift = (stat.avgScore ?? 0) > 0 && overallAvg > 0
          ? (((stat.avgScore ?? 0) / overallAvg - 1) * 100)
          : 0;

        return {
          hour: stat.hour ?? 0,
          avgScore: stat.avgScore ?? 0,
          postCount: stat.postCount ?? 0,
          uplift
        };
      });
    } catch (error) {
      logger.error(...formatLogArgs('Error getting optimal times', { subreddit, errorMessage: (error as Error).message }));
      return [];
    }
  }

  /**
   * Analyze content performance patterns
   */
  async analyzeContentPatterns(userId: number): Promise<ContentPatterns | null> {
    try {
      const byType = await db
        .select({
          contentType: postMetrics.contentType,
          avgScore: sql<number>`AVG(${postMetrics.score})`,
          count: sql<number>`COUNT(*)`
        })
        .from(postMetrics)
        .where(and(
          eq(postMetrics.userId, userId),
          eq(postMetrics.nsfwFlagged, true)
        ))
        .groupBy(postMetrics.contentType);

      const titlePatterns = await this.analyzeTitlePatterns(userId);

      const engagementTrend = await db
        .select({
          week: sql<string>`DATE_TRUNC('week', ${postMetrics.postedAt})`,
          avgScore: sql<number>`AVG(${postMetrics.score})`,
          totalPosts: sql<number>`COUNT(*)`
        })
        .from(postMetrics)
        .where(and(
          eq(postMetrics.userId, userId),
          gte(postMetrics.postedAt, sql`NOW() - INTERVAL '90 days'`),
          eq(postMetrics.nsfwFlagged, true)
        ))
        .groupBy(sql`DATE_TRUNC('week', ${postMetrics.postedAt})`)
        .orderBy(sql`DATE_TRUNC('week', ${postMetrics.postedAt})`);

      return {
        byContentType: byType,
        titlePatterns,
        engagementTrend
      };
    } catch (error) {
      logger.error(...formatLogArgs('Error analyzing patterns', { userId, errorMessage: (error as Error).message }));
      return null;
    }
  }

  /**
   * Analyze title patterns (questions vs statements, length, etc.)
   */
  private async analyzeTitlePatterns(userId: number): Promise<TitlePatterns> {
    const posts = await db
      .select({
        title: postMetrics.title,
        score: postMetrics.score
      })
      .from(postMetrics)
      .where(and(
        eq(postMetrics.userId, userId),
        eq(postMetrics.nsfwFlagged, true)
      ));

    const patterns: TitlePatterns = {
      questions: { count: 0, avgScore: 0, total: 0 },
      statements: { count: 0, avgScore: 0, total: 0 },
      short: { count: 0, avgScore: 0, total: 0 },
      medium: { count: 0, avgScore: 0, total: 0 },
      long: { count: 0, avgScore: 0, total: 0 }
    };

    for (const post of posts) {
      const title = post.title ?? '';
      const score = post.score ?? 0;
      const normalizedTitle = title.toLowerCase();

      if (normalizedTitle.includes('?') || normalizedTitle.includes('who') || normalizedTitle.includes('what')) {
        patterns.questions.count += 1;
        patterns.questions.total += score;
      } else {
        patterns.statements.count += 1;
        patterns.statements.total += score;
      }

      const length = title.length;
      if (length < 50) {
        patterns.short.count += 1;
        patterns.short.total += score;
      } else if (length < 100) {
        patterns.medium.count += 1;
        patterns.medium.total += score;
      } else {
        patterns.long.count += 1;
        patterns.long.total += score;
      }
    }

    for (const pattern of Object.values(patterns)) {
      pattern.avgScore = pattern.count > 0 ? pattern.total / pattern.count : 0;
    }

    return patterns;
  }

  /**
   * Generate content suggestions for user
   */
  async generateContentSuggestions(userId: number): Promise<Array<{ type: string; suggestion: string; priority: 'high' | 'medium' | 'low' }>> {
    try {
      const patterns = await this.analyzeContentPatterns(userId);
      if (!patterns) {
        return [];
      }

      const suggestions: Array<{ type: string; suggestion: string; priority: 'high' | 'medium' | 'low' }> = [];

      const sortedByType = [...patterns.byContentType].sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));
      const bestType = sortedByType[0];

      if (bestType && (bestType.avgScore ?? 0) > 0 && bestType.contentType) {
        suggestions.push({
          type: 'content_type',
          suggestion: `Focus on ${bestType.contentType} content (avg score: ${(bestType.avgScore ?? 0).toFixed(1)})`,
          priority: 'high'
        });
      }

      const { short, medium, long } = patterns.titlePatterns;
      const lengthOptions = [
        { name: 'short', stats: short },
        { name: 'medium', stats: medium },
        { name: 'long', stats: long }
      ].sort((a, b) => (b.stats.avgScore ?? 0) - (a.stats.avgScore ?? 0));

      const bestLength = lengthOptions[0];
      if (bestLength.stats.count > 0) {
        const range = bestLength.name === 'short' ? '<50' : bestLength.name === 'medium' ? '50-100' : '>100';
        suggestions.push({
          type: 'title_length',
          suggestion: `Use ${bestLength.name} titles (${range} chars) for best engagement`,
          priority: 'medium'
        });
      }

      const { questions, statements } = patterns.titlePatterns;
      if (questions.count > 0 && statements.count > 0 && questions.avgScore > statements.avgScore && statements.avgScore > 0) {
        const uplift = ((questions.avgScore / statements.avgScore) - 1) * 100;
        suggestions.push({
          type: 'title_style',
          suggestion: `Questions perform better than statements for your content (+${uplift.toFixed(0)}% uplift)`,
          priority: 'medium'
        });
      }

      return suggestions;
    } catch (error) {
      logger.error(...formatLogArgs('Error generating suggestions', { userId, errorMessage: (error as Error).message }));
      return [];
    }
  }
}

export const trendDetection = new TrendDetectionService();
