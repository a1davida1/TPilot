import { db } from "../db.js";
import { eventLogs } from "@shared/schema.js";
import { eq, and, gte, desc } from "drizzle-orm";

export interface PostingWindow {
  startHour: number; // 0-23
  endHour: number;   // 0-23
  timezone: string;
  confidence: number; // 0-1, based on historical data
}

export interface SubredditTiming {
  subreddit: string;
  windows: PostingWindow[];
  lastAnalyzed: Date;
}

// Default posting windows for different subreddit categories
const DEFAULT_WINDOWS: Record<string, PostingWindow[]> = {
  // General NSFW content - peak evening hours
  general: [
    { startHour: 19, endHour: 23, timezone: 'America/New_York', confidence: 0.7 },
    { startHour: 21, endHour: 1, timezone: 'America/Los_Angeles', confidence: 0.6 },
  ],
  
  // Work-day friendly (lunch/evening)
  workday: [
    { startHour: 12, endHour: 14, timezone: 'America/New_York', confidence: 0.5 },
    { startHour: 17, endHour: 22, timezone: 'America/New_York', confidence: 0.8 },
  ],
  
  // Weekend-focused
  weekend: [
    { startHour: 10, endHour: 16, timezone: 'America/New_York', confidence: 0.7 },
    { startHour: 20, endHour: 24, timezone: 'America/New_York', confidence: 0.8 },
  ],
  
  // International audience
  international: [
    { startHour: 14, endHour: 18, timezone: 'UTC', confidence: 0.6 },
    { startHour: 20, endHour: 24, timezone: 'UTC', confidence: 0.7 },
  ],
};

export class PostScheduler {
  
  static async chooseSendTime(
    subreddit: string, 
    timezone: string = 'America/New_York',
    dayPreference?: 'weekday' | 'weekend'
  ): Promise<Date> {
    const timing = await this.getSubredditTiming(subreddit);
    const now = new Date();
    
    // Choose best window based on confidence
    const bestWindow = timing.windows.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );
    
    // Calculate next optimal posting time
    const targetDate = new Date(now);
    
    // If day preference specified, adjust to next matching day
    if (dayPreference) {
      const currentDay = targetDate.getDay(); // 0 = Sunday
      const isWeekend = currentDay === 0 || currentDay === 6;
      
      if (dayPreference === 'weekend' && !isWeekend) {
        // Move to next Saturday
        const daysUntilSaturday = (6 - currentDay) % 7;
        targetDate.setDate(targetDate.getDate() + daysUntilSaturday);
      } else if (dayPreference === 'weekday' && isWeekend) {
        // Move to next Monday
        const daysUntilMonday = (8 - currentDay) % 7;
        targetDate.setDate(targetDate.getDate() + daysUntilMonday);
      }
    }
    
    // Set time within the optimal window
    const windowDuration = bestWindow.endHour - bestWindow.startHour;
    const randomOffset = Math.random() * windowDuration;
    const targetHour = Math.floor(bestWindow.startHour + randomOffset);
    const targetMinutes = Math.floor(Math.random() * 60);
    
    targetDate.setHours(targetHour, targetMinutes, 0, 0);
    
    // If the time has already passed today, move to tomorrow
    if (targetDate <= now) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    
    return targetDate;
  }
  
  static async getSubredditTiming(subreddit: string): Promise<SubredditTiming> {
    try {
      // Analyze historical engagement data for this subreddit
      const recentPosts = await db
        .select()
        .from(eventLogs)
        .where(
          and(
            eq(eventLogs.type, 'post.sent'),
            gte(eventLogs.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Last 30 days
          )
        )
        .orderBy(desc(eventLogs.createdAt))
        .limit(100);
      
      if (recentPosts.length < 10) {
        // Not enough data, use defaults based on subreddit name
        return this.getDefaultTiming(subreddit);
      }
      
      // Analyze posting times vs engagement
      const hourlyEngagement = this.analyzeEngagementByHour(recentPosts);
      const windows = this.generateOptimalWindows(hourlyEngagement);
      
      return {
        subreddit,
        windows,
        lastAnalyzed: new Date(),
      };
      
    } catch (error) {
      console.error(`Failed to analyze timing for r/${subreddit}:`, error);
      return this.getDefaultTiming(subreddit);
    }
  }
  
  private static getDefaultTiming(subreddit: string): SubredditTiming {
    const sub = subreddit.toLowerCase();
    
    let category = 'general';
    if (sub.includes('workday') || sub.includes('office')) category = 'workday';
    else if (sub.includes('weekend') || sub.includes('saturday') || sub.includes('sunday')) category = 'weekend';
    else if (sub.includes('eu') || sub.includes('uk') || sub.includes('international')) category = 'international';
    
    return {
      subreddit,
      windows: DEFAULT_WINDOWS[category] || DEFAULT_WINDOWS.general,
      lastAnalyzed: new Date(),
    };
  }
  
  private static analyzeEngagementByHour(
    posts: Array<{ meta?: { engagement?: { upvotes?: number; comments?: number } }; createdAt: Date | string }>
  ): Record<number, number> {
    const hourlyEngagement: Record<number, number> = {};
    
    for (let hour = 0; hour < 24; hour++) {
      hourlyEngagement[hour] = 0;
    }
    
    posts.forEach(post => {
      if (post.meta?.engagement) {
        const hour = new Date(post.createdAt).getHours();
        const engagement = (post.meta.engagement.upvotes || 0) + (post.meta.engagement.comments || 0) * 3;
        hourlyEngagement[hour] = (hourlyEngagement[hour] || 0) + engagement;
      }
    });
    
    return hourlyEngagement;
  }
  
  private static generateOptimalWindows(hourlyEngagement: Record<number, number>): PostingWindow[] {
    const windows: PostingWindow[] = [];
    const maxEngagement = Math.max(...Object.values(hourlyEngagement));
    
    // Find consecutive high-engagement hours
    let windowStart = -1;
    for (let hour = 0; hour < 24; hour++) {
      const engagement = hourlyEngagement[hour] || 0;
      const isHighEngagement = engagement > maxEngagement * 0.6;
      
      if (isHighEngagement && windowStart === -1) {
        windowStart = hour;
      } else if (!isHighEngagement && windowStart !== -1) {
        windows.push({
          startHour: windowStart,
          endHour: hour,
          timezone: 'America/New_York', // Default timezone
          confidence: engagement / maxEngagement,
        });
        windowStart = -1;
      }
    }
    
    // Handle end-of-day window
    if (windowStart !== -1) {
      windows.push({
        startHour: windowStart,
        endHour: 24,
        timezone: 'America/New_York',
        confidence: hourlyEngagement[windowStart] / maxEngagement,
      });
    }
    
    // Return top 3 windows, minimum 1
    return windows
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3)
      .concat(windows.length === 0 ? DEFAULT_WINDOWS.general : []);
  }
  
  // Update engagement data after posts are live
  static async recordEngagement(
    postId: number,
    subreddit: string,
    engagement: { upvotes: number; comments: number; awards?: number }
  ) {
    try {
      await db.insert(eventLogs).values({
        userId: null, // System event
        type: 'post.engagement',
        meta: {
          postId,
          subreddit,
          engagement,
          analyzedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Failed to record engagement:', error);
    }
  }
}