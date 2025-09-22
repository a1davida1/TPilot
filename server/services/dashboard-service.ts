import { db } from '../db';
import {
  contentGenerations,
  expenses,
  contentFlags,
  mediaAssets,
  socialMetrics,
  engagementEvents,
  users
} from '@shared/schema';
import { eq, and, gte, sql, desc } from 'drizzle-orm';
import { MediaManager } from '../lib/media.js';

export interface DashboardStats {
  postsToday: number;
  engagementRate: number;
  takedownsFound: number;
  estimatedTaxSavings: number;
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

    // Posts created today
    const postsToday = await this.getPostsToday(userId, today);
    
    // Engagement rate from social metrics or events
    const engagementRate = await this.getEngagementRate(userId);
    
    // Content flags/takedowns found
    const takedownsFound = await this.getTakedownsFound(userId);
    
    // Estimated tax savings from expenses
    const estimatedTaxSavings = await this.getEstimatedTaxSavings(userId);

    return {
      postsToday,
      engagementRate,
      takedownsFound,
      estimatedTaxSavings,
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
      console.error('Error getting posts today:', error);
      return 0;
    }
  }

  private async getEngagementRate(userId: number): Promise<number> {
    try {
      // Try to get engagement from social metrics first - join with contentGenerations to get user data
      const socialMetricsResult = await db
        .select({ 
          totalEngagement: sql<number>`sum(${socialMetrics.likes} + ${socialMetrics.comments} + ${socialMetrics.shares})`,
          totalViews: sql<number>`sum(${socialMetrics.views})`
        })
        .from(socialMetrics)
        .leftJoin(contentGenerations, eq(socialMetrics.contentId, contentGenerations.id))
        .where(eq(contentGenerations.userId, userId));

      const engagement = Number(socialMetricsResult[0]?.totalEngagement ?? 0);
      const views = Number(socialMetricsResult[0]?.totalViews ?? 0);

      if (views > 0) {
        return Math.round((engagement / views) * 100 * 10) / 10; // Round to 1 decimal place
      }

      // Fallback to engagement events if no social metrics
      const engagementResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(engagementEvents)
        .where(eq(engagementEvents.userId, userId));

      const eventCount = Number(engagementResult[0]?.count ?? 0);
      
      // Return a calculated engagement rate based on content generations vs events
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
      console.error('Error getting engagement rate:', error);
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
      console.error('Error getting takedowns found:', error);
      return 0;
    }
  }

  private async getEstimatedTaxSavings(userId: number): Promise<number> {
    try {
      const currentYear = new Date().getFullYear();
      
      const result = await db
        .select({ 
          totalDeductions: sql<number>`sum(${expenses.amount} * ${expenses.deductionPercentage} / 100.0)` 
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
      console.error('Error getting estimated tax savings:', error);
      return 0;
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
      console.error('Error getting recent media:', error);
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
          console.error('Error building media preview item:', error);
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
          totalEngagement: sql<number>`sum(${socialMetrics.likes} + ${socialMetrics.comments} + ${socialMetrics.shares})`,
          totalViews: sql<number>`sum(${socialMetrics.views})`
        })
        .from(socialMetrics);

      // Total takedowns/flags found
      const takedownsResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(contentFlags);

      // Total platform tax savings
      const taxSavingsResult = await db
        .select({ 
          totalDeductions: sql<number>`sum(${expenses.amount} * ${expenses.deductionPercentage} / 100.0)` 
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
      console.error('Error getting admin dashboard stats:', error);
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
      console.error('Error getting admin dashboard activity:', error);
      return { recentMedia: [] };
    }
  }
}

export const dashboardService = new DashboardService();