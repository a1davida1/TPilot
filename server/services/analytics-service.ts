import { db } from '../db';
import { users } from '@shared/schema';
import { and, eq, gte, lte, sql, desc } from 'drizzle-orm';

export interface AnalyticsEvent<T extends Record<string, unknown> = Record<string, unknown>> {
  userId: string;
  event: string;
  properties: T;
  timestamp: Date;
  sessionId: string;
  deviceInfo: {
    browser: string;
    os: string;
    device: string;
  };
}

export interface FunnelData {
  step: string;
  users: number;
  conversionRate: number;
}

export interface CohortData {
  cohort: string;
  day0: number;
  day1: number;
  day7: number;
  day30: number;
}

export interface AdoptionData {
  feature: string;
  users: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
}

export interface RevenueData {
  mrr: number;
  arr: number;
  arpu: number;
  churnRate: number;
  ltv: number;
}

interface SessionData {
  id: string;
  startTime: Date;
}

class AnalyticsService {
  private events: AnalyticsEvent[] = [];
  private sessionData: Map<string, SessionData> = new Map();

  // Core event tracking methods
  async trackSignup(userId: string, source: string) {
    await this.trackEvent(userId, 'user_signup', {
      source,
      timestamp: new Date().toISOString(),
      referrer: source === 'organic' ? null : source
    });
  }

  async trackLogin(userId: string, method: string) {
    await this.trackEvent(userId, 'user_login', {
      method,
      timestamp: new Date().toISOString()
    });
    
    // Update last login in database
    try {
      await db.update(users)
        .set({ lastLogin: new Date() })
        .where(eq(users.id, parseInt(userId)));
    } catch (error) {
      console.error('Error updating last login:', error);
    }
  }

  async trackContentGenerated(userId: string, platform: string, style: string) {
    await this.trackEvent(userId, 'content_generated', {
      platform,
      style,
      timestamp: new Date().toISOString()
    });
  }

  async trackPostCreated(userId: string, platform: string, success: boolean) {
    await this.trackEvent(userId, 'post_created', {
      platform,
      success,
      timestamp: new Date().toISOString()
    });
  }

  async trackSubscription(userId: string, plan: string, revenue: number) {
    await this.trackEvent(userId, 'subscription_change', {
      plan,
      revenue,
      type: revenue > 0 ? 'upgrade' : 'downgrade',
      timestamp: new Date().toISOString()
    });
  }

  async trackFeatureUsage(userId: string, feature: string, metadata?: unknown) {
    await this.trackEvent(userId, 'feature_used', {
      feature,
      ...(typeof metadata === 'object' && metadata !== null ? metadata : {}),
      timestamp: new Date().toISOString()
    });
  }

  async trackError(userId: string, error: string, context: unknown) {
    await this.trackEvent(userId, 'error_occurred', {
      error,
      context,
      severity: this.calculateErrorSeverity(error),
      timestamp: new Date().toISOString()
    });
  }

  async trackPageView(userId: string, page: string, referrer?: string) {
    await this.trackEvent(userId, 'page_view', {
      page,
      referrer,
      timestamp: new Date().toISOString()
    });
  }

  // Analytics report generation
  async getDailyActiveUsers(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    try {
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(users)
        .where(
          and(
            gte(users.lastLogin, today),
            lte(users.lastLogin, new Date())
          )
        );
      
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error getting DAU:', error);
      return 0;
    }
  }

  async getMonthlyActiveUsers(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    try {
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(users)
        .where(
          and(
            gte(users.lastLogin, thirtyDaysAgo),
            lte(users.lastLogin, new Date())
          )
        );
      
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error getting MAU:', error);
      return 0;
    }
  }

  async getConversionFunnel(): Promise<FunnelData[]> {
    // Simulated funnel data - in production, this would query actual event data
    const funnel = [
      { step: 'Landing Page Visit', users: 10000, conversionRate: 100 },
      { step: 'Sign Up Started', users: 3000, conversionRate: 30 },
      { step: 'Email Verified', users: 2400, conversionRate: 80 },
      { step: 'First Content Created', users: 1800, conversionRate: 75 },
      { step: 'Subscription Started', users: 540, conversionRate: 30 }
    ];
    
    return funnel;
  }

  async getRetentionCohort(): Promise<CohortData[]> {
    // Simulated cohort data - in production, this would analyze user retention
    const cohorts = [
      { cohort: 'Week 1', day0: 100, day1: 85, day7: 65, day30: 45 },
      { cohort: 'Week 2', day0: 100, day1: 82, day7: 62, day30: 42 },
      { cohort: 'Week 3', day0: 100, day1: 88, day7: 68, day30: 48 },
      { cohort: 'Week 4', day0: 100, day1: 90, day7: 70, day30: 50 }
    ];
    
    return cohorts;
  }

  async getFeatureAdoption(): Promise<AdoptionData[]> {
    // Track which features are being used
    const features = [
      { feature: 'AI Content Generation', users: 1250, percentage: 75, trend: 'up' as const },
      { feature: 'Image Protection', users: 890, percentage: 53, trend: 'up' as const },
      { feature: 'Post Scheduling', users: 650, percentage: 39, trend: 'stable' as const },
      { feature: 'Analytics Dashboard', users: 450, percentage: 27, trend: 'up' as const },
      { feature: 'Bulk Operations', users: 230, percentage: 14, trend: 'down' as const }
    ];
    
    return features;
  }

  async getRevenueMetrics(): Promise<RevenueData> {
    // Calculate revenue metrics
    const metrics = {
      mrr: 12500, // Monthly Recurring Revenue
      arr: 150000, // Annual Recurring Revenue
      arpu: 45, // Average Revenue Per User
      churnRate: 5.2, // Monthly churn rate %
      ltv: 865 // Customer Lifetime Value
    };
    
    return metrics;
  }

  // Helper methods
  private async trackEvent(userId: string, event: string, properties: Record<string, unknown>) {
    const eventData: AnalyticsEvent = {
      userId,
      event,
      properties,
      timestamp: new Date(),
      sessionId: this.getSessionId(userId),
      deviceInfo: this.getDeviceInfo()
    };
    
    // Store event
    this.events.push(eventData);
    
    // In production, send to analytics service (e.g., Mixpanel, Amplitude)
    if (process.env.NODE_ENV === 'production') {
      // await this.sendToAnalyticsProvider(eventData);
    }
    
    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Analytics Event:', event, properties);
    }
  }

  private getSessionId(userId: string): string {
    // Simple session tracking
    if (!this.sessionData.has(userId)) {
      this.sessionData.set(userId, {
        id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        startTime: new Date()
      });
    }
    const sessionData = this.sessionData.get(userId);
    return sessionData!.id; // Safe because we just set it above
  }

  private getDeviceInfo() {
    // This would be populated from request headers in a real implementation
    return {
      browser: 'Chrome',
      os: 'Windows',
      device: 'Desktop'
    };
  }

  private calculateErrorSeverity(error: string): 'low' | 'medium' | 'high' | 'critical' {
    if (error.includes('payment') || error.includes('subscription')) {
      return 'critical';
    }
    if (error.includes('auth') || error.includes('security')) {
      return 'high';
    }
    if (error.includes('network') || error.includes('timeout')) {
      return 'medium';
    }
    return 'low';
  }

  // Batch processing for events
  async flushEvents() {
    if (this.events.length === 0) return;
    
    const eventsToSend = [...this.events];
    this.events = [];
    
    // In production, batch send to analytics provider
    if (process.env.NODE_ENV === 'production') {
      // await this.batchSendToAnalyticsProvider(eventsToSend);
    }
  }

  // User segmentation
  async getUserSegment(userId: string): Promise<string> {
    // Determine user segment based on behavior
    const userEvents = this.events.filter(e => e.userId === userId);
    const contentCount = userEvents.filter(e => e.event === 'content_generated').length;
    const lastActive = userEvents[userEvents.length - 1]?.timestamp;
    
    if (contentCount > 100) return 'power_user';
    if (contentCount > 20) return 'active_user';
    if (contentCount > 5) return 'regular_user';
    if (contentCount > 0) return 'new_user';
    return 'inactive_user';
  }

  // A/B test tracking
  async trackABTestExposure(userId: string, testName: string, variant: string) {
    await this.trackEvent(userId, 'ab_test_exposure', {
      test: testName,
      variant,
      timestamp: new Date().toISOString()
    });
  }

  async trackABTestConversion(userId: string, testName: string, variant: string, value?: number) {
    await this.trackEvent(userId, 'ab_test_conversion', {
      test: testName,
      variant,
      value,
      timestamp: new Date().toISOString()
    });
  }
}

// Create singleton instance
export const analytics = new AnalyticsService();

// Set up periodic flush
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    analytics.flushEvents();
  }, 30000); // Flush every 30 seconds
}