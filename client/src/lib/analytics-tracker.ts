// PHASE 1: Client-Side Analytics & Event Tracking System
// Comprehensive user behavior tracking for real analytics

import { v4 as uuidv4 } from 'uuid';

interface AnalyticsEvent {
  type: string;
  element?: string;
  page: string;
  metadata?: Record<string, unknown>;
  value?: number;
}

interface PageViewData {
  path: string;
  title?: string;
  referrer?: string;
  timeOnPage?: number;
  scrollDepth?: number;
  exitPage?: boolean;
}

interface SessionData {
  sessionId: string;
  startTime: number;
  lastActivity: number;
  pageCount: number;
  events: AnalyticsEvent[];
}

class AnalyticsTracker {
  private sessionId: string;
  private userId?: string;
  private currentPage: string = '';
  private pageStartTime: number = 0;
  private session: SessionData;
  private heartbeatInterval?: number;
  private eventQueue: AnalyticsEvent[] = [];
  private isTracking: boolean = true;
  private maxScrollDepth: number = 0;

  constructor() {
    this.sessionId = this.getOrCreateSessionId();
    this.session = {
      sessionId: this.sessionId,
      startTime: Date.now(),
      lastActivity: Date.now(),
      pageCount: 0,
      events: []
    };
    
    this.initializeTracking();
  }

  private getOrCreateSessionId(): string {
    let sessionId = sessionStorage.getItem('analytics_session_id');
    if (!sessionId) {
      sessionId = uuidv4();
      sessionStorage.setItem('analytics_session_id', sessionId);
    }
    return sessionId;
  }

  private initializeTracking() {
    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.flushEvents();
      } else {
        this.updateActivity();
      }
    });

    // Track beforeunload for session end
    window.addEventListener('beforeunload', () => {
      this.endSession();
    });

    // Track scroll depth
    window.addEventListener('scroll', this.throttle(() => {
      this.trackScrollDepth();
    }, 1000));

    // Track clicks on interactive elements
    document.addEventListener('click', (e) => {
      this.trackClick(e);
    });

    // Start heartbeat for activity tracking
    this.startHeartbeat();
  }

  public setUserId(userId: string) {
    this.userId = userId;
  }

  public trackPageView(path: string, title?: string) {
    // End previous page if exists
    if (this.currentPage && this.pageStartTime) {
      this.trackPageEnd();
    }

    this.currentPage = path;
    this.pageStartTime = Date.now();
    this.session.pageCount++;
    this.maxScrollDepth = 0;

    const pageViewData: PageViewData = {
      path,
      title: title || document.title,
      referrer: document.referrer || undefined,
    };

    this.sendEvent('page_view', pageViewData);
    this.updateActivity();
  }

  private trackPageEnd() {
    if (!this.currentPage || !this.pageStartTime) return;

    const timeOnPage = Math.floor((Date.now() - this.pageStartTime) / 1000);
    
    const pageEndData: PageViewData = {
      path: this.currentPage,
      timeOnPage,
      scrollDepth: this.maxScrollDepth,
      exitPage: true
    };

    this.sendEvent('page_end', pageEndData);
  }

  private trackScrollDepth() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const docHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
    const windowHeight = window.innerHeight;
    const scrollPercent = Math.round((scrollTop / (docHeight - windowHeight)) * 100);

    if (scrollPercent > this.maxScrollDepth) {
      this.maxScrollDepth = Math.min(scrollPercent, 100);
      
      // Track milestone scroll depths
      if (this.maxScrollDepth >= 75 && this.maxScrollDepth % 25 === 0) {
        this.trackEvent('scroll_depth', { depth: this.maxScrollDepth });
      }
    }
  }

  private trackClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target) return;

    let element = '';
    const metadata: Record<string, string | number | boolean | undefined> = {};

    // Get element identifier
    if (target.id) {
      element = `#${target.id}`;
    } else if (target.getAttribute('data-testid')) {
      element = `[data-testid="${target.getAttribute('data-testid')}"]`;
    } else if (target.className && typeof target.className === 'string' && target.className.trim()) {
      element = `.${target.className.split(' ')[0]}`;
    } else {
      element = target.tagName.toLowerCase();
    }

    // Add context metadata
    if (target.tagName === 'A') {
      metadata.href = (target as HTMLAnchorElement).href;
      metadata.text = target.textContent?.trim();
    } else if (target.tagName === 'BUTTON') {
      metadata.text = target.textContent?.trim();
      metadata.type = (target as HTMLButtonElement).type;
    }

    this.trackEvent('click', { element, ...metadata });
  }

  public trackEvent(type: string, metadata?: Record<string, string | number | boolean | undefined>, value?: number) {
    const event: AnalyticsEvent = {
      type,
      page: this.currentPage,
      metadata,
      value
    };

    this.session.events.push(event);
    this.sendEvent('engagement_event', event);
    this.updateActivity();
  }

  public trackContentView(contentId: number, platform: string, subreddit?: string) {
    this.sendEvent('content_view', {
      contentId,
      platform,
      subreddit,
      viewType: 'internal'
    });
  }

  public trackContentGeneration(success: boolean, platform: string, metadata?: Record<string, any>) {
    this.trackEvent('content_generation', {
      success,
      platform,
      ...metadata
    });
  }

  public trackFeatureUsage(feature: string, action: string, metadata?: Record<string, any>) {
    this.trackEvent('feature_usage', {
      feature,
      action,
      ...metadata
    });
  }

  private async sendEvent(eventType: string, data: unknown) {
    if (!this.isTracking) return;

    const eventData = {
      type: 'page_view' as const,
      page: window.location.pathname,
      eventType,
      sessionId: this.sessionId,
      userId: this.userId,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      referrer: document.referrer,
      ...(data as Record<string, any>)
    };

    this.eventQueue.push(eventData);

    // Batch send events to reduce server load
    if (this.eventQueue.length >= 5) {
      this.flushEvents();
    }
  }

  private async flushEvents() {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      await fetch('/api/analytics/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
        },
        body: JSON.stringify({ events }),
        credentials: 'include', // Include session cookies
        keepalive: true // Important for events sent during page unload
      });
    } catch (error) {
      console.warn('Failed to send analytics events:', error);
      // Re-queue events on failure
      this.eventQueue.unshift(...events);
    }
  }

  private updateActivity() {
    this.session.lastActivity = Date.now();
  }

  private startHeartbeat() {
    this.heartbeatInterval = window.setInterval(() => {
      this.updateActivity();
      this.flushEvents();
    }, 30000); // Send events every 30 seconds
  }

  private endSession() {
    this.trackPageEnd();
    this.flushEvents();
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Send session end event
    this.sendEvent('session_end', {
      duration: Date.now() - this.session.startTime,
      pageCount: this.session.pageCount,
      eventCount: this.session.events.length
    });
  }

  private throttle(func: Function, delay: number) {
    let timeoutId: number;
    let lastExecTime = 0;
    return function (this: unknown, ...args: unknown[]) {
      const currentTime = Date.now();
      
      if (currentTime - lastExecTime > delay) {
        func.apply(this, args);
        lastExecTime = currentTime;
      } else {
        clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
          func.apply(this, args);
          lastExecTime = Date.now();
        }, delay - (currentTime - lastExecTime));
      }
    };
  }

  public disable() {
    this.isTracking = false;
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }

  public enable() {
    this.isTracking = true;
    this.startHeartbeat();
  }
}

// Global analytics instance
export const analytics = new AnalyticsTracker();

// Convenience methods for common tracking
export const trackPageView = (path: string, title?: string) => analytics.trackPageView(path, title);
export const trackEvent = (type: string, metadata?: Record<string, any>, value?: number) => analytics.trackEvent(type, metadata, value);
export const trackContentView = (contentId: number, platform: string, subreddit?: string) => analytics.trackContentView(contentId, platform, subreddit);
export const trackContentGeneration = (success: boolean, platform: string, metadata?: Record<string, any>) => analytics.trackContentGeneration(success, platform, metadata);
export const trackFeatureUsage = (feature: string, action: string, metadata?: Record<string, any>) => analytics.trackFeatureUsage(feature, action, metadata);
export const setUserId = (userId: string) => analytics.setUserId(userId);