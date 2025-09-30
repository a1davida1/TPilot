import { db } from '../db';
import { socialMediaPosts } from '@shared/schema';
import { and, eq, desc } from 'drizzle-orm';

interface ContentSuggestion {
  topic: string;
  platform: string;
  estimatedEngagement: number;
  suggestedStyle: string;
  bestPostTime: Date;
}

interface PostPerformance {
  postId: number;
  engagement: number;
  postedAt: Date | null;
  platform: string;
}

interface PlatformStats {
  platform: string;
  avgEngagement: number;
  bestHours: number[];
  bestDays: number[];
  topHashtags: string[];
}

interface TrendingTopic {
  topic: string;
  platform: string;
  score: number;
  category: string;
}


class SchedulingOptimizer {
  // Best posting times by platform (based on industry research)
  private defaultBestTimes = {
    reddit: {
      weekdays: [6, 7, 8, 12, 17, 18, 19, 20, 21, 22, 23], // Early morning, lunch, evening
      weekends: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]
    },
    twitter: {
      weekdays: [8, 9, 12, 17, 18, 19, 20],
      weekends: [9, 10, 11, 12, 13, 17, 18, 19, 20]
    },
    instagram: {
      weekdays: [6, 7, 11, 12, 13, 17, 18, 19, 20],
      weekends: [10, 11, 12, 13, 14, 17, 18, 19, 20]
    },
    onlyfans: {
      weekdays: [8, 9, 10, 12, 17, 18, 19, 20, 21, 22, 23],
      weekends: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]
    },
    tiktok: {
      weekdays: [6, 10, 19, 20, 21],
      weekends: [8, 9, 10, 11, 19, 20, 21]
    }
  };

  // Best days for engagement (0 = Sunday, 6 = Saturday)
  private bestDays = {
    reddit: [1, 2, 3, 4, 5], // Weekdays
    twitter: [1, 2, 3, 4], // Mon-Thu
    instagram: [1, 3, 4], // Mon, Wed, Thu
    onlyfans: [0, 4, 5, 6], // Sun, Fri, Sat
    tiktok: [1, 2, 3, 4] // Mon-Thu
  };

  async getBestPostTime(userId: number, platform: string): Promise<Date> {
    try {
      // Get user's historical post performance
      const history = await this.getUserPostHistory(userId, platform);
      
      if (history.length > 10) {
        // Analyze user's specific patterns
        const bestTime = this.analyzeUserPatterns(history);
        if (bestTime) return bestTime;
      }
      
      // Fall back to platform defaults
      return this.getDefaultBestTime(platform);
    } catch (error) {
      console.error('Error calculating best post time:', error);
      return this.getDefaultBestTime(platform);
    }
  }

  private async getUserPostHistory(userId: number, platform: string): Promise<PostPerformance[]> {
    try {
      const posts = await db.select({
        postId: socialMediaPosts.id,
        engagement: socialMediaPosts.engagement,
        postedAt: socialMediaPosts.createdAt,
        platform: socialMediaPosts.platform
      })
      .from(socialMediaPosts)
      .where(
        and(
          eq(socialMediaPosts.userId, userId),
          eq(socialMediaPosts.platform, platform),
          eq(socialMediaPosts.status, 'published')
        )
      )
      .orderBy(desc(socialMediaPosts.createdAt))
      .limit(100);
      
      return posts.map(p => ({
        postId: p.postId,
        engagement: typeof p.engagement === 'number'
          ? p.engagement
          : (p.engagement?.likes ?? 0)
            + (p.engagement?.comments ?? 0)
            + (p.engagement?.shares ?? 0)
            + (p.engagement?.views ?? 0)
            + (p.engagement?.retweets ?? 0)
            + (p.engagement?.quotes ?? 0),
        postedAt: p.postedAt ?? null,
        platform: p.platform
      }));
    } catch (error) {
      console.error('Error fetching post history:', error);
      return [];
    }
  }

  private analyzeUserPatterns(history: PostPerformance[]): Date | null {
    if (history.length === 0) return null;
    
    // Calculate average engagement by hour
    const hourlyEngagement = new Map<number, { total: number; count: number }>();
    
    history.forEach(post => {
      if (!post.postedAt) return;
      const hour = post.postedAt.getHours();
      const current = hourlyEngagement.get(hour) || { total: 0, count: 0 };
      hourlyEngagement.set(hour, {
        total: current.total + post.engagement,
        count: current.count + 1
      });
    });
    
    // Find hour with highest average engagement
    let bestHour = 0;
    let maxAvgEngagement = 0;
    
    hourlyEngagement.forEach((data, hour) => {
      const avgEngagement = data.total / data.count;
      if (avgEngagement > maxAvgEngagement) {
        maxAvgEngagement = avgEngagement;
        bestHour = hour;
      }
    });
    
    // Calculate next occurrence of best hour
    return this.getNextTimeAtHour(bestHour);
  }

  private getDefaultBestTime(platform: string): Date {
    const times = this.defaultBestTimes[platform as keyof typeof this.defaultBestTimes] 
      || this.defaultBestTimes.reddit;
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();
    const isWeekend = currentDay === 0 || currentDay === 6;
    
    const todayTimes = isWeekend ? times.weekends : times.weekdays;
    
    // Find next best time today
    for (const hour of todayTimes) {
      if (hour > currentHour) {
        const nextTime = new Date(now);
        nextTime.setHours(hour, 0, 0, 0);
        return nextTime;
      }
    }
    
    // No more good times today, get first time tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDay = tomorrow.getDay();
    const tomorrowIsWeekend = tomorrowDay === 0 || tomorrowDay === 6;
    const tomorrowTimes = tomorrowIsWeekend ? times.weekends : times.weekdays;
    
    tomorrow.setHours(tomorrowTimes[0], 0, 0, 0);
    return tomorrow;
  }

  private getNextTimeAtHour(hour: number): Date {
    const now = new Date();
    const next = new Date(now);
    
    if (now.getHours() < hour) {
      // Later today
      next.setHours(hour, 0, 0, 0);
    } else {
      // Tomorrow at this hour
      next.setDate(next.getDate() + 1);
      next.setHours(hour, 0, 0, 0);
    }
    
    return next;
  }

  async suggestContentBasedOnTrends(userId: number): Promise<ContentSuggestion[]> {
    try {
      // Get trending topics (in production, this would call external APIs)
      const trends = await this.getTrendingTopics();
      
      // Get user's niche/interests
      const userNiche = await this.getUserNiche(userId);
      
      // Generate suggestions
      return trends
        .filter(trend => this.matchesNiche(trend, userNiche))
        .slice(0, 5)
        .map(trend => ({
          topic: trend.topic,
          platform: trend.platform,
          estimatedEngagement: trend.score,
          suggestedStyle: this.getSuggestedStyle(trend),
          bestPostTime: this.getDefaultBestTime(trend.platform)
        }));
    } catch (error) {
      console.error('Error suggesting content:', error);
      return [];
    }
  }

  private async getTrendingTopics(): Promise<TrendingTopic[]> {
    // In production, this would fetch from Reddit API, Twitter API, etc.
    // For now, return mock trending topics
    return [
      { topic: 'Fitness transformation', platform: 'instagram', score: 85, category: 'fitness' },
      { topic: 'Behind the scenes', platform: 'onlyfans', score: 92, category: 'exclusive' },
      { topic: 'Cosplay showcase', platform: 'reddit', score: 78, category: 'creative' },
      { topic: 'Quick tips', platform: 'tiktok', score: 88, category: 'educational' },
      { topic: 'Q&A session', platform: 'twitter', score: 75, category: 'engagement' }
    ];
  }

  private async getUserNiche(_userId: number): Promise<string[]> {
    // Analyze user's past content to determine their niche
    // For now, return common niches
    return ['fitness', 'creative', 'lifestyle', 'exclusive'];
  }

  private matchesNiche(trend: TrendingTopic, userNiche: string[]): boolean {
    return userNiche.includes(trend.category) || trend.score > 80;
  }

  private getSuggestedStyle(trend: TrendingTopic): string {
    const styleMap: Record<string, string> = {
      'fitness': 'motivational',
      'exclusive': 'teasing',
      'creative': 'showcase',
      'educational': 'informative',
      'engagement': 'conversational'
    };
    
    return styleMap[trend.category] || 'casual';
  }

  async optimizePostingSchedule<T extends { platform: string }>(
    userId: number,
    posts: T[]
  ): Promise<(T & { scheduledTime: Date; optimizationScore: number })[]> {
    // Distribute posts optimally across time slots
    const optimizedPosts: (T & { scheduledTime: Date; optimizationScore: number })[] = [];
    const usedSlots = new Set<string>();
    
    for (const post of posts) {
      const bestTime = await this.getBestPostTime(userId, post.platform);
      
      // Ensure minimum 2-hour gap between posts on same platform
      let scheduledTime = bestTime;
      let attempts = 0;
      
      while (usedSlots.has(`${post.platform}-${scheduledTime.getTime()}`) && attempts < 10) {
        scheduledTime = new Date(scheduledTime);
        scheduledTime.setHours(scheduledTime.getHours() + 2);
        attempts++;
      }
      
      usedSlots.add(`${post.platform}-${scheduledTime.getTime()}`);
      
      optimizedPosts.push({
        ...post,
        scheduledTime,
        optimizationScore: this.calculateOptimizationScore(scheduledTime, post.platform)
      });
    }
    
    return optimizedPosts.sort((a, b) => 
      a.scheduledTime.getTime() - b.scheduledTime.getTime()
    );
  }

  private calculateOptimizationScore(time: Date, platform: string): number {
    const hour = time.getHours();
    const day = time.getDay();
    const isWeekend = day === 0 || day === 6;
    
    const times = this.defaultBestTimes[platform as keyof typeof this.defaultBestTimes] 
      || this.defaultBestTimes.reddit;
    const bestHours = isWeekend ? times.weekends : times.weekdays;
    const bestDays = this.bestDays[platform as keyof typeof this.bestDays] || [1, 2, 3, 4, 5];
    
    let score = 50; // Base score
    
    // Hour score (up to 30 points)
    if (bestHours.includes(hour)) {
      score += 30;
    } else if (bestHours.some(h => Math.abs(h - hour) <= 1)) {
      score += 20; // Close to best hour
    } else if (bestHours.some(h => Math.abs(h - hour) <= 2)) {
      score += 10; // Somewhat close
    }
    
    // Day score (up to 20 points)
    if (bestDays.includes(day)) {
      score += 20;
    } else if (bestDays.some(d => Math.abs(d - day) <= 1)) {
      score += 10; // Adjacent day
    }
    
    return Math.min(100, score);
  }

  async getPlatformStats(userId: number): Promise<PlatformStats[]> {
    const platforms = ['reddit', 'twitter', 'instagram', 'onlyfans', 'tiktok'];
    const stats: PlatformStats[] = [];
    
    for (const platform of platforms) {
      const history = await this.getUserPostHistory(userId, platform);
      
      if (history.length === 0) {
        // Return defaults for platforms with no history
        stats.push({
          platform,
          avgEngagement: 0,
          bestHours: this.defaultBestTimes[platform as keyof typeof this.defaultBestTimes]?.weekdays.slice(0, 3) || [],
          bestDays: this.bestDays[platform as keyof typeof this.bestDays] || [],
          topHashtags: []
        });
        continue;
      }
      
      // Calculate average engagement
      const avgEngagement = history.reduce((sum, p) => sum + p.engagement, 0) / history.length;
      
      // Find best performing hours
      const hourlyPerformance = new Map<number, number[]>();
      history.forEach(post => {
        if (!post.postedAt) return;
        const hour = post.postedAt.getHours();
        const perf = hourlyPerformance.get(hour) || [];
        perf.push(post.engagement);
        hourlyPerformance.set(hour, perf);
      });
      
      const bestHours = Array.from(hourlyPerformance.entries())
        .map(([hour, engagements]) => ({
          hour,
          avg: engagements.reduce((a, b) => a + b, 0) / engagements.length
        }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 3)
        .map(h => h.hour);
      
      // Find best performing days
      const dailyPerformance = new Map<number, number[]>();
      history.forEach(post => {
        if (!post.postedAt) return;
        const day = post.postedAt.getDay();
        const perf = dailyPerformance.get(day) || [];
        perf.push(post.engagement);
        dailyPerformance.set(day, perf);
      });
      
      const bestDays = Array.from(dailyPerformance.entries())
        .map(([day, engagements]) => ({
          day,
          avg: engagements.reduce((a, b) => a + b, 0) / engagements.length
        }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 3)
        .map(d => d.day);
      
      stats.push({
        platform,
        avgEngagement,
        bestHours,
        bestDays,
        topHashtags: [] // Would be extracted from post content in production
      });
    }
    
    return stats;
  }
}

// Create singleton instance
export const schedulingOptimizer = new SchedulingOptimizer();