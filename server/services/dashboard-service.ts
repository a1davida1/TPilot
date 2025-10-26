import { db } from '../database.js';
import {
  contentGenerations,
  expenses,
  contentFlags,
  mediaAssets,
  socialMetrics,
  engagementEvents,
  pageViews,
  userSessions
} from '@shared/schema';
import { eq, and, gte, sql, desc } from 'drizzle-orm';
import { MediaManager } from '../lib/media.js';
import { logger } from '../bootstrap/logger.js';

export interface DashboardStats {
  postsToday: number;
  engagementRate: number;
  takedownsFound: number;
  estimatedTaxSavings: number;
  // Enhanced analytics metrics
  sessionCount?: number;
  averageSessionDuration?: number;
  pageViewsToday?: number;
  interactionsToday?: number;
}

export interface DashboardMediaItem {
  id: number;
  url: string;
  signedUrl: string | null;
  alt: string;
  createdAt: string | null;
}

export interface DashboardActivity {
  recentMedia: Array<DashboardMediaItem>;
}

export class DashboardService {
  /**
   * Get aggregated dashboard statistics for a user
   */
  async getDashboardStats(userId: number): Promise<DashboardStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Core metrics
    const postsToday = await this.getPostsToday(userId, today);
    const engagementRate = await this.getEngagementRate(userId);
    const takedownsFound = await this.getTakedownsFound(userId);
    const estimatedTaxSavings = await this.getEstimatedTaxSavings(userId);
    
    // Enhanced analytics metrics
    const analyticsMetrics = await this.getAnalyticsMetrics(userId, today);

    return {
      postsToday,
      engagementRate,
      takedownsFound,
      estimatedTaxSavings,
      ...analyticsMetrics,
    };
  }

  /**
   * Get recent media activity for a user
   */
  async getDashboardActivity(userId: number): Promise<DashboardActivity> {
    const recentMedia = await this.getRecentMedia(userId);
    
    return {
      recentMedia,
    };
  }

  private async getPostsToday(userId: number, today: Date): Promise<number> {
    try {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(contentGenerations)
        .where(
          and(
            eq(contentGenerations.userId, userId),
            gte(contentGenerations.createdAt, today)
          )
        );
      
      return Number(result[0]?.count ?? 0);
    } catch (error) {
      logger.error('Error getting posts today:', error);
      return 0;
    }
  }

  private async getEngagementRate(userId: number): Promise<number> {
    try {
      // Try to get engagement from social metrics first - join with contentGenerations to get user data
      const socialMetricsResult = await db
        .select({ 
          totalEngagement: sql<number>`COALESCE(sum(${socialMetrics.likes} + ${socialMetrics.comments} + ${socialMetrics.shares}), 0)`,
          totalViews: sql<number>`COALESCE(sum(${socialMetrics.views}), 0)`
        })
        .from(socialMetrics)
        .leftJoin(contentGenerations, eq(socialMetrics.contentId, contentGenerations.id))
        .where(eq(contentGenerations.userId, userId));

      const engagement = Number(socialMetricsResult[0]?.totalEngagement ?? 0);
      const views = Number(socialMetricsResult[0]?.totalViews ?? 0);

      if (views > 0) {
        return Math.round((engagement / views) * 100 * 10) / 10; // Round to 1 decimal place
      }

      // Enhanced fallback using real analytics data - get recent engagement events vs page views
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const [engagementResult, pageViewResult] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)` })
          .from(engagementEvents)
          .where(
            and(
              eq(engagementEvents.userId, userId),
              gte(engagementEvents.createdAt, sevenDaysAgo)
            )
          ),
        db
          .select({ count: sql<number>`count(*)` })
          .from(pageViews)
          .where(
            and(
              eq(pageViews.userId, userId),
              gte(pageViews.createdAt, sevenDaysAgo)
            )
          )
      ]);

      const eventCount = Number(engagementResult[0]?.count ?? 0);
      const pageViewCount = Number(pageViewResult[0]?.count ?? 0);
      
      // Calculate engagement rate as (interactions / page views) * 100 for last 7 days
      if (pageViewCount > 0) {
        return Math.round((eventCount / pageViewCount) * 100 * 10) / 10;
      }

      // Final fallback to content generations vs events if no page views
      const contentCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(contentGenerations)
        .where(eq(contentGenerations.userId, userId));

      const totalContent = Number(contentCount[0]?.count ?? 0);
      
      if (totalContent > 0) {
        return Math.round((eventCount / totalContent) * 100 * 10) / 10;
      }

      return 0;
    } catch (error) {
      logger.error('Error getting engagement rate:', error);
      return 0;
    }
  }

  private async getTakedownsFound(userId: number): Promise<number> {
    try {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(contentFlags)
        .where(eq(contentFlags.reportedById, userId));
      
      return Number(result[0]?.count ?? 0);
    } catch (error) {
      logger.error('Error getting takedowns found:', error);
      return 0;
    }
  }

  private async getEstimatedTaxSavings(userId: number): Promise<number> {
    try {
      const currentYear = new Date().getFullYear();
      
      const result = await db
        .select({ 
          totalDeductions: sql<number>`COALESCE(sum(${expenses.amount} * ${expenses.deductionPercentage} / 100.0), 0)` 
        })
        .from(expenses)
        .where(
          and(
            eq(expenses.userId, userId),
            eq(expenses.taxYear, currentYear)
          )
        );
      
      const totalDeductions = Number(result[0]?.totalDeductions ?? 0);
      
      // Estimate tax savings at 25% effective rate (conservative estimate)
      // Convert from cents to dollars
      return Math.round((totalDeductions / 100) * 0.25 * 100) / 100;
    } catch (error) {
      logger.error('Error getting estimated tax savings:', error);
      return 0;
    }
  }

  private async getAnalyticsMetrics(userId: number, today: Date) {
    try {
      const [sessionMetrics, pageViewMetrics, interactionMetrics] = await Promise.all([
        // Session data for today
        db
          .select({ 
            sessionCount: sql<number>`count(*)`,
            avgDuration: sql<number>`avg(${userSessions.duration})`
          })
          .from(userSessions)
          .where(
            and(
              eq(userSessions.userId, userId),
              gte(userSessions.startedAt, today)
            )
          ),
        
        // Page views for today
        db
          .select({ count: sql<number>`count(*)` })
          .from(pageViews)
          .where(
            and(
              eq(pageViews.userId, userId),
              gte(pageViews.createdAt, today)
            )
          ),
        
        // Total interactions/engagement events for today
        db
          .select({ count: sql<number>`count(*)` })
          .from(engagementEvents)
          .where(
            and(
              eq(engagementEvents.userId, userId),
              gte(engagementEvents.createdAt, today)
            )
          )
      ]);

      return {
        sessionCount: Number(sessionMetrics[0]?.sessionCount ?? 0),
        averageSessionDuration: Math.round(Number(sessionMetrics[0]?.avgDuration ?? 0) / 60), // Convert seconds to minutes
        pageViewsToday: Number(pageViewMetrics[0]?.count ?? 0),
        interactionsToday: Number(interactionMetrics[0]?.count ?? 0),
      };
    } catch (error) {
      logger.error('Error getting analytics metrics:', error);
      return {
        sessionCount: 0,
        averageSessionDuration: 0,
        pageViewsToday: 0,
        interactionsToday: 0,
      };
    }
  }

  private async getRecentMedia(userId: number): Promise<Array<DashboardMediaItem>> {
    try {
      const result = await db
        .select({
          id: mediaAssets.id,
          filename: mediaAssets.filename,
          key: mediaAssets.key,
          createdAt: mediaAssets.createdAt,
        })
        .from(mediaAssets)
        .where(eq(mediaAssets.userId, userId))
        .orderBy(desc(mediaAssets.createdAt))
        .limit(4);

      return this.buildActivityMediaItems(result, userId);
    } catch (error) {
      logger.error('Error getting recent media:', error);
      return [];
    }
  }

  private async buildActivityMediaItems(
    assets: Array<{
      id: number;
      filename: string | null;
      createdAt: Date | string | null;
    }>,
    viewerUserId?: number
  ): Promise<Array<DashboardMediaItem>> {
    const items = await Promise.all(
      assets.map(async (asset) => {
        try {
          const detailedAsset = await MediaManager.getAsset(asset.id, viewerUserId);
          if (!detailedAsset) {
            return null;
          }

          const directUrl =
            detailedAsset.signedUrl ??
            detailedAsset.downloadUrl ??
            `/api/media/${detailedAsset.id}/download`;

          const createdAtSource = detailedAsset.createdAt ?? asset.createdAt ?? null;
          let createdAtIso: string | null = null;
          if (createdAtSource instanceof Date) {
            createdAtIso = createdAtSource.toISOString();
          } else if (typeof createdAtSource === 'string') {
            const parsedDate = new Date(createdAtSource);
            if (!Number.isNaN(parsedDate.getTime())) {
              createdAtIso = parsedDate.toISOString();
            }
          }

          return {
            id: detailedAsset.id,
            url: directUrl,
            signedUrl: detailedAsset.signedUrl ?? null,
            alt: detailedAsset.filename || asset.filename || 'Media asset',
            createdAt: createdAtIso,
          } satisfies DashboardMediaItem;
        } catch (error) {
          logger.error('Error building media preview item:', error);
          return null;
        }
      })
    );

    return items.filter((item): item is DashboardMediaItem => Boolean(item));
  }

  /**
   * Get admin dashboard stats (aggregated across all users)
   */
  async getAdminDashboardStats(): Promise<DashboardStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      // Total posts today across all users
      const postsResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(contentGenerations)
        .where(gte(contentGenerations.createdAt, today));

      // Average engagement rate across all users
      const engagementResult = await db
        .select({ 
          totalEngagement: sql<number>`COALESCE(sum(${socialMetrics.likes} + ${socialMetrics.comments} + ${socialMetrics.shares}), 0)`,
          totalViews: sql<number>`COALESCE(sum(${socialMetrics.views}), 0)`
        })
        .from(socialMetrics);

      // Total takedowns/flags found
      const takedownsResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(contentFlags);

      // Total platform tax savings
      const taxSavingsResult = await db
        .select({ 
          totalDeductions: sql<number>`COALESCE(sum(${expenses.amount} * ${expenses.deductionPercentage} / 100.0), 0)` 
        })
        .from(expenses)
        .where(eq(expenses.taxYear, new Date().getFullYear()));

      const postsToday = Number(postsResult[0]?.count ?? 0);
      const totalEngagement = Number(engagementResult[0]?.totalEngagement ?? 0);
      const totalViews = Number(engagementResult[0]?.totalViews ?? 0);
      const takedownsFound = Number(takedownsResult[0]?.count ?? 0);
      const totalDeductions = Number(taxSavingsResult[0]?.totalDeductions ?? 0);

      const engagementRate = totalViews > 0 
        ? Math.round((totalEngagement / totalViews) * 100 * 10) / 10 
        : 0;

      const estimatedTaxSavings = Math.round((totalDeductions / 100) * 0.25 * 100) / 100;

      return {
        postsToday,
        engagementRate,
        takedownsFound,
        estimatedTaxSavings,
      };
    } catch (error) {
      logger.error('Error getting admin dashboard stats:', error);
      return {
        postsToday: 0,
        engagementRate: 0,
        takedownsFound: 0,
        estimatedTaxSavings: 0,
      };
    }
  }

  /**
   * Get admin dashboard activity (recent media across all users)
   */
  async getAdminDashboardActivity(): Promise<DashboardActivity> {
    try {
      const result = await db
        .select({
          id: mediaAssets.id,
          filename: mediaAssets.filename,
          key: mediaAssets.key,
          createdAt: mediaAssets.createdAt,
        })
        .from(mediaAssets)
        .orderBy(desc(mediaAssets.createdAt))
        .limit(8); // Show more for admin view

      return {
        recentMedia: await this.buildActivityMediaItems(result),
      };
    } catch (error) {
      logger.error('Error getting admin dashboard activity:', error);
      return { recentMedia: [] };
    }
  }
}

export const dashboardService = new DashboardService();