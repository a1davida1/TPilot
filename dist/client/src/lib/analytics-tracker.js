// PHASE 1: Client-Side Analytics & Event Tracking System
// Comprehensive user behavior tracking for real analytics
import { v4 as uuidv4 } from 'uuid';
class AnalyticsTracker {
    sessionId;
    userId;
    currentPage = '';
    pageStartTime = 0;
    session;
    heartbeatInterval;
    eventQueue = [];
    isTracking = true;
    maxScrollDepth = 0;
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
    getOrCreateSessionId() {
        let sessionId = sessionStorage.getItem('analytics_session_id');
        if (!sessionId) {
            sessionId = uuidv4();
            sessionStorage.setItem('analytics_session_id', sessionId);
        }
        return sessionId;
    }
    initializeTracking() {
        // Track page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.flushEvents();
            }
            else {
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
    setUserId(userId) {
        this.userId = userId;
    }
    trackPageView(path, title) {
        // End previous page if exists
        if (this.currentPage && this.pageStartTime) {
            this.trackPageEnd();
        }
        this.currentPage = path;
        this.pageStartTime = Date.now();
        this.session.pageCount++;
        this.maxScrollDepth = 0;
        const pageViewData = {
            path,
            title: title || document.title,
            referrer: document.referrer || undefined,
        };
        this.sendEvent('page_view', pageViewData);
        this.updateActivity();
    }
    trackPageEnd() {
        if (!this.currentPage || !this.pageStartTime)
            return;
        const timeOnPage = Math.floor((Date.now() - this.pageStartTime) / 1000);
        const pageEndData = {
            path: this.currentPage,
            timeOnPage,
            scrollDepth: this.maxScrollDepth,
            exitPage: true
        };
        this.sendEvent('page_end', pageEndData);
    }
    trackScrollDepth() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
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
    trackClick(e) {
        const target = e.target;
        if (!target)
            return;
        let element = '';
        const metadata = {};
        // Get element identifier
        if (target.id) {
            element = `#${target.id}`;
        }
        else if (target.getAttribute('data-testid')) {
            element = `[data-testid="${target.getAttribute('data-testid')}"]`;
        }
        else if (target.className && typeof target.className === 'string' && target.className.trim()) {
            element = `.${target.className.split(' ')[0]}`;
        }
        else {
            element = target.tagName.toLowerCase();
        }
        // Add context metadata
        if (target.tagName === 'A') {
            metadata.href = target.href;
            metadata.text = target.textContent?.trim();
        }
        else if (target.tagName === 'BUTTON') {
            metadata.text = target.textContent?.trim();
            metadata.type = target.type;
        }
        this.trackEvent('click', { element, ...metadata });
    }
    trackEvent(type, metadata, value) {
        const event = {
            type,
            page: this.currentPage,
            metadata,
            value
        };
        this.session.events.push(event);
        this.sendEvent('engagement_event', event);
        this.updateActivity();
    }
    trackContentView(contentId, platform, subreddit) {
        this.sendEvent('content_view', {
            contentId,
            platform,
            subreddit,
            viewType: 'internal'
        });
    }
    trackContentGeneration(success, platform, metadata) {
        this.trackEvent('content_generation', {
            success,
            platform,
            ...metadata
        });
    }
    trackFeatureUsage(feature, action, metadata) {
        this.trackEvent('feature_usage', {
            feature,
            action,
            ...metadata
        });
    }
    async sendEvent(eventType, data) {
        if (!this.isTracking)
            return;
        const eventData = {
            eventType,
            sessionId: this.sessionId,
            userId: this.userId,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            referrer: document.referrer,
            ...data
        };
        this.eventQueue.push(eventData);
        // Batch send events to reduce server load
        if (this.eventQueue.length >= 5) {
            this.flushEvents();
        }
    }
    async flushEvents() {
        if (this.eventQueue.length === 0)
            return;
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
                keepalive: true // Important for events sent during page unload
            });
        }
        catch (error) {
            console.warn('Failed to send analytics events:', error);
            // Re-queue events on failure
            this.eventQueue.unshift(...events);
        }
    }
    updateActivity() {
        this.session.lastActivity = Date.now();
    }
    startHeartbeat() {
        this.heartbeatInterval = window.setInterval(() => {
            this.updateActivity();
            this.flushEvents();
        }, 30000); // Send events every 30 seconds
    }
    endSession() {
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
    throttle(func, delay) {
        let timeoutId;
        let lastExecTime = 0;
        return function (...args) {
            const currentTime = Date.now();
            if (currentTime - lastExecTime > delay) {
                func.apply(this, args);
                lastExecTime = currentTime;
            }
            else {
                clearTimeout(timeoutId);
                timeoutId = window.setTimeout(() => {
                    func.apply(this, args);
                    lastExecTime = Date.now();
                }, delay - (currentTime - lastExecTime));
            }
        };
    }
    disable() {
        this.isTracking = false;
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
    }
    enable() {
        this.isTracking = true;
        this.startHeartbeat();
    }
}
// Global analytics instance
export const analytics = new AnalyticsTracker();
// Convenience methods for common tracking
export const trackPageView = (path, title) => analytics.trackPageView(path, title);
export const trackEvent = (type, metadata, value) => analytics.trackEvent(type, metadata, value);
export const trackContentView = (contentId, platform, subreddit) => analytics.trackContentView(contentId, platform, subreddit);
export const trackContentGeneration = (success, platform, metadata) => analytics.trackContentGeneration(success, platform, metadata);
export const trackFeatureUsage = (feature, action, metadata) => analytics.trackFeatureUsage(feature, action, metadata);
export const setUserId = (userId) => analytics.setUserId(userId);
