import type { Request } from 'express';
import Stripe from 'stripe';

// Visitor Analytics System
interface VisitorSession {
  id: string;
  ipAddress: string;
  userAgent: string;
  startTime: Date;
  lastActivity: Date;
  pageViews: PageView[];
  referrer?: string;
  country?: string;
  isBot: boolean;
}

interface PageView {
  path: string;
  timestamp: Date;
  timeOnPage?: number; // in seconds
}

interface AnalyticsStats {
  totalVisitors: number;
  uniqueVisitors: number;
  pageViews: number;
  averageSessionDuration: number;
  bounceRate: number;
  topPages: { path: string; views: number }[];
  trafficSources: { source: string; visitors: number }[];
  hourlyTraffic: { hour: number; visitors: number }[];
  conversionRate: number; // visitors who signed up
}

class VisitorAnalytics {
  private sessions: Map<string, VisitorSession> = new Map();
  private dailyStats: Map<string, AnalyticsStats> = new Map();
  private stripe: Stripe | null = null;

  constructor() {
    const key = process.env.STRIPE_SECRET_KEY;
    if (key) {
      this.stripe = new Stripe(key, { apiVersion: '2023-10-16' });
    }
  }

  // Generate session ID from IP + User Agent
  private generateSessionId(req: Request): string {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    return Buffer.from(`${ip}-${userAgent}`).toString('base64').slice(0, 16);
  }

  // Check if user agent is a bot
  private isBot(userAgent: string): boolean {
    const botPatterns = [
      /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i,
      /baiduspider/i, /yandexbot/i, /facebookexternalhit/i,
      /twitterbot/i, /rogerbot/i, /linkedinbot/i, /whatsapp/i,
      /crawler/i, /spider/i, /bot/i, /crawl/i
    ];
    return botPatterns.some(pattern => pattern.test(userAgent));
  }

  // Track page view
  trackPageView(req: Request, path: string) {
    const sessionId = this.generateSessionId(req);
    const now = new Date();
    const userAgent = req.get('user-agent') || 'unknown';
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const referrer = req.get('referer');

    let session = this.sessions.get(sessionId);
    
    if (!session) {
      // New session
      session = {
        id: sessionId,
        ipAddress: ip,
        userAgent,
        startTime: now,
        lastActivity: now,
        pageViews: [],
        referrer,
        isBot: this.isBot(userAgent)
      };
      this.sessions.set(sessionId, session);
    } else {
      // Update last activity
      session.lastActivity = now;
    }

    // Add page view
    session.pageViews.push({
      path,
      timestamp: now
    });

    // Clean old sessions (older than 30 minutes)
    this.cleanOldSessions();
  }

  // Clean sessions older than 30 minutes
  private cleanOldSessions() {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    Array.from(this.sessions.entries()).forEach(([sessionId, session]) => {
      if (session.lastActivity < thirtyMinutesAgo) {
        this.sessions.delete(sessionId);
      }
    });
  }

  // Get current analytics stats
  getAnalytics(period: '24h' | '7d' | '30d' = '24h'): AnalyticsStats {
    const now = new Date();
    let cutoffTime: Date;

    switch (period) {
      case '24h':
        cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        cutoffTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        cutoffTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    // Filter sessions within the period (excluding bots)
    const recentSessions = Array.from(this.sessions.values())
      .filter(session => !session.isBot && session.startTime >= cutoffTime);

    const totalPageViews = recentSessions.reduce((sum, session) => sum + session.pageViews.length, 0);
    const uniqueVisitors = recentSessions.length;
    
    // Calculate session durations
    const sessionDurations = recentSessions.map(session => {
      if (session.pageViews.length <= 1) return 0;
      const firstView = session.pageViews[0].timestamp.getTime();
      const lastView = session.pageViews[session.pageViews.length - 1].timestamp.getTime();
      return (lastView - firstView) / 1000; // in seconds
    });

    const averageSessionDuration = sessionDurations.length > 0 
      ? sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length 
      : 0;

    // Calculate bounce rate (sessions with only 1 page view)
    const bounces = recentSessions.filter(session => session.pageViews.length === 1).length;
    const bounceRate = uniqueVisitors > 0 ? (bounces / uniqueVisitors) * 100 : 0;

    // Top pages
    const pageViewCounts: Map<string, number> = new Map();
    recentSessions.forEach(session => {
      session.pageViews.forEach(view => {
        const current = pageViewCounts.get(view.path) || 0;
        pageViewCounts.set(view.path, current + 1);
      });
    });

    const topPages = Array.from(pageViewCounts.entries())
      .map(([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    // Traffic sources
    const sourceCounts: Map<string, number> = new Map();
    recentSessions.forEach(session => {
      let source = 'Direct';
      if (session.referrer) {
        try {
          const url = new URL(session.referrer);
          source = url.hostname;
        } catch {
          source = 'Unknown';
        }
      }
      const current = sourceCounts.get(source) || 0;
      sourceCounts.set(source, current + 1);
    });

    const trafficSources = Array.from(sourceCounts.entries())
      .map(([source, visitors]) => ({ source, visitors }))
      .sort((a, b) => b.visitors - a.visitors);

    // Hourly traffic (for current period)
    const hourlyTraffic: { hour: number; visitors: number }[] = [];
    for (let i = 0; i < 24; i++) {
      const hourStart = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
      hourStart.setMinutes(0, 0, 0);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
      
      const visitorsInHour = recentSessions.filter(session => 
        session.startTime >= hourStart && session.startTime < hourEnd
      ).length;

      hourlyTraffic.push({ hour: i, visitors: visitorsInHour });
    }

    return {
      totalVisitors: uniqueVisitors,
      uniqueVisitors,
      pageViews: totalPageViews,
      averageSessionDuration,
      bounceRate,
      topPages,
      trafficSources,
      hourlyTraffic,
      conversionRate: 0 // This would be calculated based on signups vs visitors
    };
  }

  async recordPayment(customerId: string, amount: number): Promise<void> {
    if (!this.stripe) return;
    try {
      await this.stripe.customers.retrieve(customerId);
      // TODO: persist payment with analytics stats
    } catch (error) {
      console.error('Stripe recordPayment error:', error);
    }
  }

  // Get system completeness status
  getSystemCompleteness(): {
    category: string;
    status: 'complete' | 'partial' | 'missing';
    description: string;
    priority: 'high' | 'medium' | 'low';
  }[] {
    return [
      {
        category: 'User Authentication',
        status: 'complete',
        description: 'JWT-based auth with signup/login working',
        priority: 'high'
      },
      {
        category: 'Content Generation',
        status: 'complete',
        description: 'Template-based and AI content generation active',
        priority: 'high'
      },
      {
        category: 'Image Shield',
        status: 'complete',
        description: 'Client-side image protection fully implemented',
        priority: 'high'
      },
      {
        category: 'Payment System',
        status: 'missing',
        description: 'Stripe integration not implemented yet',
        priority: 'high'
      },
      {
        category: 'Database Migration',
        status: 'partial',
        description: 'Using in-memory storage, PostgreSQL schema ready',
        priority: 'medium'
      },
      {
        category: 'Email Notifications',
        status: 'missing',
        description: 'No email system for user communications',
        priority: 'medium'
      },
      {
        category: 'API Rate Limiting',
        status: 'missing',
        description: 'No rate limiting on content generation endpoints',
        priority: 'medium'
      },
      {
        category: 'Advanced Analytics',
        status: 'partial',
        description: 'Basic analytics implemented, advanced metrics missing',
        priority: 'low'
      },
      {
        category: 'Content Moderation',
        status: 'missing',
        description: 'No automated content filtering system',
        priority: 'low'
      },
      {
        category: 'Backup System',
        status: 'missing',
        description: 'No automated data backup strategy',
        priority: 'low'
      }
    ];
  }
}

export const visitorAnalytics = new VisitorAnalytics();